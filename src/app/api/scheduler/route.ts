import { NextResponse } from 'next/server';
import { createLogger, generateTraceId } from '@/lib/logger';
import { overdueTasksTask, featureReminderTask, removeExpiredTodayTasksTask, cleanupLogsTask, addTodayTasksTask } from './tasks';
import { CRON_TASKS } from './cron-config';
import Bree from 'bree';
import path from 'path';

// Cron 定时任务管理器
class CronScheduler {
  private bree: Bree | null = null;
  private cronTasks: Set<string> = new Set();
  private isRunning: boolean = false;
  private logger: ReturnType<typeof createLogger>;
  private readonly workerPath = path.join(
    process.cwd(),
    'src',
    'app',
    'api',
    'scheduler',
    'workers',
    'run-task.mjs'
  );

  constructor(logger: ReturnType<typeof createLogger>) {
    this.logger = logger;
  }

  // 启动调度器
  async start() {
    if (this.isRunning) {
      this.logger.info('[SCHEDULER] Scheduler already running');
      return false;
    }

    this.logger.info('[SCHEDULER] Starting cron scheduler');
    this.isRunning = true;

    try {
      await this.loadCronTasksFromConfig();
      this.executeFeatureReminderOnce();
      this.logger.info('[SCHEDULER] Cron scheduler started successfully');
      return true;
    } catch (error) {
      this.logger.error('[SCHEDULER] Failed to start cron scheduler', { error });
      this.isRunning = false;
      return false;
    }
  }

  // 从配置文件加载 cron 任务
  private async loadCronTasksFromConfig() {
    this.logger.info('[SCHEDULER] Loading cron tasks from config');

    const jobs: Array<{
      name: string;
      cron: string;
      path: string;
      worker: { workerData: { taskId: string } };
    }> = [];

    for (const taskConfig of CRON_TASKS) {
      if (!taskConfig.enabled) {
        this.logger.info(`[SCHEDULER] Skipping disabled task: ${taskConfig.name}`);
        continue;
      }
      
      // 根据任务ID获取对应的任务函数
      if (!this.getTaskFunction(taskConfig.id)) {
        this.logger.warn(`[SCHEDULER] Task function not found for: ${taskConfig.id}`);
        continue;
      }
      
      try {
        jobs.push({
          name: taskConfig.id,
          cron: taskConfig.cronExpression,
          path: this.workerPath,
          worker: {
            workerData: {
              taskId: taskConfig.id
            }
          }
        });
        this.cronTasks.add(taskConfig.id);
        this.logger.info(`[SCHEDULER] Loaded cron task: ${taskConfig.name} (${taskConfig.cronExpression})`);
      } catch (error) {
        this.logger.error(`[SCHEDULER] Failed to load cron task: ${taskConfig.name}`, { error });
      }
    }

    this.bree = new Bree({
      root: false,
      doRootCheck: false,
      jobs,
      // Worker 仅负责触发消息，任务逻辑在主线程执行，避免在 worker 内耦合应用上下文。
      workerMessageHandler: (name, message) => {
        const taskId = typeof message?.taskId === 'string' ? message.taskId : name;
        void this.executeTask(taskId);
      }
    });

    await this.bree.start();

    // 与历史行为保持一致：加载后每个任务先执行一次。
    for (const taskId of this.cronTasks) {
      void this.executeTask(taskId);
    }
  }

  // 根据任务ID获取对应的任务函数
  private getTaskFunction(taskId: string): (() => Promise<void> | void) | null {
    const taskMap: Record<string, () => Promise<void> | void> = {
      'overdue-tasks-scan': overdueTasksTask,
      'add-today-tasks': addTodayTasksTask,
      'remove-expired-today-tasks': removeExpiredTodayTasksTask,
      'cleanup-logs': cleanupLogsTask,
    };
    
    return taskMap[taskId] || null;
  }

  private async executeTask(taskId: string) {
    const task = this.getTaskFunction(taskId);
    if (!task) {
      this.logger.warn(`[SCHEDULER] Task function not found for: ${taskId}`);
      return;
    }

    try {
      this.logger.info(`[SCHEDULER] Executing cron task: ${taskId}`);
      await task();
    } catch (error) {
      this.logger.error(`[SCHEDULER] Failed to execute cron task ${taskId}`, { error });
    }
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
  async stop() {
    this.logger.info('[SCHEDULER] Stopping all cron tasks');

    if (this.bree) {
      await this.bree.stop();
      this.bree = null;
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
      totalTasks: this.cronTasks.size,
      engine: 'bree'
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
    const result = await scheduler.start();
    
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
    await scheduler.stop();
    
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
