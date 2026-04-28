import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, folders, taskSteps } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { Task } from '@/lib/types';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

type TaskRecord = {
  id: string;
  title: string;
  completed: boolean;
  folderId: string;
  userId: string;
  notes?: string;
  isTodayTask: boolean;
  tags?: string;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeTaskRecord(record: Record<string, unknown>): TaskRecord {
  return {
    id: String(record.id),
    title: String(record.title),
    completed: Boolean(record.completed),
    folderId: String(record.folderId),
    userId: String(record.userId),
    notes: typeof record.notes === 'string' ? record.notes : '',
    isTodayTask: Boolean(record.isTodayTask),
    tags: typeof record.tags === 'string' ? record.tags : undefined,
    createdAt: new Date(String(record.createdAt)),
    updatedAt: new Date(String(record.updatedAt)),
  };
}

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('tasks.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task creation API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 解析请求体
    const body: unknown = await request.json();
    const title =
      typeof (body as { title?: unknown })?.title === 'string'
        ? (body as { title: string }).title
        : '';
    const folderId =
      typeof (body as { folderId?: unknown })?.folderId === 'string'
        ? (body as { folderId: string }).folderId
        : '';

    // 验证必需字段
    if (!title || !folderId) {
      logger.warn('Missing required fields for task creation');
      return NextResponse.json(
        { error: 'Missing required fields: title, folderId' },
        { status: 400 }
      );
    }

    // 使用认证用户的信息
    const userId = authResult.user.userId;

    // 创建新任务
    const now = new Date().toISOString();
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      folderId,
      userId,
      notes: '',
      isTodayTask: false,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // 保存任务到数据库
    await db.insert(tasks).values({
      id: newTask.id,
      title: newTask.title,
      completed: !!newTask.completed,
      folderId: newTask.folderId,
      userId: newTask.userId,
      notes: newTask.notes,
      isTodayTask: !!newTask.isTodayTask,
      tags: newTask.tags || null,
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString()
    });

    // 使用用户信息创建新的logger
    const userLogger = createLogger('tasks.route', traceId, {
      userId: userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task created successfully {"taskId":"${newTask.id}","title":"${title}"}`);
    
    return NextResponse.json({
      task: newTask,
      message: 'Task created successfully',
      success: true
    }, { status: 201 });

  } catch (error) {
    logger.error('Error in task creation API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('tasks.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task retrieval API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const id = searchParams.get('id');

    let taskQuery;

    if (id) {
      // 根据ID查询任务（只返回当前用户的任务）
      taskQuery = await db.select().from(tasks).where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`).limit(1);
    } else if (folderId) {
      // 根据文件夹ID查询任务（只返回当前用户的任务）
      taskQuery = await db.select().from(tasks).where(sql`${tasks.folderId} = ${folderId} AND ${tasks.userId} = ${authResult.user.userId}`);
    } else {
      // 获取当前用户的所有任务
      taskQuery = await db.select().from(tasks).where(sql`${tasks.userId} = ${authResult.user.userId}`);
    }

    // 对任务进行排序
    const normalizedTasks = taskQuery.map(task => normalizeTaskRecord(task as Record<string, unknown>));

    const sortedTasks = normalizedTasks.sort((a, b) => {
      // 首先按完成状态分组：未完成的任务在前，已完成的任务在后
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // 对于未完成的任务：按创建时间倒序
      if (!a.completed && !b.completed) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      // 对于已完成的任务：不考虑置顶状态，直接按更新时间倒序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 转换布尔值和日期字段
    const tasksWithBoolean = sortedTasks;

    // 使用用户信息创建新的logger
    const userLogger = createLogger('tasks.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Tasks retrieved successfully {"count":${tasksWithBoolean.length}}`);
    
    return NextResponse.json({
      tasks: tasksWithBoolean,
      count: tasksWithBoolean.length,
      success: true
    });

  } catch (error) {
    logger.error('Error in task retrieval API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET_TODAY(request: NextRequest) {
  const traceId = generateTraceId();
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('tasks.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting today task retrieval API request');
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 查询当前用户的所有今日任务
    const todayTasks = await db.select().from(tasks).where(sql`${tasks.isTodayTask} = 1 AND ${tasks.userId} = ${authResult.user.userId}`);

    // 对今日任务进行过滤：已完成任务仅保留“今天更新”的
    const normalizedTodayTasks = todayTasks.map(task => normalizeTaskRecord(task as Record<string, unknown>));
    const now = new Date()
    const filteredTodayTasks = normalizedTodayTasks.filter((task) => {
      if (!task.completed) return true
      const updatedAt = new Date(task.updatedAt)
      return (
        updatedAt.getFullYear() === now.getFullYear() &&
        updatedAt.getMonth() === now.getMonth() &&
        updatedAt.getDate() === now.getDate()
      )
    })

    const sortedTodayTasks = filteredTodayTasks.sort((a, b) => {
      // 首先按完成状态分组：未完成的任务在前，已完成的任务在后
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // 对于未完成的任务：按创建时间倒序
      if (!a.completed && !b.completed) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      // 对于已完成的任务：不考虑置顶状态，直接按更新时间倒序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 转换布尔值
    const tasksWithBoolean = sortedTodayTasks;
    
    logger.info(`Today tasks retrieved successfully {"count":${tasksWithBoolean.length}}`);
    return NextResponse.json({
      tasks: tasksWithBoolean,
      count: tasksWithBoolean.length,
      success: true
    });
  } catch (error) {
    logger.error('Error in today task retrieval API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('tasks.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task update API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 解析请求体
    const body: unknown = await request.json();
    const id =
      typeof (body as { id?: unknown })?.id === 'string'
        ? (body as { id: string }).id
        : '';
    const title =
      typeof (body as { title?: unknown })?.title === 'string'
        ? (body as { title: string }).title
        : undefined;
    const completed =
      typeof (body as { completed?: unknown })?.completed === 'boolean'
        ? (body as { completed: boolean }).completed
        : undefined;
    const notes =
      typeof (body as { notes?: unknown })?.notes === 'string'
        ? (body as { notes: string }).notes
        : undefined;
    const isToday =
      typeof (body as { isToday?: unknown })?.isToday === 'boolean'
        ? (body as { isToday: boolean }).isToday
        : undefined;
    const folderId =
      typeof (body as { folderId?: unknown })?.folderId === 'string'
        ? (body as { folderId: string }).folderId
        : undefined;
    const tags =
      typeof (body as { tags?: unknown })?.tags === 'string'
        ? (body as { tags: string }).tags
        : undefined;

    // 验证必需字段
    if (!id) {
      logger.warn('Missing required field for task update: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 更新任务
    const now = new Date().toISOString();
    const updateData: Record<string, string | number | null> = {
      updatedAt: now
    };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (completed !== undefined) {
      updateData.completed = completed ? 1 : 0;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (isToday !== undefined) {
      updateData.isTodayTask = isToday ? 1 : 0;
    }

    if (folderId !== undefined) {
      // 验证目标文件夹是否属于当前用户
      const targetFolder = await db.select().from(folders).where(sql`${folders.id} = ${folderId} AND ${folders.userId} = ${authResult.user.userId}`).limit(1);
      if (targetFolder.length === 0) {
        logger.warn(`Target folder with ID ${folderId} not found or not owned by user`);
        return NextResponse.json(
          { error: 'Target folder not found' },
          { status: 404 }
        );
      }
      updateData.folderId = folderId;
    }

    if (tags !== undefined) {
      updateData.tags = tags;
    }

    // 验证任务是否属于当前用户
    const task = await db.select().from(tasks).where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`).limit(1);
    if (task.length === 0) {
      logger.warn(`Task with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    await db.update(tasks)
      .set(updateData)
      .where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`);

    // Get the updated task to return in response
    const updatedTask = await db.select().from(tasks).where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`).limit(1);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('tasks.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task updated successfully {"taskId":"${id}"}`);
    
    return NextResponse.json({
      message: 'Task updated successfully',
      task: updatedTask[0]
        ? normalizeTaskRecord(updatedTask[0] as Record<string, unknown>)
        : null,
      success: true
    });

  } catch (error) {
    logger.error('Error in task update API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('tasks.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task deletion API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      logger.warn('Missing required field for task deletion: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 验证任务是否属于当前用户
    const task = await db.select().from(tasks).where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`).limit(1);
    if (task.length === 0) {
      logger.warn(`Task with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // 先删除任务步骤，再删除任务，避免孤儿数据
    await db.delete(taskSteps).where(sql`${taskSteps.taskId} = ${id}`);

    // 删除任务
    await db.delete(tasks).where(sql`${tasks.id} = ${id} AND ${tasks.userId} = ${authResult.user.userId}`);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('tasks.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task deleted successfully {"taskId":"${id}"}`);
    
    return NextResponse.json({
      message: 'Task deleted successfully',
      success: true
    });

  } catch (error) {
    logger.error('Error in task deletion API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 