import { NextResponse } from 'next/server';
import { createLoggerFromRequest } from '@/lib/logger';

export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  await apiLogger.info('GET /api/hello request');
  
  return NextResponse.json({ message: 'Hello, World!' });
} 