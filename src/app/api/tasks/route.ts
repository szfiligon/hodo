import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskMenuId = searchParams.get('taskMenuId');
    const taskId = searchParams.get('taskId');
    const today = searchParams.get('today');
    
    if (taskId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ? ORDER BY importance DESC, created_at DESC').get(taskId);
      return NextResponse.json(task);
    }
    
    if (today === 'true') {
      const tasks = db.prepare(`
        SELECT tasks.* FROM tasks
        JOIN task_menu_associations ON tasks.id = task_menu_associations.task_id
        WHERE task_menu_associations.menu_id = -2
        ORDER BY tasks.importance DESC, tasks.created_at DESC
      `).all();
      return NextResponse.json(tasks);
    }
    
    if (!taskMenuId) {
      const tasks = db.prepare('SELECT * FROM tasks ORDER BY importance DESC, created_at DESC').all();
      return NextResponse.json(tasks);
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE task_menu_id = ? ORDER BY importance DESC, created_at DESC').all(taskMenuId);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error in GET request:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { taskMenuId, text, due_date } = await request.json();
    if (!taskMenuId || !text) {
      return NextResponse.json({ error: 'Task menu ID and text are required' }, { status: 400 });
    }

    const result = db.prepare('INSERT INTO tasks (task_menu_id, text, remarks, due_date) VALUES (?, ?, ?, ?)').run(taskMenuId, text, '', due_date);
    return NextResponse.json({ id: result.lastInsertRowid, taskMenuId, text, due_date });
  } catch (error) {
    console.error('Error in POST request:', error);
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
    console.error('Error in DELETE request:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, completed, remarks, color_tag, remind_me, text, importance, isTodayTask, due_date } = await request.json();
    if (id === undefined || (completed === undefined && remarks === undefined && color_tag === undefined && remind_me === undefined && text === undefined && importance === undefined && isTodayTask === undefined && due_date === undefined)) {
      return NextResponse.json({ error: 'ID and at least one field to update are required' }, { status: 400 });
    }

    if (due_date !== undefined) {
      db.prepare('UPDATE tasks SET due_date = ? WHERE id = ?').run(due_date, id);
    }

    if (isTodayTask !== undefined) {
      const existingAssociation = db.prepare('SELECT 1 FROM task_menu_associations WHERE task_id = ? AND menu_id = ?').get(id, -2);

      if (isTodayTask && !existingAssociation) {
        db.prepare('INSERT INTO task_menu_associations (task_id, menu_id) VALUES (?, ?)').run(id, -2);
      } else if (!isTodayTask && existingAssociation) {
        db.prepare('DELETE FROM task_menu_associations WHERE task_id = ? AND menu_id = ?').run(id, -2);
      }
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

    if (importance !== undefined) {
      db.prepare('UPDATE tasks SET importance = ? WHERE id = ?').run(importance ? 1 : 0, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH request:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
} 