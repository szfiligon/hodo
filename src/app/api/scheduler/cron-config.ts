// Cron 任务配置文件
export interface CronTaskConfig {
  id: string;
  name: string;
  cronExpression: string;
  description: string;
  enabled: boolean;
}

// 预定义的 cron 任务配置
export const CRON_TASKS: CronTaskConfig[] = [
  {
    id: 'overdue-tasks-scan',
    name: '过期任务扫描(停用)',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '到期日能力已移除，保留占位任务',
    enabled: true
  },
  {
    id: 'add-today-tasks',
    name: '添加今日任务(停用)',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '到期日能力已移除，保留占位任务',
    enabled: true
  },
  {
    id: 'remove-expired-today-tasks',
    name: '今日任务清理(停用)',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '到期日能力已移除，保留占位任务',
    enabled: true
  },
  {
    id: 'cleanup-logs',
    name: '日志文件清理',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '清理三天前的日志文件',
    enabled: true
  }
];

