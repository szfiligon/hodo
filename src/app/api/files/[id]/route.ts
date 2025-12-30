import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { db, taskFiles, tasks } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { createRequestLogger } from '@/lib/request-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  const { logger } = createRequestLogger('files.route', request)
  try {
    logger.info(`Starting file download API request {"fileId":"${fileId}"}`)
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      logger.warn('No authentication token provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      logger.warn('Invalid token provided')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = decoded.userId

    // Get file record
    const fileRecord = await db.select().from(taskFiles).where(eq(taskFiles.id, fileId)).limit(1)
    if (fileRecord.length === 0) {
      logger.warn(`File not found {"fileId":"${fileId}"}`)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileRecord[0]

    // Verify task belongs to user
    const task = await db.select().from(tasks).where(
      and(eq(tasks.id, file.taskId), eq(tasks.userId, userId))
    ).limit(1)

    if (task.length === 0) {
      logger.warn(`Task not found or not owned by user {"taskId":"${file.taskId}","userId":"${userId}"}`)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if file exists in storage
    if (!existsSync(file.filePath)) {
      logger.warn(`File not found in storage {"filePath":"${file.filePath}"}`)
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    // Get actual file stats to ensure accurate size
    let actualFileSize: number
    try {
      const fileStats = await stat(file.filePath)
      actualFileSize = fileStats.size
      logger.info(`File stats retrieved {"filePath":"${file.filePath}","actualSize":${actualFileSize},"dbSize":${file.fileSize}}`)
    } catch (statError) {
      logger.warn(`Failed to get file stats, using database size {"filePath":"${file.filePath}","error":"${statError}"}`)
      actualFileSize = file.fileSize
    }

    // Read file from storage
    const fileBuffer = await readFile(file.filePath)
    
    // Verify buffer size matches expected size
    if (fileBuffer.length !== actualFileSize) {
      logger.warn(`File size mismatch {"filePath":"${file.filePath}","expectedSize":${actualFileSize},"actualSize":${fileBuffer.length}}`)
      // Use the actual buffer size instead of the expected size
      actualFileSize = fileBuffer.length
    }

    // Return file with accurate headers
    logger.info(
      `File download successful {"fileId":"${fileId}","originalName":"${file.originalName}","mimeType":"${file.mimeType}","fileSize":${actualFileSize}}`
    )
    
    // Create response with proper headers
    const response = new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        'Content-Length': actualFileSize.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    })
    
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Error in file download API: ' + message, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 