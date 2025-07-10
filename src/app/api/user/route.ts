import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { createLoggerFromRequest } from '@/lib/logger';

interface User {
  username: string;
  password: string;
}

export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    await apiLogger.info('GET /api/user request');
    
    const user = db.prepare('SELECT username, password FROM users LIMIT 1').get() as User | undefined;
    
    if (!user) {
      await apiLogger.warn('User not found');
      return NextResponse.json(
        { error: '未找到用户信息' },
        { status: 404 }
      );
    }

    await apiLogger.info('User info fetched successfully', { username: user.username });
    return NextResponse.json(user);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in GET /api/user', { error: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
} 