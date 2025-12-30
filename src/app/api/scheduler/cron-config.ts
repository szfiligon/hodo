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
    name: '过期任务扫描',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '扫描并处理过期的任务',
    enabled: true
  },
  {
    id: 'add-today-tasks',
    name: '添加今日任务',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '将到期日为今天的任务自动添加为今日任务',
    enabled: true
  },
  {
    id: 'remove-expired-today-tasks',
    name: '今日任务清理',
    cronExpression: '0 * * * *', // 每小时执行一次
    description: '清理过期的今日任务',
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

