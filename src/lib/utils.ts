import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import moment from "moment"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化任务开始日显示
export function formatDateRange(startDate: Date | undefined): string {
  if (!startDate) return ""
  return moment(startDate).format('M/D')
} 

/**
 * 在系统默认浏览器中打开外部链接
 * @param url 要打开的URL
 */
export const openExternalLink = async (url: string): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  window.open(url, '_blank');
  return true;
}; 