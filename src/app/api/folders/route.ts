import { NextRequest, NextResponse } from 'next/server';
import { db, folders, tasks, taskSteps, taskFiles } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { Folder } from '@/lib/types';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('folders.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting folder creation API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    // 解析请求体
    const body = await request.json();
    const { name, color } = body;

    // 验证必需字段
    if (!name) {
      logger.warn('Missing required fields for folder creation');
      return NextResponse.json(
        { error: 'Missing required fields: name' },
        { status: 400 }
      );
    }

    // 使用认证用户的信息
    const userId = authResult.user.userId;

    // 创建新文件夹
    const now = new Date().toISOString();
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      color,
      userId,
      archived: false,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // 保存文件夹到数据库
    await db.insert(folders).values({
      id: newFolder.id,
      name: newFolder.name,
      color: newFolder.color,
      userId: newFolder.userId,
      archived: newFolder.archived,
      createdAt: newFolder.createdAt.toISOString(),
      updatedAt: newFolder.updatedAt.toISOString()
    });

    // 使用用户信息创建新的logger
    const userLogger = createLogger('folders.route', traceId, {
      userId: userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Folder created successfully {"folderId":"${newFolder.id}","name":"${name}"}`);
    
    return NextResponse.json({
      folder: newFolder,
      message: 'Folder created successfully',
      success: true
    }, { status: 201 });

  } catch (error) {
    logger.error('Error in folder creation API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('folders.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting folder retrieval API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const archived = searchParams.get('archived');
    const userId = searchParams.get('userId');

    let folderQuery;

    if (id) {
      // 根据ID查询文件夹（只返回当前用户的文件夹）
      folderQuery = await db.select().from(folders).where(sql`${folders.id} = ${id} AND ${folders.userId} = ${authResult.user.userId}`).limit(1);
    } else if (archived === 'true' && userId === authResult.user.userId) {
      // 获取归档的文件夹，按更新时间倒序排序
      folderQuery = await db.select().from(folders).where(sql`${folders.userId} = ${authResult.user.userId} AND ${folders.archived} = 1`).orderBy(sql`${folders.updatedAt} DESC`);
    } else {
      // 获取当前用户的所有非归档文件夹
      folderQuery = await db.select().from(folders).where(sql`${folders.userId} = ${authResult.user.userId} AND (${folders.archived} = 0 OR ${folders.archived} IS NULL)`);
    }

    // 使用用户信息创建新的logger
    const userLogger = createLogger('folders.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Folders retrieved successfully {"count":${folderQuery.length}}`);
    
    return NextResponse.json({
      folders: folderQuery,
      count: folderQuery.length,
      success: true
    });

  } catch (error) {
    logger.error('Error in folder retrieval API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('folders.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting folder update API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 解析请求体
    const body = await request.json();
    const { id, name, color } = body;

    // 验证必需字段
    if (!id) {
      logger.warn('Missing required field for folder update: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 验证文件夹是否属于当前用户
    const folder = await db.select().from(folders).where(sql`${folders.id} = ${id} AND ${folders.userId} = ${authResult.user.userId}`).limit(1);
    if (folder.length === 0) {
      logger.warn(`Folder with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // 更新文件夹
    const now = new Date().toISOString();
    const updateData: Record<string, string> = {
      updatedAt: now
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (color !== undefined) {
      updateData.color = color;
    }

    await db.update(folders)
      .set(updateData)
      .where(sql`${folders.id} = ${id} AND ${folders.userId} = ${authResult.user.userId}`);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('folders.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Folder updated successfully {"folderId":"${id}"}`);
    
    return NextResponse.json({
      message: 'Folder updated successfully',
      success: true
    });

  } catch (error) {
    logger.error('Error in folder update API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('folders.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting folder deletion API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      logger.warn('Missing required field for folder deletion: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 验证文件夹是否属于当前用户
    const folder = await db.select().from(folders).where(sql`${folders.id} = ${id} AND ${folders.userId} = ${authResult.user.userId}`).limit(1);
    if (folder.length === 0) {
      logger.warn(`Folder with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // 获取该文件夹下的所有任务ID
    const folderTasks = await db.select({ id: tasks.id }).from(tasks).where(sql`${tasks.folderId} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`);
    const taskIds = folderTasks.map(task => task.id);

    // 如果有任务，先删除相关的任务步骤和任务文件
    if (taskIds.length > 0) {
      // 删除任务步骤 - 使用更安全的方法
      for (const taskId of taskIds) {
        await db.delete(taskSteps).where(sql`${taskSteps.taskId} = ${taskId}`);
      }
      
      // 删除任务文件 - 使用更安全的方法
      for (const taskId of taskIds) {
        await db.delete(taskFiles).where(sql`${taskFiles.taskId} = ${taskId}`);
      }
      
      // 删除任务
      await db.delete(tasks).where(sql`${tasks.folderId} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`);
    }

    // 删除文件夹
    await db.delete(folders).where(sql`${folders.id} = ${id} AND ${folders.userId} = ${authResult.user.userId}`);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('folders.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Folder deleted successfully {"folderId":"${id}","deletedTasks":${taskIds.length}}`);
    
    return NextResponse.json({
      message: 'Folder deleted successfully',
      deletedTasks: taskIds.length,
      success: true
    });

  } catch (error) {
    logger.error('Error in folder deletion API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 