import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const taskMenus = db.prepare('SELECT * FROM task_menus ORDER BY created_at DESC').all();
    return NextResponse.json(taskMenus);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch task menus' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = db.prepare('INSERT INTO task_menus (name) VALUES (?)').run(name);
    return NextResponse.json({ id: result.lastInsertRowid, name });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task menu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM task_menus WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task menu' }, { status: 500 });
  }
} 