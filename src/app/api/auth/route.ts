import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET: Check user credentials
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const password = searchParams.get('password');

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).get(username, password);

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  return NextResponse.json({ username: user.username });
}

// PUT: Update user credentials
export async function PUT(request: Request) {
  try {
    const { currentUsername, currentPassword, newUsername, newPassword } = await request.json();

    // Verify current credentials
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND password = ?'
    ).get(currentUsername, currentPassword);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid current credentials' },
        { status: 401 }
      );
    }

    // Update the credentials
    const updateQuery = db.prepare(`
      UPDATE users 
      SET username = COALESCE(?, username),
          password = COALESCE(?, password)
      WHERE id = ?
    `);

    updateQuery.run(
      newUsername || user.username,
      newPassword || user.password,
      user.id
    );

    return NextResponse.json({
      message: 'Credentials updated successfully',
      username: newUsername || user.username
    });

  } catch (error) {
    console.error('Error updating credentials:', error);
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 }
    );
  }
} 