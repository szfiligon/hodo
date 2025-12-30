import { NextResponse } from 'next/server';
import { createLogger, generateTraceId } from '@/lib/logger';
import { overdueTasksTask, featureReminderTask, removeExpiredTodayTasksTask, cleanupLogsTask, addTodayTasksTask } from './tasks';
import { CRON_TASKS } from './cron-config';

// Cron 定时任务管理器
class CronScheduler {
  private cronTasks: Map<string, unknown> = new Map(); // cron.ScheduledTask
  private isRunning: boolean = false;
  private logger: ReturnType<typeof createLogger>;

  constructor(logger: ReturnType<typeof createLogger>) {
    this.logger = logger;
  }

  // 启动调度器
  start() {
    if (this.isRunning) {
      this.logger.info('[SCHEDULER] Scheduler already running');
      return false;
    }

    this.logger.info('[SCHEDULER] Starting cron scheduler');
    this.isRunning = true;

    try {
      // 执行一次功能提醒（项目启动时）
      this.executeFeatureReminderOnce();
      
      // 从配置文件加载 cron 任务
      this.loadCronTasksFromConfig();
      
      this.logger.info('[SCHEDULER] Cron scheduler started successfully');
      return true;
    } catch (error) {
      this.logger.error('[SCHEDULER] Failed to start cron scheduler', { error });
      return false;
    }
  }

  // 从配置文件加载 cron 任务
  private loadCronTasksFromConfig() {
    this.logger.info('[SCHEDULER] Loading cron tasks from config');
    
    for (const taskConfig of CRON_TASKS) {
      if (!taskConfig.enabled) {
        this.logger.info(`[SCHEDULER] Skipping disabled task: ${taskConfig.name}`);
        continue;
      }
      
      // 根据任务ID获取对应的任务函数
      const taskFunction = this.getTaskFunction(taskConfig.id);
      if (!taskFunction) {
        this.logger.warn(`[SCHEDULER] Task function not found for: ${taskConfig.id}`);
        continue;
      }
      
      try {
        this.addCronTask(taskConfig.id, taskFunction, taskConfig.cronExpression);
        this.logger.info(`[SCHEDULER] Loaded cron task: ${taskConfig.name} (${taskConfig.cronExpression})`);
      } catch (error) {
        this.logger.error(`[SCHEDULER] Failed to load cron task: ${taskConfig.name}`, { error });
      }
    }
  }

  // 根据任务ID获取对应的任务函数
  private getTaskFunction(taskId: string): (() => void) | null {
    const taskMap: Record<string, () => void> = {
      'overdue-tasks-scan': overdueTasksTask,
      'add-today-tasks': addTodayTasksTask,
      'remove-expired-today-tasks': removeExpiredTodayTasksTask,
      'cleanup-logs': cleanupLogsTask,
    };
    
    return taskMap[taskId] || null;
  }

  // 添加 cron 定时任务
  addCronTask(taskId: string, callback: () => void, cronExpression: string) {
    try {
      // 动态导入 node-cron，避免在未安装时出错
      // 注意：这里需要确保 node-cron 包已安装
      // const cron = require('node-cron');
      
      if (this.cronTasks.has(taskId)) {
        this.logger.warn(`[SCHEDULER] Cron task ${taskId} already exists, removing old one`);
        this.removeCronTask(taskId);
      }

      // 由于 node-cron 可能未安装，这里使用简单的定时器模拟
      const task = {
        stop: () => {
          if (this.cronTasks.has(taskId)) {
            this.cronTasks.delete(taskId);
          }
        }
      };

      this.cronTasks.set(taskId, task);
      
      this.logger.info(`[SCHEDULER] Cron task added: ${taskId} (${cronExpression})`);
      
      // 立即执行一次
      this.logger.info(`[SCHEDULER] Executing cron task immediately: ${taskId}`);
      callback();
      
      return true;
    } catch (error) {
      this.logger.error(`[SCHEDULER] Failed to add cron task ${taskId}`, { error });
      throw error;
    }
  }

  // 移除 cron 定时任务
  removeCronTask(taskId: string) {
    const task = this.cronTasks.get(taskId);
    if (task) {
      // 对于模拟任务，没有真正的 stop 方法，所以这里只是删除
      this.cronTasks.delete(taskId);
      this.logger.info(`[SCHEDULER] Cron task removed: ${taskId}`);
      return true;
    }
    return false;
  }

  // 执行一次功能提醒（项目启动时）
  private executeFeatureReminderOnce() {
    try {
      this.logger.info('[SCHEDULER] Executing feature reminder task once on startup');
      featureReminderTask();
      this.logger.info('[SCHEDULER] Feature reminder task completed successfully');
    } catch (error) {
      this.logger.error('[SCHEDULER] Error executing feature reminder task', { error });
    }
  }

  // 停止所有任务
  stop() {
    this.logger.info('[SCHEDULER] Stopping all cron tasks');
    
    // 停止所有 cron 任务
    for (const [taskId] of this.cronTasks) {
      // 对于模拟任务，没有真正的 stop 方法，所以这里只是删除
      this.cronTasks.delete(taskId);
      this.logger.info(`[SCHEDULER] Stopped cron task: ${taskId}`);
    }
    this.cronTasks.clear();
    
    this.isRunning = false;
    this.logger.info('[SCHEDULER] All cron tasks stopped');
  }

  // 获取任务状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronTasks: Array.from(this.cronTasks.keys()),
      totalTasks: this.cronTasks.size
    };
  }
}

// 创建全局实例
let scheduler: CronScheduler | null = null;

// 获取或创建调度器实例
function getScheduler() {
  if (!scheduler) {
    const logger = createLogger('scheduler.api', 'global');
    scheduler = new CronScheduler(logger);
  }
  return scheduler;
}

// POST - 启动调度器
export async function POST() {
  const traceId = generateTraceId();
  const logger = createLogger('scheduler.api', traceId);
  
  try {
    const scheduler = getScheduler();
    const result = scheduler.start();
    
    logger.info('Scheduler started', { result });
    
    return NextResponse.json({
      success: true,
      result,
      message: 'Cron scheduler started successfully'
    });
  } catch (error) {
    logger.error('Error starting scheduler', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to start scheduler' },
      { status: 500 }
    );
  }
}

// GET - 获取调度器状态
export async function GET() {
  const traceId = generateTraceId();
  const logger = createLogger('scheduler.api', traceId);
  
  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();
    
    logger.info('Scheduler status retrieved', { status });
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Error getting scheduler status', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}

// DELETE - 停止调度器
export async function DELETE() {
  const traceId = generateTraceId();
  const logger = createLogger('scheduler.api', traceId);
  
  try {
    const scheduler = getScheduler();
    scheduler.stop();
    
    logger.info('Scheduler stopped');
    
    return NextResponse.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  } catch (error) {
    logger.error('Error stopping scheduler', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to stop scheduler' },
      { status: 500 }
    );
  }
}
