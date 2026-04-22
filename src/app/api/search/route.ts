import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, tags, taskFiles } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser, extractUserFromRequest } from '@/lib/auth';
import { tokenizeSearchQuery } from '@/lib/search-tokenizer';

const isImageFile = (mimeType?: string | null, originalName?: string | null) => {
  const normalizedMimeType = String(mimeType || '').toLowerCase()
  if (normalizedMimeType.startsWith('image/')) return true

  const fileName = String(originalName || '').toLowerCase()
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  return imageExtensions.some((ext) => fileName.endsWith(ext))
}

const buildLikeWithTokensCondition = (field: unknown, normalizedQuery: string, tokens: string[]) => {
  const baseCondition = sql`${field} LIKE ${`%${normalizedQuery}%`}`
  if (tokens.length === 0) {
    return baseCondition
  }

  const tokenOrCondition = tokens
    .map((token) => sql`${field} LIKE ${`%${token}%`}`)
    .reduce((acc, condition) => sql`${acc} OR ${condition}`)

  return sql`(${baseCondition} OR (${tokenOrCondition}))`
}

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
    const mode = searchParams.get('mode') === 'media' ? 'media' : 'all';
    // 不再限制条数

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        results: [],
        count: 0,
        success: true
      });
    }

    const searchQuery = query.trim();
    const { normalizedQuery, tokens } = tokenizeSearchQuery(searchQuery)
    const userId = authResult.user.userId;

    logger.info(`Search tokenized query "${searchQuery}" => [${tokens.join(', ')}]`)

    const taskTitleCondition = buildLikeWithTokensCondition(tasks.title, normalizedQuery, tokens)
    const taskNotesCondition = sql`(${tasks.notes} IS NOT NULL AND ${buildLikeWithTokensCondition(tasks.notes, normalizedQuery, tokens)})`
    const tagNameCondition = buildLikeWithTokensCondition(tags.name, normalizedQuery, tokens)

    // 先搜索匹配的标签ID
    const matchingTags = await db
      .select()
      .from(tags)
      .where(sql`${tags.userId} = ${userId} AND ${tagNameCondition}`);

    const matchingTagIds = matchingTags.map(tag => String(tag.id));
    
    logger.info(`Found ${matchingTags.length} matching tags for query "${searchQuery}": ${matchingTagIds.join(', ')}`);
    
    // 构建标签搜索条件
    let tagSearchCondition = sql`FALSE`;
    if (matchingTagIds.length > 0) {
      const tagConditions = matchingTagIds.map(tagId => 
        sql`(${tasks.tags} IS NOT NULL AND ${tasks.tags} LIKE ${`%${tagId}%`})`
      );
      tagSearchCondition = tagConditions.reduce((acc, condition) => sql`${acc} OR ${condition}`);
    }
    
    // 搜索任务标题、备注和标签名称
    const taskResults = await db
      .select()
      .from(tasks)
      .where(sql`${tasks.userId} = ${userId} AND (
        ${taskTitleCondition} OR 
        ${taskNotesCondition} OR
        ${tagSearchCondition}
      )`)

    let resultsWithBoolean: Array<Record<string, unknown>> = []

    if (mode === 'all') {
      // 按创建时间倒序
      resultsWithBoolean = [...taskResults]
        .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
        .map((result) => ({
          id: String(result.id),
          title: String(result.title),
          type: 'task' as const,
          completed: Boolean(result.completed),
          folderId: String(result.folderId),
          notes: result.notes ? String(result.notes) : undefined,
          tags: result.tags ? String(result.tags) : undefined,
          createdAt: String(result.createdAt)
        }));

      logger.info(`Search results (all): ${taskResults.length} tasks`);
    } else {
      const userTasks = await db
        .select()
        .from(tasks)
        .where(sql`${tasks.userId} = ${userId}`);

      const userTaskMap = new Map(
        userTasks.map((task) => [String(task.id), task])
      );

      const userTaskIds = Array.from(userTaskMap.keys());
      let userTaskCondition = sql`FALSE`;
      if (userTaskIds.length > 0) {
        userTaskCondition = userTaskIds
          .map((taskId) => sql`${taskFiles.taskId} = ${taskId}`)
          .reduce((acc, condition) => sql`${acc} OR ${condition}`);
      }

      const allUserFiles = userTaskIds.length > 0
        ? await db
            .select()
            .from(taskFiles)
            .where(userTaskCondition)
        : [];

      const matchedTaskIdSet = new Set(taskResults.map((task) => String(task.id)));

      const mediaResults = allUserFiles
        .filter((file) => {
          const taskId = String(file.taskId);
          if (!userTaskMap.has(taskId)) return false;

          const fileName = String(file.originalName || '').toLowerCase();
          const matchesBaseFileName = fileName.includes(normalizedQuery);
          const matchesTokenizedFileName =
            tokens.length > 0 && tokens.some((token) => fileName.includes(token));
          const matchesFileName = matchesBaseFileName || matchesTokenizedFileName;
          return matchedTaskIdSet.has(taskId) || matchesFileName;
        })
        .map((file) => {
          const taskId = String(file.taskId);
          const task = userTaskMap.get(taskId);
          const mimeType = file.mimeType ? String(file.mimeType) : '';
          const originalName = file.originalName ? String(file.originalName) : '未命名文件';

          return {
            id: String(file.id),
            fileId: String(file.id),
            title: originalName,
            type: isImageFile(mimeType, originalName) ? 'image' as const : 'file' as const,
            taskId,
            taskTitle: task ? String(task.title) : undefined,
            folderId: task ? String(task.folderId) : undefined,
            mimeType: mimeType || undefined,
            fileSize: Number(file.fileSize || 0),
            createdAt: String(file.createdAt)
          };
        })
        .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());

      resultsWithBoolean = mediaResults;
      logger.info(`Search results (media): ${mediaResults.length} files`);
    }

    // 使用用户信息创建新的logger
    const userLogger = createLogger('search.route', traceId, {
      userId: authResult.user.userId,
      username: authResult.user.username
    });
    
    userLogger.info(`Search completed successfully {"query":"${searchQuery}","mode":"${mode}","count":${resultsWithBoolean.length}}`);
    
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