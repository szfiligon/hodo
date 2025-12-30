import { NextRequest, NextResponse } from 'next/server';
import { db, tasks } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser } from '@/lib/auth';

// POST - 添加标签到任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = generateTraceId();
  const logger = createLogger('tasks.tags.route', traceId);
  
  try {
    logger.info('Starting add tag to task API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { id: taskId } = await params;
    const userId = authResult.user.userId;
    
    // 解析请求体
    const body = await request.json();
    const { tagId } = body;
    
    // 验证必需字段
    if (!tagId) {
      logger.warn('Missing required field: tagId');
      return NextResponse.json(
        { error: 'Missing required field: tagId' },
        { status: 400 }
      );
    }
    
    // 验证任务是否属于当前用户
    const task = await db
      .select({ id: tasks.id, tags: tasks.tags })
      .from(tasks)
      .where(sql`${tasks.id} = ${taskId} AND ${tasks.userId} = ${userId}`)
      .limit(1);
    
    if (task.length === 0) {
      logger.warn(`Task with ID ${taskId} not found or not owned by user`);
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }
    
    const currentTags = task[0].tags ? task[0].tags.split(',').filter(t => t.trim()) : [];
    
    // 检查标签是否已经存在
    if (currentTags.includes(tagId)) {
      logger.warn(`Tag ${tagId} already exists in task ${taskId}`);
      return NextResponse.json(
        { error: '标签已存在' },
        { status: 400 }
      );
    }
    
    // 添加新标签
    const newTags = [...currentTags, tagId];
    const tagsString = newTags.join(',');
    
    await db.update(tasks)
      .set({ 
        tags: tagsString,
        updatedAt: new Date().toISOString()
      })
      .where(sql`${tasks.id} = ${taskId} AND ${tasks.userId} = ${userId}`);
    
    logger.info(`Tag added to task successfully {"taskId":"${taskId}","tagId":"${tagId}"}`);
    
    return NextResponse.json({
      success: true,
      message: '标签添加成功',
      tags: newTags
    });
    
  } catch (error) {
    logger.error('Error in add tag to task API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
