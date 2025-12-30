import { initDatabase } from './db';
import { createLogger, generateTraceId } from './logger';

// 应用启动时的初始化函数
export async function initializeApp() {
  const traceId = generateTraceId();
  const logger = createLogger('app.init', traceId);
  
  try {
    logger.info('Starting application initialization...');
    
    // 初始化数据库
    await initDatabase();
    
    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Application initialization failed: ' + (error instanceof Error ? error.message : String(error)), error);
    throw error;
  }
}

// 在模块加载时自动初始化（仅在服务器端）
if (typeof window === 'undefined') {
  // 延迟初始化，避免阻塞模块加载
  setImmediate(() => {
    initializeApp().catch(error => {
      console.error('Failed to initialize application:', error);
    });
  });
} 