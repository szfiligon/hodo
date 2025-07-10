import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createLoggerFromRequest } from '@/lib/logger';

export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  await apiLogger.info('GET /api/task-steps request', { 
    taskId,
    userAgent: request.headers.get('user-agent')
  });

  if (!taskId) {
    await apiLogger.warn('Invalid GET /api/task-steps request', { hasTaskId: !!taskId });
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }

  const steps = db.prepare('SELECT * FROM task_steps WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
  
  await apiLogger.info('Task steps fetched successfully', { 
    taskId,
    count: steps.length 
  });
  
  return NextResponse.json(steps);
}

export async function POST(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { taskId, text } = await request.json();

    await apiLogger.info('POST /api/task-steps request', { 
      taskId,
      textLength: text?.length,
      userAgent: request.headers.get('user-agent')
    });

    if (!taskId || !text) {
      await apiLogger.warn('Invalid POST /api/task-steps request', { hasTaskId: !!taskId, hasText: !!text });
      return NextResponse.json({ error: 'Task ID and text are required' }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO task_steps (id, task_id, text)
      VALUES (?, ?, ?)
    `).run(id, taskId, text);

    const step = db.prepare('SELECT * FROM task_steps WHERE id = ?').get(id);
    
    await apiLogger.info('Task step created successfully', { 
      stepId: id,
      taskId,
      textLength: text.length 
    });
    
    return NextResponse.json(step);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in POST /api/task-steps', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to create task step' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id, completed } = await request.json();

    await apiLogger.info('PATCH /api/task-steps request', { 
      stepId: id,
      completed,
      userAgent: request.headers.get('user-agent')
    });

    if (id === undefined || completed === undefined) {
      await apiLogger.warn('Invalid PATCH /api/task-steps request', { hasId: id !== undefined, hasCompleted: completed !== undefined });
      return NextResponse.json({ error: 'ID and completed status are required' }, { status: 400 });
    }

    const result = db.prepare('UPDATE task_steps SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
    
    await apiLogger.info('Task step updated successfully', { 
      stepId: id,
      completed,
      changes: result.changes 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in PATCH /api/task-steps', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to update task step' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id } = await request.json();

    await apiLogger.info('DELETE /api/task-steps request', { 
      stepId: id,
      userAgent: request.headers.get('user-agent')
    });

    if (!id) {
      await apiLogger.warn('Invalid DELETE /api/task-steps request', { hasId: !!id });
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const result = db.prepare('DELETE FROM task_steps WHERE id = ?').run(id.toString());
    
    await apiLogger.info('Task step deleted successfully', { 
      stepId: id,
      changes: result.changes 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in DELETE /api/task-steps', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to delete task step' }, { status: 500 });
  }
} 