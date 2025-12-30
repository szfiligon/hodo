"use client"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip, Download, Trash2, Loader2, File } from "lucide-react"
import { TaskFile } from "@/lib/types"
import { useTodoStore } from "@/lib/store"
import { showFileUploadError } from "@/lib/toast"

interface TaskFilesProps {
  taskId: string
  onFileUploaded?: () => void
}

export const TaskFiles = forwardRef<{ reloadFiles: () => void }, TaskFilesProps>(({ taskId, onFileUploaded }, ref) => {
  const [files, setFiles] = useState<TaskFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { getTaskFiles, uploadTaskFile, deleteTaskFile } = useTodoStore()

  // 暴露 reloadFiles 方法给父组件
  useImperativeHandle(ref, () => ({
    reloadFiles
  }))

  // Load files when component mounts
  useEffect(() => {
    const loadFiles = async () => {
      setIsLoading(true)
      try {
        const taskFiles = await getTaskFiles(taskId)
        setFiles(taskFiles)
      } catch (error) {
        console.error('Error loading files:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadFiles()
  }, [taskId, getTaskFiles])

  // 独立的 loadFiles 供上传/删除后调用
  const reloadFiles = async () => {
    setIsLoading(true)
    try {
      const taskFiles = await getTaskFiles(taskId)
      setFiles(taskFiles)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const success = await uploadTaskFile(taskId, file)
      if (success) {
        // Reload files after successful upload
        await reloadFiles()
        // Clear the input
        event.target.value = ''
        // Notify parent component
        onFileUploaded?.()
      } else {
        showFileUploadError()
        console.error('Failed to upload file')
      }
    } catch (error: unknown) {
      showFileUploadError((error as Error)?.message || "文件上传时发生错误")
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileDelete = async (fileId: string) => {
    setIsLoading(true)
    try {
      const success = await deleteTaskFile(fileId)
      if (success) {
        // Reload files after successful delete
        await reloadFiles()
      } else {
        console.error('Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileDownload = async (file: TaskFile) => {
    try {
      const token = localStorage.getItem('hodo_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }

      // 显示下载状态
      const downloadButton = document.querySelector(`[data-file-id="${file.id}"] .download-button`)
      if (downloadButton) {
        downloadButton.innerHTML = '<Loader2 className="h-4 w-4 animate-spin" />'
        downloadButton.setAttribute('disabled', 'true')
      }

      const response = await fetch(`/api/files/${file.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // 检查响应头中的内容长度
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) !== file.fileSize) {
        console.warn(`Content-Length mismatch: expected ${file.fileSize}, got ${contentLength}`)
      }
      
      const blob = await response.blob()
      
      // 验证blob大小
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalName
      link.style.display = 'none'
      
      // 添加到DOM并触发下载
      document.body.appendChild(link)
      link.click()
      
      // 清理
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      console.log(`File downloaded successfully: ${file.originalName} (${blob.size} bytes)`)
    } catch (error) {
      console.error('Error downloading file:', error)
      
      // 显示用户友好的错误信息
      let errorMessage = '下载失败'
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查网络后重试'
        } else if (error.message.includes('HTTP 404')) {
          errorMessage = '文件不存在或已被删除'
        } else if (error.message.includes('HTTP 401')) {
          errorMessage = '登录已过期，请重新登录'
        } else if (error.message.includes('HTTP 500')) {
          errorMessage = '服务器错误，请稍后重试'
        } else {
          errorMessage = `下载失败: ${error.message}`
        }
      }
      
      // 这里可以调用你的toast系统显示错误
      console.error(errorMessage)
    } finally {
      // 恢复下载按钮状态
      const downloadButton = document.querySelector(`[data-file-id="${file.id}"] .download-button`)
      if (downloadButton) {
        downloadButton.innerHTML = '<Download className="h-4 w-4" />'
        downloadButton.removeAttribute('disabled')
      }
    }
  }

  const isImageFile = (fileName: string) => {
    if (!fileName) return false
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1) return false
    const extension = fileName.toLowerCase().substring(lastDotIndex)
    return imageExtensions.includes(extension)
  }

  const handleFileClick = async (file: TaskFile) => {
    if (isImageFile(file.originalName)) {
      // 图片文件：预览
      await handleFilePreview(file)
    } else {
      // 其他文件：下载
      await handleFileDownload(file)
    }
  }

  const handleFilePreview = async (file: TaskFile) => {
    try {
      const token = localStorage.getItem('hodo_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }

      const response = await fetch(`/api/files/${file.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      
      // 验证blob大小
      if (blob.size === 0) {
        throw new Error('Preview file is empty')
      }
      
      const url = window.URL.createObjectURL(blob)
      
      // 在新标签页中打开图片预览
      const newWindow = window.open(url, '_blank')
      
      if (!newWindow) {
        // 如果弹窗被阻止，直接下载文件
        console.warn('Popup blocked, downloading file instead')
        await handleFileDownload(file)
        return
      }
      
      // 延迟清理 URL 对象，确保图片加载完成
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 5000) // 增加延迟时间到5秒
      
      console.log(`File preview opened: ${file.originalName}`)
    } catch (error) {
      console.error('Error previewing file:', error)
      
      // 如果预览失败，尝试下载
      console.log('Preview failed, attempting download instead')
      await handleFileDownload(file)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-medium text-gray-900">附件</h3>
      </div>

      {/* File Upload */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          id="file-upload"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isUploading}
        />
        <label htmlFor="file-upload">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={isUploading}
            asChild
          >
            <span>
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              {isUploading ? '上传中...' : '上传文件'}
            </span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer group"
              onClick={() => handleFileClick(file)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <File className="h-5 w-5 text-gray-500 flex-shrink-0 group-hover:text-blue-600 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.fileSize)} • {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 download-button"
                  onClick={() => handleFileDownload(file)}
                  data-file-id={file.id}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                  onClick={() => handleFileDelete(file.id)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm">
          暂无附件
        </div>
      )}
    </div>
  )
})

TaskFiles.displayName = 'TaskFiles'