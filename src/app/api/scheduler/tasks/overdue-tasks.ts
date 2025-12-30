import { db, tasks, messages } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { and, lt, eq, sql } from 'drizzle-orm';

// 扫描过期任务并添加到message表
export async function scanOverdueTasks() {
  const logger = createLogger('overdue-tasks.task', 'global');
  
  try {
    logger.info('[OVERDUE_TASK] Starting overdue tasks scan');
    
    // 获取今天的日期 YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // 查询所有过期且未完成的任务
    const overdueTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        userId: tasks.userId,
        dueDate: tasks.dueDate
      })
      .from(tasks)
      .where(
        and(
          lt(tasks.dueDate, today), // 到期日小于今天
          eq(tasks.completed, false)  // 任务未完成
        )
      );
    
    logger.info(`[OVERDUE_TASK] Found ${overdueTasks.length} overdue tasks`);
    
    if (overdueTasks.length === 0) {
      logger.info('[OVERDUE_TASK] No overdue tasks found, scan completed');
      return;
    }
    
    // 过滤掉已经推送过提醒的任务
    const tasksToNotify = [];
    
    // 批量查询所有已存在的过期提醒，提高性能
    const existingReminders = await db
      .select({ msg: messages.msg })
      .from(messages)
      .where(
        and(
          eq(messages.type, 'expiry'),
          sql`${messages.msg} LIKE '%已过期%'`
        )
      );
    
    // 创建已存在提醒的消息内容集合，用于快速查找
    const existingMessages = new Set();
    existingReminders.forEach(reminder => {
      existingMessages.add(reminder.msg);
    });
    
    // 过滤掉已经推送过提醒的任务
    for (const task of overdueTasks) {
      // 构造完整的消息内容
      const fullMessage = `任务"${task.title}"已过期，到期日：${task.dueDate}`;
      
      if (!existingMessages.has(fullMessage)) {
        // 没有找到已存在的提醒，添加到待通知列表
        tasksToNotify.push(task);
      } else {
        logger.info(`[OVERDUE_TASK] Message for task "${task.title}" already exists, skipping`);
      }
    }
    
    if (tasksToNotify.length === 0) {
      logger.info('[OVERDUE_TASK] All overdue tasks already have reminders, no new notifications needed');
      return;
    }
    
    logger.info(`[OVERDUE_TASK] ${tasksToNotify.length} tasks need new overdue reminders`);
    
    // 为每个需要提醒的过期任务创建过期消息
    const now = new Date().toISOString();
    const messageValues = tasksToNotify.map(task => ({
      id: `overdue_${task.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      msg: `任务"${task.title}"已过期，到期日：${task.dueDate}`,
      type: 'expiry' as const,
      read: false,
      userId: task.userId, // 使用任务所属用户的ID
      createdAt: now,
      updatedAt: now
    }));
    
    // 批量插入过期消息
    await db.insert(messages).values(messageValues);
    
    logger.info(`[OVERDUE_TASK] Successfully created ${messageValues.length} overdue messages`);
    
    // 可选：将过期任务标记为已读（如果需要的话）
    // 这里可以根据业务需求决定是否要更新任务状态
    
    logger.info('[OVERDUE_TASK] Overdue tasks scan completed successfully');
    
  } catch (error) {
    logger.error('[OVERDUE_TASK] Error scanning overdue tasks', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// 导出任务函数，供scheduler调用
export const overdueTasksTask = () => scanOverdueTasks();
