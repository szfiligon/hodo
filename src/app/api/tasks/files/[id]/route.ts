import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { db, taskFiles, tasks } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { id: fileId } = await params
    const userId = decoded.userId

    // Get file record
    const fileRecord = await db.select().from(taskFiles).where(eq(taskFiles.id, fileId)).limit(1)
    if (fileRecord.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileRecord[0]

    // Verify task belongs to user
    const task = await db.select().from(tasks).where(
      and(eq(tasks.id, file.taskId), eq(tasks.userId, userId))
    ).limit(1)

    if (task.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Delete file from APPDATA directory
    if (existsSync(file.filePath)) {
      await unlink(file.filePath)
    }

    // Delete file record from database
    await db.delete(taskFiles).where(eq(taskFiles.id, fileId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 