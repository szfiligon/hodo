import { db, messages } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { sql } from 'drizzle-orm';

// 当前版本号
const CURRENT_VERSION = '1.1.0';

// 添加功能提醒消息（只执行一次）
export async function addFeatureReminders() {
  const logger = createLogger('feature-reminder.task', 'global');
  
  try {
    logger.info('[FEATURE_REMINDER] Starting feature reminder task');
    
    // 检查是否已经添加过当前版本的功能提醒
    // 通过检查消息ID是否包含当前版本号来判断，避免重复添加
    const existingReminders = await db
      .select({ id: messages.id })
      .from(messages)
      .where(sql`${messages.type} = 'feature' AND ${messages.msg} LIKE ${'%' + CURRENT_VERSION + '%'}`)
      .limit(1);
    
    if (existingReminders.length > 0) {
      logger.info(`[FEATURE_REMINDER] Feature reminders for version ${CURRENT_VERSION} already exist, skipping`);
      return;
    }
    
    // 功能列表
    const featureList = [
      '1.1.0版本 - 支持任务菜单归档功能',
      '1.1.0版本 - 支持标签可选列表定制化'
    ];
    
    // 当前版本的新功能列表
    const featureMessages = featureList.map((feature, index) => ({
      id: `feature_reminder_${CURRENT_VERSION}_${Date.now()}_${index + 1}`,
      msg: `新版本功能：\n• ${feature}`,
      type: 'feature' as const,
      read: false,
      userId: 'system', // 系统级消息，使用特殊的用户ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    // 批量插入功能提醒消息
    await db.insert(messages).values(featureMessages);
    
    logger.info(`[FEATURE_REMINDER] Successfully created ${featureMessages.length} feature reminder messages for version ${CURRENT_VERSION}`);
    logger.info('[FEATURE_REMINDER] Feature reminder task completed successfully');
    
  } catch (error) {
    logger.error('[FEATURE_REMINDER] Error adding feature reminders', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// 导出任务函数，供scheduler调用
export const featureReminderTask = () => addFeatureReminders();
