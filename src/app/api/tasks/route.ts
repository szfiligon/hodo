import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskMenuId = searchParams.get('taskMenuId');
    const taskId = searchParams.get('taskId');
    
    if (taskId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      return NextResponse.json(task);
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
    const { id, completed, remarks, color_tag, remind_me } = await request.json();
    if (id === undefined || (completed === undefined && remarks === undefined && color_tag === undefined && remind_me === undefined)) {
      return NextResponse.json({ error: 'ID and either completed status, remarks, color_tag, or remind_me are required' }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
} 