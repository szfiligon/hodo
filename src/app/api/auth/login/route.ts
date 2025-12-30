import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/jwt';
import { extractUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('auth.login.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting user login API request');
    
    // 解析请求体
    const body = await request.json();
    const { username, password } = body;

    // 验证必需字段
    if (!username || !password) {
      logger.warn('Missing required fields for login');
      return NextResponse.json(
        { error: 'Missing required fields: username and password' },
        { status: 400 }
      );
    }

    // 根据用户名查找用户
    const userQuery = await db.select().from(users).where(sql`${users.username} = ${username}`).limit(1);
    
    if (userQuery.length === 0) {
      logger.warn(`Login failed: user not found with username ${username}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userQuery[0];

    // 验证密码（使用哈希比较）
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logger.warn(`Login failed: invalid password for username ${username}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 生成JWT令牌
    const token = generateToken(user.id, user.username);

    // 移除密码字段
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    // 使用用户信息创建新的logger
    const userLogger = createLogger('auth.login.route', traceId, {
      userId: user.id,
      username: username
    });
    
    userLogger.info('User login successful');
    
    return NextResponse.json({
      user: userWithoutPassword,
      token,
      message: 'Login successful',
      success: true
    });

  } catch (error) {
    logger.error('Error in login API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 