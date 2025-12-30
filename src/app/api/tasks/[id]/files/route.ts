import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { db, tasks, taskFiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getTaskUploadsPath } from '@/lib/server-utils'
import { createRequestLogger } from '@/lib/request-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { logger } = createRequestLogger('tasks.files.route', request)
    logger.info('Starting task file upload API request')
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

    const { id: taskId } = await params
    const userId = decoded.userId

    logger.info(`File upload request received {"taskId":"${taskId}","userId":"${userId}"}`)

    // Verify task exists and belongs to user
    const task = await db.select().from(tasks).where(
      and(eq(tasks.id, taskId), eq(tasks.userId, userId))
    ).limit(1)

    if (task.length === 0) {
      logger.warn(`Task not found or not owned by user {"taskId":"${taskId}","userId":"${userId}"}`)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Parse JSON body for base64 file upload
    const body = await request.json()
    const { fileName, fileData, fileType, fileSize } = body

    if (!fileName || !fileData || !fileType) {
      logger.warn('Missing required file information')
      return NextResponse.json({ error: 'Missing required file information' }, { status: 400 })
    }

    // Validate file size (30MB limit)
    const maxSize = 30 * 1024 * 1024 // 30MB
    if (fileSize > maxSize) {
      logger.warn(`File too large {"size":${fileSize},"max":${maxSize}}`)
      return NextResponse.json({ error: 'File too large. Maximum size is 30MB' }, { status: 400 })
    }

    // File type validation removed - now supports all file types
    logger.info(`File type accepted: ${fileType}`)

    logger.info(`File info {"name":"${fileName}","size":${fileSize},"type":"${fileType}"}`)

    // Get task uploads directory in APPDATA
    const taskUploadsDir = getTaskUploadsPath(userId, taskId)
    logger.debug(`Task uploads directory set {"dir":"${taskUploadsDir}"}`)

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = fileName ? fileName.split('.').pop() || '' : ''
    const uniqueFileName = `${timestamp}_${Math.random().toString(36).substring(2)}${fileExtension ? '.' + fileExtension : ''}`
    const filePath = join(taskUploadsDir, uniqueFileName)
    logger.debug(`Resolved file path {"filePath":"${filePath}"}`)

    // Convert base64 to buffer and save file with better error handling
    try {
      // 现在接收的是纯base64数据，不需要移除data URL前缀
      let base64Data = fileData
      
      // 如果仍然包含data URL前缀，则移除它（向后兼容）
      if (fileData.includes('data:')) {
        base64Data = fileData.replace(/^data:[^;]+;base64,/, '')
      }
      
      // Validate base64 string
      if (!base64Data || base64Data.length === 0) {
        logger.warn('Invalid base64 data')
        return NextResponse.json({ error: 'Invalid file data' }, { status: 400 })
      }
      
      // Check if base64 string is valid
      let buffer: Buffer
      try {
        buffer = Buffer.from(base64Data, 'base64')
      } catch {
        logger.warn('Invalid base64 format')
        return NextResponse.json({ error: 'Invalid file format' }, { status: 400 })
      }
      
      // Verify buffer size
      if (buffer.length === 0) {
        logger.warn('Empty file buffer')
        return NextResponse.json({ error: 'Empty file' }, { status: 400 })
      }
      
      // 验证实际文件大小与声明的文件大小是否匹配
      const actualSize = buffer.length
      const declaredSize = fileSize
      
      logger.info(`File size validation {"declared":${declaredSize},"actual":${actualSize},"difference":${Math.abs(declaredSize - actualSize)}}`)
      
      // 如果大小差异超过1KB，记录警告但继续处理
      if (Math.abs(declaredSize - actualSize) > 1024) {
        logger.warn(`File size mismatch detected {"declared":${declaredSize},"actual":${actualSize}}`)
      }
      
      // 使用实际的文件大小保存到数据库
      const finalFileSize = actualSize
      
      await writeFile(filePath, buffer)
      logger.info(`File saved to storage successfully {"path":"${filePath}","size":${finalFileSize}}`)
      
      // Save file record to database with actual file size
      const fileId = `${Date.now()}_${Math.random().toString(36).substring(2)}`
      const [newFile] = await db.insert(taskFiles).values({
        id: fileId,
        taskId,
        fileName: uniqueFileName,
        originalName: fileName,
        fileSize: finalFileSize, // 使用实际文件大小
        mimeType: fileType,
        filePath: filePath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).returning()

      logger.info(
        `File record saved to database {"fileId":"${fileId}","taskId":"${taskId}","originalName":"${fileName}","fileName":"${uniqueFileName}","fileSize":${finalFileSize}}`
      )

      logger.info(`File upload successful {"fileId":"${fileId}"}`)
      return NextResponse.json(newFile, { status: 201 })
    } catch (base64Error) {
      logger.error('Error processing base64 data:', base64Error)
      return NextResponse.json({ error: 'Invalid file data format' }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { logger } = createRequestLogger('tasks.files.route', request)
    logger.error('Error uploading file: ' + message)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { logger } = createRequestLogger('tasks.files.route', request)
    logger.info('Starting task files list API request')
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

    const { id: taskId } = await params
    const userId = decoded.userId

    // Verify task exists and belongs to user
    const task = await db.select().from(tasks).where(
      and(eq(tasks.id, taskId), eq(tasks.userId, userId))
    ).limit(1)

    if (task.length === 0) {
      logger.warn(`Task not found or not owned by user {"taskId":"${taskId}","userId":"${userId}"}`)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get files for the task
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId))

    logger.info(`Task files retrieved successfully {"taskId":"${taskId}","count":${files.length}}`)
    return NextResponse.json(files)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { logger } = createRequestLogger('tasks.files.route', request)
    logger.error('Error getting files: ' + message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 