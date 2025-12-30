import { NextRequest, NextResponse } from 'next/server';
import { db, tags } from '@/lib/db';
import { createLogger, generateTraceId } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { authenticateUser } from '@/lib/auth';

// PUT - 更新标签
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = generateTraceId();
  const logger = createLogger('tags.id.route', traceId);
  
  try {
    logger.info('Starting tag update API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { id } = await params;
    const userId = authResult.user.userId;
    
    // 解析请求体
    const body = await request.json();
    const { name, color, selectable } = body;
    
    // 验证必需字段
    if (!name || !color) {
      logger.warn('Missing required fields for tag update');
      return NextResponse.json(
        { error: 'Missing required fields: name, color' },
        { status: 400 }
      );
    }
    
    // 验证标签是否属于当前用户
    const existingTag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`${tags.id} = ${id} AND ${tags.userId} = ${userId}`)
      .limit(1);
    
    if (existingTag.length === 0) {
      logger.warn(`Tag with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }
    
    // 检查标签名称是否与其他标签重复
    const duplicateTag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`${tags.name} = ${name} AND ${tags.userId} = ${userId} AND ${tags.id} != ${id}`)
      .limit(1);
    
    if (duplicateTag.length > 0) {
      logger.warn('Tag name already exists');
      return NextResponse.json(
        { error: '标签名称已存在' },
        { status: 400 }
      );
    }
    
    // 更新标签
    const updateData = {
      name: name.trim(),
      color,
      selectable: selectable !== undefined ? selectable : true, // 如果没有提供selectable，默认为true
      updatedAt: new Date().toISOString()
    };
    
    await db.update(tags)
      .set(updateData)
      .where(sql`${tags.id} = ${id} AND ${tags.userId} = ${userId}`);
    
    logger.info(`Tag updated successfully {"tagId":"${id}"}`);
    
    return NextResponse.json({
      success: true,
      message: '标签更新成功'
    });
    
  } catch (error) {
    logger.error('Error in tag update API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 删除标签
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = generateTraceId();
  const logger = createLogger('tags.id.route', traceId);
  
  try {
    logger.info('Starting tag deletion API request');
    
    // 验证用户认证
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { id } = await params;
    const userId = authResult.user.userId;
    
    // 验证标签是否属于当前用户
    const existingTag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`${tags.id} = ${id} AND ${tags.userId} = ${userId}`)
      .limit(1);
    
    if (existingTag.length === 0) {
      logger.warn(`Tag with ID ${id} not found or not owned by user`);
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }
    
    // 删除标签
    await db.delete(tags)
      .where(sql`${tags.id} = ${id} AND ${tags.userId} = ${userId}`);
    
    logger.info(`Tag deleted successfully {"tagId":"${id}"}`);
    
    return NextResponse.json({
      success: true,
      message: '标签删除成功'
    });
    
  } catch (error) {
    logger.error('Error in tag deletion API: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
