import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { User } from '@/lib/types';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('users.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting user creation API request');
    
    // 解析请求体
    const body = await request.json();
    const { username, password } = body;

    // 验证必需字段
    if (!username || !password) {
      logger.warn('Missing required fields for user creation');
      return NextResponse.json(
        { error: 'Missing required fields: username, password' },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existingUsername = await db.select().from(users).where(sql`${users.username} = ${username}`).limit(1);
    if (existingUsername.length > 0) {
      logger.warn(`User with username ${username} already exists`);
      return NextResponse.json(
        { error: 'User with this username already exists' },
        { status: 409 }
      );
    }

    // 创建新用户
    const now = new Date().toISOString();
    // 对密码进行加密
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: Date.now().toString(),
      username,
      password: hashedPassword, // 存储加密后的密码
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // 保存用户到数据库
    await db.insert(users).values({
      id: newUser.id,
      username: newUser.username,
      password: newUser.password,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString()
    });

    // 生成JWT令牌
    const token = generateToken(newUser.id, newUser.username);

    // 返回用户信息（不包含密码）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = newUser;
    
    return NextResponse.json({
      user: userWithoutPassword,
      token,
      message: 'User created successfully',
      success: true
    }, { status: 201 });

  } catch (error) {
    logger.error('Error in user creation API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'User creation failed' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('users.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting user update API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request, { skipUnlockCheck: true });
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 解析请求体
    const body = await request.json();
    const { id, username, currentPassword, newPassword } = body;

    // 验证必需字段
    if (!id) {
      logger.warn('Missing user ID for user update');
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const existingUser = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
    if (existingUser.length === 0) {
      logger.warn(`User with ID ${id} not found`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 如果提供了用户名，检查用户名是否已被其他用户使用
    if (username && username !== existingUser[0].username) {
      const usernameExists = await db.select().from(users).where(sql`${users.username} = ${username} AND ${users.id} != ${id}`).limit(1);
      if (usernameExists.length > 0) {
        logger.warn(`Username ${username} is already in use by another user`);
        return NextResponse.json(
          { error: 'Username is already in use by another user' },
          { status: 409 }
        );
      }
    }

    // 如果提供了密码，验证当前密码（除非是首次设置密码）
    if (currentPassword && newPassword) {
      // 如果用户当前没有密码（首次设置），则不需要验证当前密码
      if (existingUser[0].password && existingUser[0].password !== currentPassword) {
        logger.warn(`Current password is incorrect for user ${id}`);
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }

    // 准备更新数据
    const updateData: Record<string, string> = {
      updatedAt: new Date().toISOString()
    };

    if (username !== undefined) {
      updateData.username = username;
    }

    if (newPassword) {
      updateData.password = newPassword;
    }

    // 更新用户信息
    await db.update(users)
      .set(updateData)
      .where(sql`${users.id} = ${id}`);

    // 获取更新后的用户信息
    const updatedUser = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('users.route', traceId, {
      userId: id,
      username: authResult.user.username
    });
    
    userLogger.info(`User updated successfully {"userId":"${id}"}`);
    
    // 返回更新后的用户信息，包含密码字段但不包含实际密码值
    const userResponse = {
      ...updatedUser[0],
      password: updatedUser[0].password ? '***' : '' // 返回占位符而不是实际密码
    };
    
    return NextResponse.json({
      user: userResponse,
      message: 'User updated successfully',
      success: true
    });

  } catch (error) {
    logger.error('Error in user update API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'User update failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('users.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting user retrieval API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request, { skipUnlockCheck: true });
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // 根据ID查找特定用户
      const user = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
      
      if (user.length === 0) {
        logger.warn(`User with ID ${id} not found`);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // 使用用户信息创建新的logger
      const userLogger = createLogger('users.route', traceId, {
        userId: authResult.user.userId,
        username: authResult.user.username
      });
      
      userLogger.info(`User retrieved successfully {"userId":"${id}"}`);
      
      // 返回用户信息，包含密码字段但不包含实际密码值
      const userResponse = {
        ...user[0],
        password: user[0].password ? '***' : '' // 返回占位符而不是实际密码
      };
      
      return NextResponse.json({
        user: userResponse,
        success: true
      });
    } else {
      // 返回所有用户（不包含密码）
      const allUsers = await db.select().from(users);
      
      // 使用用户信息创建新的logger
      const userLogger = createLogger('users.route', traceId, {
        userId: authResult.user.userId,
        username: authResult.user.username
      });
      
      userLogger.info(`All users retrieved successfully {"count":"${allUsers.length}"}`);
      
      // 移除所有用户的密码字段
      const usersWithoutPasswords = allUsers.map(user => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      return NextResponse.json({
        users: usersWithoutPasswords,
        success: true
      });
    }

  } catch (error) {
    logger.error('Error in user retrieval API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Failed to retrieve user(s)' },
      { status: 500 }
    );
  }
} 