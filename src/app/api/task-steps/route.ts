import { NextRequest, NextResponse } from 'next/server';
import { db, taskSteps, tasks } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { TaskStep } from '@/lib/types';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task step creation API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    
    // 解析请求体
    const body = await request.json();
    const { taskId, title } = body;

    // 验证必需字段
    if (!taskId || !title) {
      logger.warn('Missing required fields for task step creation');
      return NextResponse.json(
        { error: 'Missing required fields: taskId, title' },
        { status: 400 }
      );
    }

    // 验证任务是否属于当前用户
    const task = await db.select().from(tasks).where(sql`${tasks.id} = ${taskId} AND ${tasks.userId} = ${authResult.user.userId}`).limit(1);
    if (task.length === 0) {
      logger.warn(`Task with ID ${taskId} not found or not owned by user`);
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // 获取当前任务的最大排序号
    const maxOrderResult = await db.select({ maxOrder: sql`MAX("order")` })
      .from(taskSteps)
      .where(sql`${taskSteps.taskId} = ${taskId}`);
    
    const nextOrder = (Number(maxOrderResult[0]?.maxOrder) || 0) + 1;

    // 创建新步骤
    const now = new Date().toISOString();
    const newStep: TaskStep = {
      id: Date.now().toString(),
      taskId,
      title,
      completed: false,
      order: nextOrder,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // 保存步骤到数据库
    await db.insert(taskSteps).values({
      id: newStep.id,
      taskId: newStep.taskId,
      title: newStep.title,
      completed: !!newStep.completed, // 保证为布尔值
      order: Number(newStep.order), // 保证为 number
      createdAt: newStep.createdAt.toISOString(),
      updatedAt: newStep.updatedAt.toISOString()
    });

    // 使用用户信息创建新的logger
    const userLogger = createLogger('task-steps.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task step created successfully {"stepId":"${newStep.id}","title":"${title}","taskId":"${taskId}"}`);
    
    return NextResponse.json({
      step: newStep,
      message: 'Task step created successfully',
      success: true
    }, { status: 201 });

  } catch (error) {
    logger.error('Error in task step creation API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task step retrieval API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const id = searchParams.get('id');

    let stepQuery;

    if (id) {
      // 根据ID查询步骤
      stepQuery = await db.select().from(taskSteps).where(sql`${taskSteps.id} = ${id}`).limit(1);
    } else if (taskId) {
      // 根据任务ID查询步骤
      stepQuery = await db.select().from(taskSteps)
        .where(sql`${taskSteps.taskId} = ${taskId}`)
        .orderBy(sql`"order" ASC`);
    } else {
      // 获取所有步骤
      stepQuery = await db.select().from(taskSteps).orderBy(sql`"order" ASC`);
    }

    // 转换布尔值
    const stepsWithBoolean = stepQuery.map(step => ({
      ...step,
      completed: Boolean(step.completed)
    }));

    // 使用用户信息创建新的logger
    const userLogger = createLogger('task-steps.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task steps retrieved successfully {"count":${stepsWithBoolean.length}}`);
    
    return NextResponse.json({
      steps: stepsWithBoolean,
      count: stepsWithBoolean.length,
      success: true
    });

  } catch (error) {
    logger.error('Error in task step retrieval API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task step update API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    
    // 解析请求体
    const body = await request.json();
    const { id, title, completed, order } = body;

    // 验证必需字段
    if (!id) {
      logger.warn('Missing required field for task step update: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 更新步骤
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

    if (order !== undefined) {
      updateData.order = order;
    }

    await db.update(taskSteps)
      .set(updateData)
      .where(sql`${taskSteps.id} = ${id}`);

    // Get the updated step to return in response
    const updatedStep = await db.select().from(taskSteps).where(sql`${taskSteps.id} = ${id}`).limit(1);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('task-steps.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task step updated successfully {"stepId":"${id}"}`);
    
    return NextResponse.json({
      message: 'Task step updated successfully',
      step: updatedStep[0] ? {
        ...updatedStep[0],
        completed: Boolean(updatedStep[0].completed)
      } : null,
      success: true
    });

  } catch (error) {
    logger.error('Error in task step update API: ' + (error instanceof Error ? error.message : String(error)), error);
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
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting task step deletion API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      logger.warn('Missing required field for task step deletion: id');
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // 删除步骤
    await db.delete(taskSteps).where(sql`${taskSteps.id} = ${id}`);

    // 使用用户信息创建新的logger
    const userLogger = createLogger('task-steps.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Task step deleted successfully {"stepId":"${id}"}`);
    
    return NextResponse.json({
      message: 'Task step deleted successfully',
      success: true
    });

  } catch (error) {
    logger.error('Error in task step deletion API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 