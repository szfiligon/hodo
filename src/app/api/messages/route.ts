import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages } from '@/lib/db'
import { desc, sql } from 'drizzle-orm'
import { authenticateUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 认证用户
    const authResult = await authenticateUser(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    // 限制每页最大数量为50
    const actualPageSize = Math.min(pageSize, 50)
    const actualOffset = (page - 1) * actualPageSize

    // 查询消息总数（查询当前用户的消息和系统消息）
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`${messages.userId} = ${user.userId} OR ${messages.userId} = 'system'`)
    
    const totalCount = totalCountResult[0]?.count || 0

    // 分页查询消息，按创建时间倒序排列（查询当前用户的消息和系统消息）
    const messagesList = await db
      .select({
        id: messages.id,
        msg: messages.msg,
        type: messages.type,
        read: messages.read,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
      })
      .from(messages)
      .where(sql`${messages.userId} = ${user.userId} OR ${messages.userId} = 'system'`)
      .orderBy(desc(messages.createdAt))
      .limit(actualPageSize)
      .offset(actualOffset)

    return NextResponse.json({
      success: true,
      data: {
        messages: messagesList,
        pagination: {
          page,
          pageSize: actualPageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / actualPageSize),
          hasNext: page * actualPageSize < totalCount,
          hasPrev: page > 1,
        }
      }
    })
  } catch (error) {
    console.error('查询消息失败:', error)
    return NextResponse.json(
      { error: '查询消息失败' },
      { status: 500 }
    )
  }
} 