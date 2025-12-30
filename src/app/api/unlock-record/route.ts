import { NextRequest, NextResponse } from 'next/server';
import { mkdir, appendFile, access, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { getUserDataPath } from '@/lib/user-data';

// 确保使用 Node.js Runtime 以便可访问文件系统
export const runtime = 'nodejs';

/**
 * POST /api/unlock-record
 * 请求体: { username: string; date: string; empNo: string }
 * 作用: 将记录追加到用户数据目录 data/unlock_code_records.txt (若文件不存在则创建)
 */
export async function POST(request: NextRequest) {
  try {
    const { username, date, empNo } = await request.json();

    if (!username || !date || !empNo) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 生成记录行（逗号分隔）
    const recordLine = `${username},${date},${empNo}\n`;

    // 目录与文件路径 (与数据库同级 data 目录)
    const dirPath = path.join(getUserDataPath(), 'data');
    const filePath = path.join(dirPath, 'unlock_code_records.txt');

    // 确保目录存在
    await mkdir(dirPath, { recursive: true });

    // 如果文件不存在则创建空文件
    try {
      await access(filePath, fsConstants.F_OK);
    } catch {
      await writeFile(filePath, '', { encoding: 'utf8' });
    }

    // 追加记录
    await appendFile(filePath, recordLine, { encoding: 'utf8' });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 