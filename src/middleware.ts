import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 生成简短的 traceId
function generateShortId(): string {
  // 使用时间戳 + 随机数的组合，生成8位字符
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp.slice(-4)}${random}`;
}

export function middleware(request: NextRequest) {
  // 为每个请求生成唯一的traceId
  const traceId = generateShortId();
  
  // 创建新的请求头，添加traceId
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-trace-id', traceId);
  
  // 创建新的响应，添加traceId到响应头中（可选，用于调试）
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // 将traceId添加到响应头中，方便前端调试
  response.headers.set('x-trace-id', traceId);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了以下开头的路径：
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 