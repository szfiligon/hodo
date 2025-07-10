import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createLoggerFromRequest } from '@/lib/logger';

export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const taskMenuId = searchParams.get('taskMenuId');
    const taskId = searchParams.get('taskId');
    const today = searchParams.get('today');
    
    await apiLogger.info('GET /api/tasks request', { 
      taskMenuId, 
      taskId, 
      today,
      userAgent: request.headers.get('user-agent')
    });
    
    if (taskId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ? ORDER BY importance DESC, created_at DESC').get(taskId);
      await apiLogger.info('Task fetched by ID', { taskId, found: !!task });
      return NextResponse.json(task);
    }
    
    if (today === 'true') {
      const tasks = db.prepare(`
        SELECT tasks.* FROM tasks
        JOIN task_menu_associations ON tasks.id = task_menu_associations.task_id
        WHERE task_menu_associations.menu_id = '-2'
        ORDER BY tasks.importance DESC, tasks.created_at DESC
      `).all();
      await apiLogger.info('Today tasks fetched', { count: tasks.length });
      return NextResponse.json(tasks);
    }
    
    if (!taskMenuId) {
      const tasks = db.prepare('SELECT * FROM tasks ORDER BY importance DESC, created_at DESC').all();
      await apiLogger.info('All tasks fetched', { count: tasks.length });
      return NextResponse.json(tasks);
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE task_menu_id = ? ORDER BY importance DESC, created_at DESC').all(taskMenuId);
    await apiLogger.info('Tasks fetched by menu', { taskMenuId, count: tasks.length });
    return NextResponse.json(tasks);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in GET /api/tasks', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { taskMenuId, text, due_date } = await request.json();
    
    await apiLogger.info('POST /api/tasks request', { 
      taskMenuId, 
      textLength: text?.length,
      hasDueDate: !!due_date,
      userAgent: request.headers.get('user-agent')
    });
    
    if (!taskMenuId || !text) {
      await apiLogger.warn('Invalid POST /api/tasks request', { taskMenuId, hasText: !!text });
      return NextResponse.json({ error: 'Task menu ID and text are required' }, { status: 400 });
    }

    const id = uuidv4();
    const result = db.prepare('INSERT INTO tasks (id, task_menu_id, text, remarks, due_date) VALUES (?, ?, ?, ?, ?)').run(id, taskMenuId, text, '', due_date);
    
    await apiLogger.info('Task created successfully', { 
      taskId: id, 
      taskMenuId, 
      textLength: text.length,
      hasDueDate: !!due_date 
    });
    
    return NextResponse.json({ id, taskMenuId, text, due_date });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in POST /api/tasks', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id } = await request.json();
    
    await apiLogger.info('DELETE /api/tasks request', { 
      taskId: id,
      userAgent: request.headers.get('user-agent')
    });
    
    if (!id) {
      await apiLogger.warn('Invalid DELETE /api/tasks request', { hasId: !!id });
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id.toString());
    
    await apiLogger.info('Task deleted successfully', { 
      taskId: id,
      changes: result.changes 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in DELETE /api/tasks', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { id, completed, remarks, color_tag, remind_me, text, importance, isTodayTask, due_date } = await request.json();
    
    await apiLogger.info('PATCH /api/tasks request', { 
      taskId: id,
      hasCompleted: completed !== undefined,
      hasRemarks: remarks !== undefined,
      hasColorTag: color_tag !== undefined,
      hasRemindMe: remind_me !== undefined,
      hasText: text !== undefined,
      hasImportance: importance !== undefined,
      hasIsTodayTask: isTodayTask !== undefined,
      hasDueDate: due_date !== undefined,
      userAgent: request.headers.get('user-agent')
    });
    
    if (id === undefined || (completed === undefined && remarks === undefined && color_tag === undefined && remind_me === undefined && text === undefined && importance === undefined && isTodayTask === undefined && due_date === undefined)) {
      await apiLogger.warn('Invalid PATCH /api/tasks request', { 
        hasId: id !== undefined,
        hasUpdateFields: !!(completed !== undefined || remarks !== undefined || color_tag !== undefined || remind_me !== undefined || text !== undefined || importance !== undefined || isTodayTask !== undefined || due_date !== undefined)
      });
      return NextResponse.json({ error: 'ID and at least one field to update are required' }, { status: 400 });
    }

    const updates = [];

    if (due_date !== undefined) {
      db.prepare('UPDATE tasks SET due_date = ? WHERE id = ?').run(due_date, id.toString());
      updates.push('due_date');
    }

    if (isTodayTask !== undefined) {
      const existingAssociation = db.prepare('SELECT 1 FROM task_menu_associations WHERE task_id = ? AND menu_id = ?').get(id, -2);

      if (isTodayTask && !existingAssociation) {
        const associationId = uuidv4();
        db.prepare('INSERT INTO task_menu_associations (id, task_id, menu_id) VALUES (?, ?, ?)').run(associationId, id, -2);
        updates.push('added_to_today');
      } else if (!isTodayTask && existingAssociation) {
        db.prepare('DELETE FROM task_menu_associations WHERE task_id = ? AND menu_id = ?').run(id, -2);
        updates.push('removed_from_today');
      }
    }

    if (completed !== undefined) {
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id.toString());
      updates.push('completed');
    }

    if (remarks !== undefined) {
      db.prepare('UPDATE tasks SET remarks = ? WHERE id = ?').run(remarks, id.toString());
      updates.push('remarks');
    }

    if (color_tag !== undefined) {
      const newColorTag = color_tag || 'white';
      db.prepare('UPDATE tasks SET color_tag = ? WHERE id = ?').run(newColorTag, id.toString());
      updates.push('color_tag');
    }

    if (remind_me !== undefined) {
      db.prepare('UPDATE tasks SET remind_me = ? WHERE id = ?').run(remind_me, id.toString());
      updates.push('remind_me');
    }

    if (text !== undefined) {
      db.prepare('UPDATE tasks SET text = ? WHERE id = ?').run(text, id.toString());
      updates.push('text');
    }

    if (importance !== undefined) {
      db.prepare('UPDATE tasks SET importance = ? WHERE id = ?').run(importance ? 1 : 0, id.toString());
      updates.push('importance');
    }

    await apiLogger.info('Task updated successfully', { 
      taskId: id, 
      updates 
    });
    
    return NextResponse.json({ success: true, updates });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in PATCH /api/tasks', { error: errorMessage, stack: errorStack });
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
} 