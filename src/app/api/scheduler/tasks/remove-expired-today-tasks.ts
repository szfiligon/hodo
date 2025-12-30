import { db, tasks } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { and, eq, ne, isNotNull, inArray } from 'drizzle-orm';

// 移除到期日非当日的今日任务标记
export async function removeExpiredTodayTasks() {
  const logger = createLogger('remove-expired-today-tasks.task', 'global');
  
  try {
    logger.info('[REMOVE_EXPIRED_TODAY] Starting expired today tasks cleanup');
    
    // 获取今天的日期 YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    logger.info(`[REMOVE_EXPIRED_TODAY] Today's date: ${today}`);
    
    // 查询所有标记为今日任务但到期日不是今天的任务
    const expiredTodayTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        userId: tasks.userId,
        dueDate: tasks.dueDate,
        isTodayTask: tasks.isTodayTask
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.isTodayTask, true), // 标记为今日任务
          isNotNull(tasks.dueDate),     // 有到期日
          ne(tasks.dueDate, today)      // 到期日不是今天
        )
      );
    
    logger.info(`[REMOVE_EXPIRED_TODAY] Found ${expiredTodayTasks.length} expired today tasks`);
    
    if (expiredTodayTasks.length === 0) {
      logger.info('[REMOVE_EXPIRED_TODAY] No expired today tasks found, cleanup completed');
      return;
    }
    
    // 记录要清理的任务信息
    const taskTitles = expiredTodayTasks.map(task => task.title);
    logger.info(`[REMOVE_EXPIRED_TODAY] Tasks to clean up: ${taskTitles.join(', ')}`);
    
    // 批量更新：将这些任务的 isTodayTask 设置为 false
    const taskIds = expiredTodayTasks.map(task => task.id);
    
    // 使用 inArray 进行批量更新，这是更安全的方式
    await db
      .update(tasks)
      .set({ 
        isTodayTask: false,
        updatedAt: new Date().toISOString()
      })
      .where(inArray(tasks.id, taskIds));
    
    logger.info(`[REMOVE_EXPIRED_TODAY] Successfully cleaned up ${expiredTodayTasks.length} expired today tasks`);
    
    // 记录清理的详细信息
    expiredTodayTasks.forEach(task => {
      logger.info(`[REMOVE_EXPIRED_TODAY] Cleaned up task "${task.title}" (ID: ${task.id}) - due date: ${task.dueDate}`);
    });
    
    logger.info('[REMOVE_EXPIRED_TODAY] Expired today tasks cleanup completed successfully');
    
  } catch (error) {
    logger.error('[REMOVE_EXPIRED_TODAY] Error cleaning up expired today tasks', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// 导出任务函数，供scheduler调用
export const removeExpiredTodayTasksTask = () => removeExpiredTodayTasks();
