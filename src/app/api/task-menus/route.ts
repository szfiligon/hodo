import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const taskMenus = db.prepare('SELECT * FROM task_menus ORDER BY created_at DESC').all();
    return NextResponse.json(taskMenus);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch task menus' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO task_menus (id, name) VALUES (?, ?)').run(id, name);
    return NextResponse.json({ id, name });
  } catch {
    return NextResponse.json({ error: 'Failed to create task menu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM task_menus WHERE id = ?').run(id.toString());
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task menu' }, { status: 500 });
  }
} 