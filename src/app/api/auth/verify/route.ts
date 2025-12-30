import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateTraceId } from '@/lib/logger';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('auth.verify.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting token verification API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 使用用户信息创建新的logger
    const userLogger = createLogger('auth.verify.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info('Token verification successful');
    
    return NextResponse.json({
      user: authResult.user,
      message: 'Token is valid',
      success: true
    });

  } catch (error) {
    logger.error('Error in token verification API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 