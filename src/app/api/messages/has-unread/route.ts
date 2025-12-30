import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { authenticateUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 认证用户
    const authResult = await authenticateUser(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // 查询是否有未读消息（当前用户的消息和系统消息）
    const unreadCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`(${messages.userId} = ${user.userId} OR ${messages.userId} = 'system') AND ${messages.read} = 0`)
    
    const unreadCount = unreadCountResult[0]?.count || 0
    const hasUnread = unreadCount > 0

    return NextResponse.json({
      success: true,
      data: {
        hasUnread,
        unreadCount
      }
    })
  } catch (error) {
    console.error('检查未读消息失败:', error)
    return NextResponse.json(
      { error: '检查未读消息失败' },
      { status: 500 }
    )
  }
}
