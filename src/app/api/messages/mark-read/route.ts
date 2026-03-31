import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages } from '@/lib/db'
import { authenticateUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // 认证用户
    const authResult = await authenticateUser(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { messageIds } = await request.json()
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: '消息ID列表不能为空' },
        { status: 400 }
      )
    }

    // 更新消息状态为已读（更新当前用户的消息和系统消息）
    const placeholders = messageIds.map(() => '?').join(', ')

    await db
      .update(messages)
      .set({ 
        read: true, 
        updatedAt: new Date().toISOString() 
      })
      .where({
        text: `"messages"."id" IN (${placeholders}) AND ("messages"."user_id" = ? OR "messages"."user_id" = 'system')`,
        params: [...messageIds, user.userId]
      })

    return NextResponse.json({ 
      success: true, 
      message: `成功标记 ${messageIds.length} 条消息为已读` 
    })
  } catch (error) {
    console.error('标记消息已读失败:', error)
    return NextResponse.json(
      { error: '标记消息已读失败' },
      { status: 500 }
    )
  }
} 