import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, JWTPayload } from './jwt';
import { createLogger, generateTraceId } from './logger';
import { db, unlockRecords, systemConfig } from './db';
import { decryptData } from './crypto';
import { sql } from 'drizzle-orm';
import { ERROR_CODES } from './error-codes';

/**
 * 从请求中提取用户信息（不进行认证验证）
 * @param request NextRequest对象
 * @returns 用户信息或null
 */
export function extractUserFromRequest(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = extractTokenFromHeader(authHeader);
  const tokenFromCookie = request.cookies.get('hodo_token')?.value;
  
  const token = tokenFromHeader || tokenFromCookie;
  
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * 认证中间件 - 验证JWT令牌
 * @param request NextRequest对象
 * @returns 如果认证成功，返回解码后的用户信息；如果失败，返回错误响应
 */
export async function authenticateUser(request: NextRequest, options?: { skipUnlockCheck?: boolean }): Promise<{ user: JWTPayload } | NextResponse> {
  const traceId = generateTraceId();
  const logger = createLogger('auth.middleware', traceId);

  try {
    // 从请求头或cookie中获取token
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = extractTokenFromHeader(authHeader);
    const tokenFromCookie = request.cookies.get('hodo_token')?.value;
    
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
      logger.warn('No authentication token provided');
      return NextResponse.json(
        { error: 'Authentication token required' },
        { status: 401 }
      );
    }

    // 验证token
    const decoded = verifyToken(token);
    if (!decoded) {
      logger.warn('Invalid authentication token');
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    if (request.method !== 'GET' && !options?.skipUnlockCheck) {
      const unlockCheck = await validateUnlockStatus(decoded);
      if (unlockCheck !== null) {
        return unlockCheck;
      }
    }

    // 使用用户信息创建新的logger
    const userLogger = createLogger('auth.middleware', traceId, {
      userId: decoded.userId,
      username: decoded.username
    });
    
    userLogger.info('User authenticated successfully');
    
    return { user: decoded };
  } catch (error) {
    logger.error('Error in authentication middleware: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

/**
 * 从请求中获取当前用户信息
 * @param request NextRequest对象
 * @returns 用户信息或null
 */
export function getCurrentUser(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = extractTokenFromHeader(authHeader);
  const tokenFromCookie = request.cookies.get('hodo_token')?.value;
  
  const token = tokenFromHeader || tokenFromCookie;
  
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * 获取或设置系统基准时间
 * @returns 基准时间
 */
async function getOrSetSystemBaseTime(): Promise<Date> {
  try {
    // 尝试从系统配置中获取基准时间
    const configResult = await db.select().from(systemConfig)
      .where(sql`${systemConfig.key} = 'trial_base_time'`);
    
    if (configResult.length > 0) {
      // 如果存在基准时间配置，返回它
      const baseTimeStr = configResult[0].value;
      return new Date(baseTimeStr);
    } else {
      // 如果不存在，创建基准时间配置
      const now = new Date();
      const nowStr = now.toISOString();
      
      await db.insert(systemConfig).values({
        key: 'trial_base_time',
        value: nowStr,
        createdAt: nowStr,
        updatedAt: nowStr
      });
      
      return now;
    }
  } catch (error) {
    console.error('Error getting/setting system base time:', error);
    // 如果出错，返回当前时间
    return new Date();
  }
}

/**
 * 检查是否在30天免费试用期内
 * @returns 是否在试用期内
 */
export async function isInTrialPeriod(): Promise<boolean> {
  try {
    const baseTime = await getOrSetSystemBaseTime();
    const now = new Date();
    const trialEndTime = new Date(baseTime);
    trialEndTime.setDate(trialEndTime.getDate() + 30); // 30天试用期

    return now <= trialEndTime;
  } catch (error) {
    console.error('Error checking trial period:', error);
    return false;
  }
}

/**
 * 验证用户解锁状态
 * @param user 用户信息
 * @returns 如果验证失败返回错误响应，成功返回null
 */
async function validateUnlockStatus(user: JWTPayload): Promise<NextResponse | null> {
  if (!user?.username) {
    return NextResponse.json({ 
      error: ERROR_CODES.UNLOCK_ERROR.code,
      msg: '用户信息无效'
    }, { status: 403 });
  }

  try {
    // 首先检查是否在30天免费试用期内
    const inTrialPeriod = await isInTrialPeriod();
    
    // 查询用户的解锁记录
    const records = await db.select().from(unlockRecords)
      .where(sql`${unlockRecords.username} = ${user.username}`);
    
    // 如果在试用期内，直接通过验证（无论是否有解锁记录）
    if (inTrialPeriod) {
      return null; // 在试用期内，直接通过验证
    }

    // 试用期已过，必须验证解锁记录
    if (!records.length) {
      return NextResponse.json({ 
        error: ERROR_CODES.UNLOCK_ERROR.code,
        msg: '试用期已结束，需要解锁码才能继续使用'
      }, { status: 403 });
    }

    const record = records[0];
    const unlockCode = record.unlockCode;
    const [encryptedAesKeyAndIv, encryptedData] = unlockCode.split(',');
    
    if (!encryptedAesKeyAndIv || !encryptedData) {
      return NextResponse.json({ 
        error: ERROR_CODES.UNLOCK_ERROR.code,
        msg: '解锁码格式错误'
      }, { status: 403 });
    }

    // 解密验证
    const decrypted = decryptData(encryptedAesKeyAndIv, encryptedData);
    const [decryptedUsername, decryptedDate] = (decrypted || '').split(',');
    
    if (
      decryptedUsername?.trim() !== user.username.trim() ||
      decryptedDate?.trim() !== record.date.trim() ||
      decryptedUsername?.trim() !== record.username.trim()
    ) {
      return NextResponse.json({ 
        error: ERROR_CODES.UNLOCK_ERROR.code,
        msg: '解锁码验证失败'
      }, { status: 403 });
    }

    return null; // 验证成功
  } catch {
    return NextResponse.json({ 
      error: ERROR_CODES.UNLOCK_ERROR.code,
      msg: '解锁验证过程中发生错误'
    }, { status: 403 });
  }
} 