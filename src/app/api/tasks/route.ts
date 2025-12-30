import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, folders } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { Task } from '@/lib/types';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

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
    const body = await request.json();
    const { title, folderId } = body;

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
      startDate: new Date(), // 自动设置为当前日期
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
      startDate: newTask.startDate ? newTask.startDate.toISOString() : null,
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
    const sortedTasks = taskQuery.sort((a, b) => {
      // 首先按完成状态分组：未完成的任务在前，已完成的任务在后
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // 对于未完成的任务：按到期时间倒序，然后按创建时间倒序
      if (!a.completed && !b.completed) {
        // 如果都有到期日，按到期日倒序
        if (a.dueDate && b.dueDate) {
          const dueDateComparison = new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
          if (dueDateComparison !== 0) {
            return dueDateComparison;
          }
        }
        // 如果只有一个有到期日，有到期日的排在前面
        if (a.dueDate && !b.dueDate) {
          return -1;
        }
        if (!a.dueDate && b.dueDate) {
          return 1;
        }
        // 如果都没有到期日或到期日相同，按创建时间倒序
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      // 对于已完成的任务：不考虑置顶状态，直接按更新时间倒序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 转换布尔值和日期字段
    const tasksWithBoolean = sortedTasks.map(task => ({
      ...task,
      completed: Boolean(task.completed),
      isTodayTask: Boolean(task.isTodayTask),
      startDate: task.startDate ? new Date(task.startDate) : undefined,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined
    }));

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

    // 对今日任务进行排序
    const sortedTodayTasks = todayTasks.sort((a, b) => {
      // 首先按完成状态分组：未完成的任务在前，已完成的任务在后
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // 对于未完成的任务：按到期时间倒序，然后按创建时间倒序
      if (!a.completed && !b.completed) {
        // 如果都有到期日，按到期日倒序
        if (a.dueDate && b.dueDate) {
          const dueDateComparison = new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
          if (dueDateComparison !== 0) {
            return dueDateComparison;
          }
        }
        // 如果只有一个有到期日，有到期日的排在前面
        if (a.dueDate && !b.dueDate) {
          return 1;
        }
        if (!a.dueDate && b.dueDate) {
          return -1;
        }
        // 如果都没有到期日或到期日相同，按创建时间倒序
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      // 对于已完成的任务：不考虑置顶状态，直接按更新时间倒序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 转换布尔值
    const tasksWithBoolean = sortedTodayTasks.map(task => ({
      ...task,
      completed: Boolean(task.completed),
      isTodayTask: Boolean(task.isTodayTask),
      startDate: task.startDate ? new Date(task.startDate) : undefined,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined
    }));
    
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
    const body = await request.json();
    const { id, title, completed, notes, isToday, startDate, dueDate, folderId, tags } = body;

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
    const updateData: Record<string, string | number> = {
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

    if (startDate !== undefined) {
      updateData.startDate = startDate;
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate;
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
      task: updatedTask[0] ? {
        ...updatedTask[0],
        completed: Boolean(updatedTask[0].completed),
        isTodayTask: Boolean(updatedTask[0].isTodayTask)
      } : null,
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