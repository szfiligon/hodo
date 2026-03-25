import { createLogger } from '@/lib/logger';

// 到期日能力已移除，任务保留为空操作以兼容调度入口
export async function scanOverdueTasks() {
  const logger = createLogger('overdue-tasks.task', 'global');
  logger.info('[OVERDUE_TASK] skipped: due date feature removed');
}

// 导出任务函数，供scheduler调用
export const overdueTasksTask = () => scanOverdueTasks();
