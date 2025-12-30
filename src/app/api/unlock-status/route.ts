import { NextRequest, NextResponse } from 'next/server';
import { db, unlockRecords, systemConfig } from '@/lib/db';
import { getCurrentUser, isInTrialPeriod } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user || !user.username) {
    return NextResponse.json({ unlocked: false }, { status: 401 });
  }

  // 查询用户的解锁记录 - 改为检查是否有任何解锁记录，不再按日期检查
  const records = await db.select().from(unlockRecords)
    .where(sql`${unlockRecords.username} = ${user.username}`);
  
  const hasUnlockRecord = records.length > 0;

  // 检查是否在30天免费试用期内
  const inTrialPeriod = await isInTrialPeriod();
  if (inTrialPeriod) {
    // 获取基准时间和剩余天数
    try {
      const configResult = await db.select().from(systemConfig)
        .where(sql`${systemConfig.key} = 'trial_base_time'`);
      
      let remainingDays = 30;
      if (configResult.length > 0) {
        const baseTime = new Date(configResult[0].value);
        const now = new Date();
        const trialEndTime = new Date(baseTime);
        trialEndTime.setDate(trialEndTime.getDate() + 30);
        
        const diffTime = trialEndTime.getTime() - now.getTime();
        remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      let message = `当前处于30天免费试用期内，剩余 ${remainingDays} 天`;
      if (hasUnlockRecord) {
        message += '，且已永久解锁';
      }

      return NextResponse.json({ 
        unlocked: true, 
        trialPeriod: true,
        hasUnlockRecord,
        remainingDays,
        message
      });
    } catch {
      let message = '当前处于30天免费试用期内';
      if (hasUnlockRecord) {
        message += '，且已永久解锁';
      }

      return NextResponse.json({ 
        unlocked: true, 
        trialPeriod: true,
        hasUnlockRecord,
        message
      });
    }
  }

  // 试用期已过，只检查解锁记录
  return NextResponse.json({ 
    unlocked: hasUnlockRecord,
    trialPeriod: false,
    hasUnlockRecord,
    remainingDays: 0,
    message: hasUnlockRecord ? '账户已永久解锁' : '试用期已结束，需要解锁码'
  });
} 