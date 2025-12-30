import { NextRequest, NextResponse } from 'next/server';
import { db, tasks } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser } from '@/lib/auth';

// DELETE - 从任务中移除标签
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const traceId = generateTraceId();
  const logger = createLogger('tasks.tags.tagId.route', traceId);
  
  try {
    logger.info('Starting remove tag from task API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { id: taskId, tagId } = await params;
    const userId = authResult.user.userId;
    
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
    
    // 检查标签是否存在
    if (!currentTags.includes(tagId)) {
      logger.warn(`Tag ${tagId} not found in task ${taskId}`);
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 400 }
      );
    }
    
    // 移除标签
    const newTags = currentTags.filter(t => t !== tagId);
    const tagsString = newTags.join(',');
    
    await db.update(tasks)
      .set({ 
        tags: tagsString,
        updatedAt: new Date().toISOString()
      })
      .where(sql`${tasks.id} = ${taskId} AND ${tasks.userId} = ${userId}`);
    
    logger.info(`Tag removed from task successfully {"taskId":"${taskId}","tagId":"${tagId}"}`);
    
    return NextResponse.json({
      success: true,
      message: '标签移除成功',
      tags: newTags
    });
    
  } catch (error) {
    logger.error('Error in remove tag from task API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
