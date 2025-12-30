import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateTraceId } from '@/lib/logger';
import { extractUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('auth.logout.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting user logout API request');
    
    // 创建响应
    const response = NextResponse.json({
      message: 'Logout successful',
      success: true
    });

    // 清除JWT cookie
    response.cookies.delete('hodo_token');
    
    logger.info('User logout successful');
    
    return response;

  } catch (error) {
    logger.error('Error in logout API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 