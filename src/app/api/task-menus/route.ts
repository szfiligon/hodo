import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/user';

export async function GET() {
  try {
    const { id: userId } = getCurrentUser();
    const taskMenus = db.prepare('SELECT * FROM task_menus WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return NextResponse.json(taskMenus);
  } catch (error) {
    console.error('Failed to fetch task menus:', error);
    return NextResponse.json({ error: 'Failed to fetch task menus' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { id: userId } = getCurrentUser();
    const id = uuidv4();
    
    db.prepare(
      'INSERT INTO task_menus (id, name, user_id) VALUES (?, ?, ?)'
    ).run(id, name, userId);
    
    return NextResponse.json({ id, name, user_id: userId });
  } catch (error) {
    console.error('Failed to create task menu:', error);
    return NextResponse.json({ error: 'Failed to create task menu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { id: userId } = getCurrentUser();
    db.prepare('DELETE FROM task_menus WHERE id = ? AND user_id = ?').run(id.toString(), userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task menu:', error);
    return NextResponse.json({ error: 'Failed to delete task menu' }, { status: 500 });
  }
} 