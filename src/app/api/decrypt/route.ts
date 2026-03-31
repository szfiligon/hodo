import { NextRequest, NextResponse } from 'next/server';
import { decryptData, validatePrivateKey } from '@/lib/crypto';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const logger = createLogger('decrypt.route', traceId);

  try {
    logger.info('Starting decrypt API request');
    
    // 验证私钥是否有效
    if (!validatePrivateKey()) {
      logger.error('RSA私钥验证失败');
      return NextResponse.json(
        { error: 'Invalid private key' },
        { status: 500 }
      );
    }

    const body: unknown = await request.json();
    const encryptedAesKeyAndIv =
      typeof (body as { encryptedAesKeyAndIv?: unknown })?.encryptedAesKeyAndIv === 'string'
        ? (body as { encryptedAesKeyAndIv: string }).encryptedAesKeyAndIv
        : '';
    const encryptedData =
      typeof (body as { encryptedData?: unknown })?.encryptedData === 'string'
        ? (body as { encryptedData: string }).encryptedData
        : '';

    if (!encryptedAesKeyAndIv || !encryptedData) {
      logger.error('Missing required parameters');
      return NextResponse.json(
        { error: 'Missing encryptedAesKeyAndIv or encryptedData' },
        { status: 400 }
      );
    }

    logger.info('Attempting to decrypt data');
    
    // 执行解密
    const decryptedData = decryptData(encryptedAesKeyAndIv, encryptedData);

    // 新增：校验解锁信息
    // decryptedData 期望格式：username,yyyyMMdd
    const [decryptedUsername, decryptedDate] = (decryptedData || '').split(',');
    if (!decryptedUsername || !decryptedDate) {
      logger.error('Decrypted data format invalid');
      return NextResponse.json(
        { error: 'Decrypted data format invalid' },
        { status: 400 }
      );
    }

    // 获取当前登录用户
    const { getCurrentUser } = await import('@/lib/auth');
    const userInfo = getCurrentUser(request);
    if (!userInfo || !userInfo.username) {
      logger.error('User not authenticated');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // 校验用户名
    if (userInfo.username !== decryptedUsername) {
      logger.error('Username mismatch');
      return NextResponse.json(
        { error: 'Username mismatch' },
        { status: 403 }
      );
    }

    // 校验日期
    const now = new Date();
    const yyyyMMdd = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    if (decryptedDate !== yyyyMMdd) {
      logger.error('Date mismatch or expired');
      return NextResponse.json(
        { error: 'Date mismatch or expired' },
        { status: 403 }
      );
    }

    logger.info('Decryption and unlock validation successful');

    // 写入解锁记录
    const { db, unlockRecords } = await import('@/lib/db');
    const unlockCode = `${encryptedAesKeyAndIv},${encryptedData}`; // 存储完整的解锁码原文：AES信息,密文
    // 按 username 唯一约束做手动 upsert（兼容当前 db 适配层）
    const existingRecord = await db
      .select()
      .from(unlockRecords)
      .where(sql`${unlockRecords.username} = ${decryptedUsername}`)
      .limit(1);

    if (existingRecord.length > 0) {
      await db
        .update(unlockRecords)
        .set({ date: decryptedDate, unlockCode })
        .where(sql`${unlockRecords.username} = ${decryptedUsername}`);
    } else {
      await db
        .insert(unlockRecords)
        .values({ username: decryptedUsername, date: decryptedDate, unlockCode });
    }
    
    return NextResponse.json({
      decryptedData,
      success: true,
      unlocked: true
    });

  } catch (error) {
    logger.error('Error in decrypt API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Decryption failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 