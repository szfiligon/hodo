import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskMenuId = searchParams.get('taskMenuId');
    const taskId = searchParams.get('taskId');
    const today = searchParams.get('today');
    
    if (taskId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      return NextResponse.json(task);
    }
    
    if (today === 'true') {
      const today = new Date().toISOString().split('T')[0];
      const tasks = db.prepare(`
        SELECT * FROM tasks 
        WHERE DATE(created_at) = ? 
        OR DATE(remind_me) = ?
        ORDER BY created_at DESC
      `).all(today, today);
      return NextResponse.json(tasks);
    }
    
    if (!taskMenuId) {
      const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
      return NextResponse.json(tasks);
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE task_menu_id = ? ORDER BY created_at DESC').all(taskMenuId);
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { taskMenuId, text } = await request.json();
    if (!taskMenuId || !text) {
      return NextResponse.json({ error: 'Task menu ID and text are required' }, { status: 400 });
    }

    const result = db.prepare('INSERT INTO tasks (task_menu_id, text, remarks) VALUES (?, ?, ?)').run(taskMenuId, text, '');
    return NextResponse.json({ id: result.lastInsertRowid, taskMenuId, text });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, completed, remarks, color_tag, remind_me, text } = await request.json();
    if (id === undefined || (completed === undefined && remarks === undefined && color_tag === undefined && remind_me === undefined && text === undefined)) {
      return NextResponse.json({ error: 'ID and at least one field to update are required' }, { status: 400 });
    }

    if (completed !== undefined) {
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
    }

    if (remarks !== undefined) {
      db.prepare('UPDATE tasks SET remarks = ? WHERE id = ?').run(remarks, id);
    }

    if (color_tag !== undefined) {
      db.prepare('UPDATE tasks SET color_tag = ? WHERE id = ?').run(color_tag, id);
    }

    if (remind_me !== undefined) {
      db.prepare('UPDATE tasks SET remind_me = ? WHERE id = ?').run(remind_me, id);
    }

    if (text !== undefined) {
      db.prepare('UPDATE tasks SET text = ? WHERE id = ?').run(text, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
} 