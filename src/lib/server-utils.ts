import { getUserDataPath } from './user-data'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// 获取用户APPDATA目录下的uploads路径
export function getUploadsPath(): string {
  const userDataPath = getUserDataPath()
  console.log('User data path:', userDataPath)
  const uploadsDir = join(userDataPath, 'uploads')
  console.log('Uploads directory:', uploadsDir)
  
  // 确保目录存在
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true })
  }
  
  return uploadsDir
}

// 获取特定用户的uploads目录
export function getUserUploadsPath(userId: string): string {
  const uploadsDir = getUploadsPath()
  const userUploadsDir = join(uploadsDir, userId)
  console.log('User uploads directory:', userUploadsDir)
  
  // 确保用户目录存在
  if (!existsSync(userUploadsDir)) {
    mkdirSync(userUploadsDir, { recursive: true })
  }
  
  return userUploadsDir
}

// 获取特定任务的uploads目录
export function getTaskUploadsPath(userId: string, taskId: string): string {
  const userUploadsDir = getUserUploadsPath(userId)
  const taskUploadsDir = join(userUploadsDir, taskId)
  console.log('Task uploads directory:', taskUploadsDir)
  
  // 确保任务目录存在
  if (!existsSync(taskUploadsDir)) {
    mkdirSync(taskUploadsDir, { recursive: true })
  }
  
  return taskUploadsDir
} 