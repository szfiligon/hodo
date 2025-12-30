import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import moment from "moment"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化任务到期日显示
export function formatDueDate(dueDate: Date | undefined): string {
  if (!dueDate) return ""
  
  const today = moment().startOf('day')
  const tomorrow = moment().add(1, 'day').startOf('day')
  const dueMoment = moment(dueDate).startOf('day')
  
  if (dueMoment.isSame(today)) {
    return "今天"
  } else if (dueMoment.isSame(tomorrow)) {
    return "明天"
  } else {
    return dueMoment.format('MM/DD')
  }
}

// 格式化任务详情中的到期日显示
export function formatDueDateDetail(dueDate: Date | undefined): string {
  if (!dueDate) return ""
  return moment(dueDate).format('YYYY年MM月DD日')
}

// 格式化开始日和到期日的组合显示
export function formatDateRange(startDate: Date | undefined, dueDate: Date | undefined): string {
  if (!startDate && !dueDate) return ""
  
  if (startDate && dueDate) {
    const startMoment = moment(startDate).startOf('day')
    const dueMoment = moment(dueDate).startOf('day')
    
    // 如果开始日和到期日是同一天，只显示一个日期
    if (startMoment.isSame(dueMoment)) {
      return startMoment.format('M/D')
    }
    
    // 如果开始日和到期日不是同一天，显示范围
    return `${startMoment.format('M/D')} - ${dueMoment.format('M/D')}`
  }
  
  // 只有开始日
  if (startDate && !dueDate) {
    return ``;
  }
  
  // 只有到期日
  if (!startDate && dueDate) {
    return moment(dueDate).format('M/D')
  }
  
  return ""
} 

// 扩展 Window 接口以包含 Electron API
declare global {
  interface Window {
    electronAPI?: {
      openExternal: (url: string) => Promise<boolean>;
      setZoomFactor: (zoomFactor: number) => Promise<{ success: boolean; error?: string }>;
      getZoomFactor: () => Promise<{ success: boolean; zoomFactor?: number; error?: string }>;
    };
    require?: (module: string) => unknown;
  }
}

/**
 * 检测是否在 Electron 环境中
 */
export const isElectron = () => {
  return typeof window !== 'undefined' && 
         (window.electronAPI || window.require);
};

/**
 * 在系统默认浏览器中打开外部链接
 * @param url 要打开的URL
 * @param fallbackToWindowOpen 是否在失败时回退到 window.open，默认为 true
 */
export const openExternalLink = async (url: string, fallbackToWindowOpen: boolean = true): Promise<boolean> => {
  console.log('openExternalLink called with URL:', url);
  console.log('isElectron():', isElectron());
  
  // 始终使用系统默认浏览器打开外部链接
  if (isElectron() && window.electronAPI?.openExternal) {
    // 在 Electron 环境中，使用 electronAPI 在系统默认浏览器中打开
    console.log('Using electronAPI.openExternal for system browser');
    try {
      const result = await window.electronAPI.openExternal(url);
      console.log('External link opened successfully');
      return result;
    } catch (error) {
      console.error('Error using electronAPI.openExternal:', error);
      if (fallbackToWindowOpen) {
        // 回退到普通浏览器打开
        window.open(url, '_blank');
        return true;
      }
      return false;
    }
  } else {
    console.log('Not in Electron or electronAPI not available, using window.open');
    // 在普通浏览器环境中，正常打开
    window.open(url, '_blank');
    return true;
  }
}; 