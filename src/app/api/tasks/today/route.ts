import { NextRequest } from 'next/server';
import { GET_TODAY } from '../route';

export async function GET(request: NextRequest) {
  return GET_TODAY(request);
} 