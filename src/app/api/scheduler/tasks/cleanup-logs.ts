import fs from 'fs';
import path from 'path';
import { getLogsPath } from '@/lib/user-data';
import { createLogger } from '@/lib/logger';

/**
 * 清理三天前的日志文件（基于文件名中的日期）
 */
export function cleanupLogsTask(): void {
  const logger = createLogger('scheduler.cleanup-logs', 'cleanup-logs');
  
  try {
    const logsDir = getLogsPath();
    const currentDate = new Date();
    const threeDaysAgo = new Date(currentDate.getTime() - (3 * 24 * 60 * 60 * 1000));
    
    logger.info('开始清理三天前的日志文件（基于文件名日期）', { 
      logsDir, 
      currentDate: currentDate.toISOString(), 
      threeDaysAgo: threeDaysAgo.toISOString() 
    });
    
    // 读取日志目录中的所有文件
    const files = fs.readdirSync(logsDir);
    let deletedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
      // 只处理日志文件（以 .log 结尾的文件）
      if (!file.endsWith('.log')) {
        continue;
      }
      
      // 从文件名中提取日期
      // 文件名格式：hodo-YYYY-MM-DD.log
      const dateMatch = file.match(/^hodo-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!dateMatch) {
        logger.warn('跳过不符合命名规范的日志文件', { fileName: file });
        skippedCount++;
        continue;
      }
      
      const fileDateStr = dateMatch[1];
      let fileDate: Date;
      
      try {
        // 解析文件名中的日期
        fileDate = new Date(fileDateStr + 'T00:00:00.000Z');
        
        // 验证日期是否有效
        if (isNaN(fileDate.getTime())) {
          logger.warn('文件名中的日期格式无效，跳过文件', { 
            fileName: file, 
            extractedDate: fileDateStr 
          });
          skippedCount++;
          continue;
        }
      } catch (error) {
        logger.warn('解析文件名中的日期失败，跳过文件', { 
          fileName: file, 
          extractedDate: fileDateStr,
          error: error instanceof Error ? error.message : String(error)
        });
        skippedCount++;
        continue;
      }
      
      // 如果文件名中的日期早于三天前，则删除
      if (fileDate < threeDaysAgo) {
        const filePath = path.join(logsDir, file);
        try {
          // 检查文件是否存在（以防文件已被删除）
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            fs.unlinkSync(filePath);
            deletedCount++;
            logger.info('已删除过期日志文件', { 
              fileName: file, 
              fileDate: fileDate.toISOString(),
              fileSize: stats.size 
            });
          } else {
            logger.warn('文件不存在，可能已被删除', { fileName: file });
          }
        } catch (error) {
          errorCount++;
          logger.error('删除日志文件失败', { 
            fileName: file, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }
    
    logger.info('日志清理任务完成', { 
      totalFiles: files.length, 
      deletedCount, 
      errorCount,
      skippedCount,
      remainingFiles: files.length - deletedCount
    });
    
  } catch (error) {
    logger.error('日志清理任务执行失败', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
