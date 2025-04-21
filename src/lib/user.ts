import db from './db';

interface User {
  id: string;
  username: string;
}

export function getCurrentUser(): User {
  const user = db.prepare('SELECT id, username FROM users LIMIT 1').get() as User;
  if (!user) {
    throw new Error('No user found');
  }
  return user;
} 