import { createLogger } from '@/lib/logger';

// 到期日能力已移除，任务保留为空操作以兼容调度入口
export async function removeExpiredTodayTasks() {
  const logger = createLogger('remove-expired-today-tasks.task', 'global');
  logger.info('[REMOVE_EXPIRED_TODAY] skipped: due date feature removed');
}

// 导出任务函数，供scheduler调用
export const removeExpiredTodayTasksTask = () => removeExpiredTodayTasks();
