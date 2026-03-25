import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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