import { NextRequest, NextResponse } from 'next/server';
import { db, tags } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser } from '@/lib/auth';

// GET - 获取标签列表
export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const logger = createLogger('tags.route', traceId);
  
  try {
    logger.info('Starting tags retrieval API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const userId = authResult.user.userId;
    
    // 查询所有标签
    const tagsList = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        selectable: tags.selectable,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .where(sql`${tags.userId} = ${userId}`)
      .orderBy(sql`${tags.color} ASC, ${tags.name} DESC`);
    
    logger.info(`Tags retrieved successfully {"count":${tagsList.length}}`);
    
    return NextResponse.json({
      success: true,
      data: {
        tags: tagsList
      }
    });
    
  } catch (error) {
    logger.error('Error in tags retrieval API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 创建新标签
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const logger = createLogger('tags.route', traceId);
  
  try {
    logger.info('Starting tag creation API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // 解析请求体
    const body = await request.json();
    const { name, color, selectable = true } = body;
    
    // 验证必需字段
    if (!name || !color) {
      logger.warn('Missing required fields for tag creation');
      return NextResponse.json(
        { error: 'Missing required fields: name, color' },
        { status: 400 }
      );
    }
    
    const userId = authResult.user.userId;
    
    // 检查标签名称是否已存在
    const existingTag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`${tags.name} = ${name} AND ${tags.userId} = ${userId}`)
      .limit(1);
    
    if (existingTag.length > 0) {
      logger.warn('Tag name already exists');
      return NextResponse.json(
        { error: '标签名称已存在' },
        { status: 400 }
      );
    }
    
    // 创建新标签
    const now = new Date().toISOString();
    const newTag = {
      id: Date.now().toString(),
      name: name.trim(),
      color,
      selectable,
      userId,
      createdAt: now,
      updatedAt: now
    };
    
    // 保存标签到数据库
    await db.insert(tags).values(newTag);
    
    logger.info(`Tag created successfully {"tagId":"${newTag.id}","name":"${newTag.name}"}`);
    
    return NextResponse.json({
      success: true,
      tag: newTag
    });
    
  } catch (error) {
    logger.error('Error in tag creation API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
