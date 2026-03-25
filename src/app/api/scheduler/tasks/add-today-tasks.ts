import { createLogger } from '@/lib/logger';

/**
 * 到期日能力已移除，任务保留为空操作以兼容调度入口
 */
export async function addTodayTasksTask() {
  const logger = createLogger('add-today-tasks.task', 'global');
  logger.info('[ADD_TODAY_TASKS] skipped: due date feature removed');
}
