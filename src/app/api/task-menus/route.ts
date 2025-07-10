import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/user';
import { createLoggerFromRequest } from '@/lib/logger';

export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id: userId } = getCurrentUser();
    
    await apiLogger.info('GET /api/task-menus request', { 
      userId,
      userAgent: 'server-side'
    });
    
    const taskMenus = db.prepare('SELECT * FROM task_menus WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    
    await apiLogger.info('Task menus fetched successfully', { 
      userId,
      count: taskMenus.length 
    });
    
    return NextResponse.json(taskMenus);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in GET /api/task-menus', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to fetch task menus' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { name } = await request.json();
    
    await apiLogger.info('POST /api/task-menus request', { 
      nameLength: name?.length,
      userAgent: request.headers.get('user-agent')
    });
    
    if (!name) {
      await apiLogger.warn('Invalid POST /api/task-menus request', { hasName: !!name });
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { id: userId } = getCurrentUser();
    const id = uuidv4();
    
    db.prepare(
      'INSERT INTO task_menus (id, name, user_id) VALUES (?, ?, ?)'
    ).run(id, name, userId);
    
    await apiLogger.info('Task menu created successfully', { 
      menuId: id,
      name,
      userId 
    });
    
    return NextResponse.json({ id, name, user_id: userId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in POST /api/task-menus', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to create task menu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id } = await request.json();
    
    await apiLogger.info('DELETE /api/task-menus request', { 
      menuId: id,
      userAgent: request.headers.get('user-agent')
    });
    
    if (!id) {
      await apiLogger.warn('Invalid DELETE /api/task-menus request', { hasId: !!id });
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { id: userId } = getCurrentUser();
    const result = db.prepare('DELETE FROM task_menus WHERE id = ? AND user_id = ?').run(id.toString(), userId);
    
    await apiLogger.info('Task menu deleted successfully', { 
      menuId: id,
      userId,
      changes: result.changes 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in DELETE /api/task-menus', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to delete task menu' }, { status: 500 });
  }
} 