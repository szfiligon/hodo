import { toast } from "@/components/ui/use-toast"

// Toast类型定义
export type ToastType = 'success' | 'error' | 'warning' | 'info'

// Toast配置接口
export interface ToastConfig {
  title?: string
  description?: string
  duration?: number
}

// 默认Toast配置
const defaultConfig: ToastConfig = {
  duration: 2000,
}

// 通用Toast函数
export const showToast = (type: ToastType, config: ToastConfig = {}) => {
  const finalConfig = { ...defaultConfig, ...config }
  
  const toastConfig = {
    title: finalConfig.title,
    description: finalConfig.description,
    duration: finalConfig.duration,
  }

  switch (type) {
    case 'success':
      return toast({
        ...toastConfig,
        title: finalConfig.title || '成功',
      })
    
    case 'error':
      return toast({
        ...toastConfig,
        title: finalConfig.title || '错误',
        variant: 'destructive',
      })
    
    case 'warning':
      return toast({
        ...toastConfig,
        title: finalConfig.title || '警告',
      })
    
    case 'info':
      return toast({
        ...toastConfig,
        title: finalConfig.title || '提示',
      })
    
    default:
      return toast(toastConfig)
  }
}

// 便捷函数
export const showSuccess = (description: string, title?: string) => {
  return showToast('success', { title, description })
}

export const showError = (description: string, title?: string) => {
  return showToast('error', { title, description })
}

export const showWarning = (description: string, title?: string) => {
  return showToast('warning', { title, description })
}

export const showInfo = (description: string, title?: string) => {
  return showToast('info', { title, description })
}

// 文件操作相关的Toast
export const showFileUploadError = (error?: string) => {
  return showError(error || '文件上传失败，请检查文件大小或网络后重试。', '上传失败')
}

export const showFileUploadSuccess = (description?: string) => {
  return showSuccess(description || '文件上传成功', '上传成功')
}

// 用户操作相关的Toast
export const showLoginSuccess = () => {
  return showSuccess('登录成功', '欢迎回来')
}

export const showLoginError = (error?: string) => {
  return showError(error || '登录失败，请检查用户名和密码。', '登录失败')
}

export const showRegisterSuccess = () => {
  return showSuccess('注册成功', '账户创建成功')
}

export const showRegisterError = (error?: string) => {
  return showError(error || '注册失败，请重试。', '注册失败')
}

export const showLogoutSuccess = () => {
  return showSuccess('已成功退出登录', '退出成功')
}

// 网络错误相关的Toast
export const showNetworkError = () => {
  return showError('网络连接失败，请检查网络后重试。', '网络错误')
}

export const showServerError = () => {
  return showError('服务器错误，请稍后重试。', '服务器错误')
}

// 权限相关的Toast
export const showUnauthorizedError = () => {
  return showError('您没有权限执行此操作。', '权限不足')
}

export const showSessionExpiredError = () => {
  return showError('登录已过期，请重新登录。', '会话过期')
} 