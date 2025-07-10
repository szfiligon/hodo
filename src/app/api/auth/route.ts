import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createLoggerFromRequest } from '@/lib/logger';

// GET: Check user credentials
export async function GET(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const password = searchParams.get('password');

  await apiLogger.info('GET /api/auth request', { 
    hasUsername: !!username,
    hasPassword: !!password,
    userAgent: request.headers.get('user-agent')
  });

  if (!username || !password) {
    await apiLogger.warn('Invalid GET /api/auth request', { hasUsername: !!username, hasPassword: !!password });
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).get(username, password);

  if (!user) {
    await apiLogger.warn('Authentication failed', { username });
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  await apiLogger.info('Authentication successful', { username: user.username });
  return NextResponse.json({ username: user.username });
}

// PUT: Update user credentials
export async function PUT(request: Request) {
  const apiLogger = createLoggerFromRequest(request);
  
  try {
    const { currentUsername, currentPassword, newUsername, newPassword } = await request.json();

    await apiLogger.info('PUT /api/auth request', { 
      hasCurrentUsername: !!currentUsername,
      hasCurrentPassword: !!currentPassword,
      hasNewUsername: !!newUsername,
      hasNewPassword: !!newPassword,
      userAgent: request.headers.get('user-agent')
    });

    // Verify current credentials
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND password = ?'
    ).get(currentUsername, currentPassword);

    if (!user) {
      await apiLogger.warn('Credential update failed - invalid current credentials', { currentUsername });
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

    const result = updateQuery.run(
      newUsername || user.username,
      newPassword || user.password,
      user.id
    );

    await apiLogger.info('Credentials updated successfully', { 
      userId: user.id,
      oldUsername: user.username,
      newUsername: newUsername || user.username,
      hasNewPassword: !!newPassword,
      changes: result.changes
    });

    return NextResponse.json({
      message: 'Credentials updated successfully',
      username: newUsername || user.username
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await apiLogger.error('Error in PUT /api/auth', { error: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 }
    );
  }
} 