import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskMenuId = searchParams.get('taskMenuId');
    
    if (!taskMenuId) {
      const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
      return NextResponse.json(tasks);
    }

    const tasks = db.prepare('SELECT id, task_menu_id, text, completed, remarks, created_at FROM tasks WHERE task_menu_id = ? ORDER BY created_at DESC').all(taskMenuId);
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
    const { id, completed, remarks } = await request.json();
    if (id === undefined || (completed === undefined && remarks === undefined)) {
      return NextResponse.json({ error: 'ID and either completed status or remarks are required' }, { status: 400 });
    }

    if (completed !== undefined) {
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
    }

    if (remarks !== undefined) {
      db.prepare('UPDATE tasks SET remarks = ? WHERE id = ?').run(remarks, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
} 