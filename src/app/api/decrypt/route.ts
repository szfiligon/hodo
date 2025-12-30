import { NextRequest, NextResponse } from 'next/server';
import { decryptData, validatePrivateKey } from '@/lib/crypto';
import { createLogger, generateTraceId } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const logger = createLogger('decrypt.route', traceId);

  try {
    logger.info('Starting decrypt API request');
    
    // 验证私钥是否有效
    if (!validatePrivateKey()) {
      logger.error('RSA私钥验证失败');
      return NextResponse.json(
        { error: 'Invalid private key' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { encryptedAesKeyAndIv, encryptedData } = body;

    if (!encryptedAesKeyAndIv || !encryptedData) {
      logger.error('Missing required parameters');
      return NextResponse.json(
        { error: 'Missing encryptedAesKeyAndIv or encryptedData' },
        { status: 400 }
      );
    }

    logger.info('Attempting to decrypt data');
    
    // 执行解密
    const decryptedData = decryptData(encryptedAesKeyAndIv, encryptedData);

    // 新增：校验解锁信息
    // decryptedData 期望格式：username,yyyyMMdd
    const [decryptedUsername, decryptedDate] = (decryptedData || '').split(',');
    if (!decryptedUsername || !decryptedDate) {
      logger.error('Decrypted data format invalid');
      return NextResponse.json(
        { error: 'Decrypted data format invalid' },
        { status: 400 }
      );
    }

    // 获取当前登录用户
    const { getCurrentUser } = await import('@/lib/auth');
    const userInfo = getCurrentUser(request);
    if (!userInfo || !userInfo.username) {
      logger.error('User not authenticated');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // 校验用户名
    if (userInfo.username !== decryptedUsername) {
      logger.error('Username mismatch');
      return NextResponse.json(
        { error: 'Username mismatch' },
        { status: 403 }
      );
    }

    // 校验日期
    const now = new Date();
    const yyyyMMdd = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    if (decryptedDate !== yyyyMMdd) {
      logger.error('Date mismatch or expired');
      return NextResponse.json(
        { error: 'Date mismatch or expired' },
        { status: 403 }
      );
    }

    logger.info('Decryption and unlock validation successful');

    // 写入解锁记录
    const { db, unlockRecords } = await import('@/lib/db');
    const unlockCode = `${encryptedAesKeyAndIv},${encryptedData}`; // 存储完整的解锁码原文：AES信息,密文
    // 按username唯一索引，存在则更新date和unlockCode，不存在则插入
    await db.insert(unlockRecords)
      .values({ username: decryptedUsername, date: decryptedDate, unlockCode })
      .onConflictDoUpdate({
        target: unlockRecords.username,
        set: { date: decryptedDate, unlockCode }
      });
    
    return NextResponse.json({
      decryptedData,
      success: true,
      unlocked: true
    });

  } catch (error) {
    logger.error('Error in decrypt API: ' + (error instanceof Error ? error.message : String(error)), error);
    return NextResponse.json(
      { error: 'Decryption failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 