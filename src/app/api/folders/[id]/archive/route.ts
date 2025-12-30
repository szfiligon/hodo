import { NextRequest, NextResponse } from 'next/server'
import { db, folders } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { authenticateUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户身份
    const authResult = await authenticateUser(request)
    if ('error' in authResult || !('user' in authResult)) {
      return authResult as NextResponse
    }
    const user = authResult.user

    const { id } = await params
    const { archived } = await request.json()

    // 检查文件夹是否存在且属于当前用户
    const existingFolder = await db.select().from(folders).where(eq(folders.id, id)).get()
    
    if (!existingFolder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    if (existingFolder.userId !== user.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // 更新归档状态
    const now = new Date().toISOString()
    await db
      .update(folders)
      .set({ 
        archived: archived,
        updatedAt: now 
      })
      .where(eq(folders.id, id))

    return NextResponse.json({ 
      success: true, 
      message: archived ? 'Folder archived successfully' : 'Folder restored successfully' 
    })

  } catch (error) {
    console.error('Error updating folder archive status:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
