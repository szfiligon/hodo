import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, taskSteps, tags } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  
  // 尝试从请求中提取用户信息
  const userInfo = extractUserFromRequest(request);
  const logger = createLogger('search.route', traceId, userInfo || undefined);

  try {
    logger.info('Starting search API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    // 不再限制条数

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        results: [],
        count: 0,
        success: true
      });
    }

    const searchQuery = query.trim();
    const userId = authResult.user.userId;

    // 先搜索匹配的标签ID
    const matchingTags = await db.select({
      id: tags.id
    })
    .from(tags)
    .where(sql`${tags.userId} = ${userId} AND ${tags.name} LIKE ${`%${searchQuery}%`}`);

    const matchingTagIds = matchingTags.map(tag => tag.id);
    
    logger.info(`Found ${matchingTags.length} matching tags for query "${searchQuery}": ${matchingTagIds.join(', ')}`);
    
    // 构建标签搜索条件
    let tagSearchCondition = sql`FALSE`;
    if (matchingTagIds.length > 0) {
      const tagConditions = matchingTagIds.map(tagId => 
        sql`(${tasks.tags} IS NOT NULL AND ${tasks.tags} LIKE ${`%${tagId}%`})`
      );
      tagSearchCondition = tagConditions.reduce((acc, condition) => sql`${acc} OR ${condition}`);
    }
    
    // 使用SQLite的LIKE操作符进行模糊搜索
    // 搜索任务标题、备注和标签名称
    const taskResults = await db.select({
      id: tasks.id,
      title: tasks.title,
      type: sql`'task'`.as('type'),
      completed: tasks.completed,
      folderId: tasks.folderId,
      notes: tasks.notes,
      tags: tasks.tags,
      createdAt: tasks.createdAt
    })
    .from(tasks)
    .where(sql`${tasks.userId} = ${userId} AND (
      ${tasks.title} LIKE ${`%${searchQuery}%`} OR 
      (${tasks.notes} IS NOT NULL AND ${tasks.notes} LIKE ${`%${searchQuery}%`}) OR
      ${tagSearchCondition}
    )`)
    .orderBy(sql`${tasks.createdAt} DESC`);

    // 搜索任务步骤标题
    const stepResults = await db.select({
      id: taskSteps.id,
      title: taskSteps.title,
      type: sql`'step'`.as('type'),
      completed: taskSteps.completed,
      taskId: taskSteps.taskId,
      createdAt: taskSteps.createdAt
    })
    .from(taskSteps)
    .innerJoin(tasks, sql`${taskSteps.taskId} = ${tasks.id}`)
    .where(sql`${tasks.userId} = ${userId} AND ${taskSteps.title} LIKE ${`%${searchQuery}%`}`)
    .orderBy(sql`${taskSteps.createdAt} DESC`);

    // 合并结果并按相关性排序（简单的按创建时间倒序）
    const allResults = [...taskResults, ...stepResults]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logger.info(`Search results: ${taskResults.length} tasks, ${stepResults.length} steps, total: ${allResults.length}`);

    // 转换布尔值
    const resultsWithBoolean = allResults.map(result => ({
      ...result,
      completed: Boolean(result.completed)
    }));

    // 使用用户信息创建新的logger
    const userLogger = createLogger('search.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Search completed successfully {"query":"${searchQuery}","count":${resultsWithBoolean.length}}`);
    
    return NextResponse.json({
      results: resultsWithBoolean,
      count: resultsWithBoolean.length,
      success: true
    });

  } catch (error) {
    logger.error('Error in search API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 