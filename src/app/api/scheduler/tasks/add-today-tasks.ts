import { db, tasks } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

/**
 * 将到期日为今天的任务添加为今日任务
 */
export async function addTodayTasksTask() {
  const logger = createLogger('add-today-tasks.task', 'global');
  
  try {
    logger.info('[ADD_TODAY_TASKS] Starting today tasks addition task');
    
    // 获取今天的日期 YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    logger.info(`[ADD_TODAY_TASKS] Today's date: ${today}`);
    
    // 查询所有到期日为今天但未标记为今日任务的任务
    const tasksToAdd = await db
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
          eq(tasks.dueDate, today),           // 到期日是今天
          eq(tasks.isTodayTask, false),       // 未标记为今日任务
          eq(tasks.completed, false),         // 任务未完成
          isNotNull(tasks.dueDate)            // 有到期日
        )
      );
    
    logger.info(`[ADD_TODAY_TASKS] Found ${tasksToAdd.length} tasks to add as today tasks`);
    
    if (tasksToAdd.length === 0) {
      logger.info('[ADD_TODAY_TASKS] No tasks to add, task completed');
      return;
    }
    
    // 记录要添加的任务信息
    const taskTitles = tasksToAdd.map(task => task.title);
    logger.info(`[ADD_TODAY_TASKS] Tasks to add: ${taskTitles.join(', ')}`);
    
    // 批量更新：将这些任务的 isTodayTask 设置为 true
    const taskIds = tasksToAdd.map(task => task.id);
    
    await db
      .update(tasks)
      .set({ 
        isTodayTask: true,
        updatedAt: new Date().toISOString()
      })
      .where(sql`${tasks.id} IN (${taskIds.join(',')})`);
    
    logger.info(`[ADD_TODAY_TASKS] Successfully added ${tasksToAdd.length} tasks as today tasks`);
    
    // 记录详细的更新信息
    tasksToAdd.forEach(task => {
      logger.info(`[ADD_TODAY_TASKS] Added task as today task`, {
        taskId: task.id,
        title: task.title,
        userId: task.userId,
        dueDate: task.dueDate
      });
    });
    
  } catch (error) {
    logger.error('[ADD_TODAY_TASKS] Error in add today tasks task', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
