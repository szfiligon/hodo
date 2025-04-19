import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }

  const steps = db.prepare('SELECT * FROM task_steps WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
  return NextResponse.json(steps);
}

export async function POST(request: Request) {
  const { taskId, text } = await request.json();

  if (!taskId || !text) {
    return NextResponse.json({ error: 'Task ID and text are required' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO task_steps (id, task_id, text)
    VALUES (?, ?, ?)
  `).run(id, taskId, text);

  const step = db.prepare('SELECT * FROM task_steps WHERE id = ?').get(id);
  return NextResponse.json(step);
}

export async function PATCH(request: Request) {
  const { id, completed } = await request.json();

  if (id === undefined || completed === undefined) {
    return NextResponse.json({ error: 'ID and completed status are required' }, { status: 400 });
  }

  db.prepare('UPDATE task_steps SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  db.prepare('DELETE FROM task_steps WHERE id = ?').run(id.toString());
  return NextResponse.json({ success: true });
} 