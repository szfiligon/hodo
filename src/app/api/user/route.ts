import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const user = db.prepare('SELECT username, password FROM users LIMIT 1').get();
    
    if (!user) {
      return NextResponse.json(
        { error: '未找到用户信息' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
} 