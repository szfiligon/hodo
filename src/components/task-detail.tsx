"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Check, Trash2, Loader2, Calendar, User, FileText, Star } from "lucide-react"
import { Task } from "@/lib/types"
import { useTodoStore, useTagFeatureStore } from "@/lib/store"
import { TaskFiles } from "./task-files"
import { TagSelector } from "./tag-selector"
import { showFileUploadSuccess, showFileUploadError } from "@/lib/toast"
import { openExternalLink } from "@/lib/utils"


import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'

interface TaskDetailProps {
  task: Task
  onUpdate: (updatedTask: Task) => void
  onDelete: (taskId: string) => void
  onClose: () => void
}

export function TaskDetail({ task, onUpdate, onDelete, onClose }: TaskDetailProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editNotes, setEditNotes] = useState(task.notes || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const { toggleTask, updateTask, updateTaskNotes, toggleTodayTask, deleteTask, uploadTaskFile, updateTaskTags, getTaskFiles } = useTodoStore()
  const { isEnabled: isTagFeatureEnabled } = useTagFeatureStore()
  const mdEditorRef = useRef<HTMLDivElement>(null)
  const taskFilesRef = useRef<{ reloadFiles: () => void } | null>(null)

  // Update local state when task changes
  useEffect(() => {
    setEditTitle(task.title)
    setEditNotes(task.notes || '')
    setIsEditingTitle(false)
  }, [task.id, task.title, task.notes, task.updatedAt])

  // 处理备注变化
  const handleNotesChange = (value: string | undefined) => {
    const notes = value || ''
    setEditNotes(notes)
  }

  // 处理备注获得焦点
  const handleNotesFocus = () => {
    // 焦点处理逻辑（如果需要的话）
  }

  // 处理备注失去焦点
  const handleNotesBlur = () => {
    // 直接保存，无需延迟
    handleNotesSave()
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      // 清理逻辑（如果需要的话）
    }
  }, [])

  // 提取备注中的链接
  const extractLinks = (text: string) => {
    // 匹配各种类型的链接
    const urlRegex = /(https?:\/\/[^\s\)\]\}]+)/g
    const links: string[] = []
    let match
    
    while ((match = urlRegex.exec(text)) !== null) {
      // 清理链接末尾的标点符号
      let link = match[1]
      link = link.replace(/[.,;:!?\)\]\}]$/, '')
      if (link && !links.includes(link)) {
        links.push(link)
      }
    }
    
    return links
  }

  // 处理链接点击
  const handleLinkClick = async (url: string) => {
    await openExternalLink(url);
  }

  // 处理粘贴图片事件
  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        event.preventDefault()
        
        const file = item.getAsFile()
        if (!file) continue

        // 检查文件大小 (30MB 限制)
        const maxSize = 30 * 1024 * 1024
        if (file.size > maxSize) {
          showFileUploadError('图片文件过大，最大支持 30MB')
          return
        }

        // 为粘贴的图片生成文件名
        const timestamp = Date.now()
        const extension = file.type.split('/')[1] || 'png'
        const fileName = `pasted-image-${timestamp}.${extension}`
        
        // 创建新的 File 对象，使用生成的文件名
        const renamedFile = new File([file], fileName, { type: file.type })

        setIsUploadingImage(true)
        try {
          const success = await uploadTaskFile(task.id, renamedFile)
          if (success) {
            showFileUploadSuccess('图片已成功上传为附件')
            const files = await getTaskFiles(task.id)
            const latestFile = [...files].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0]
            if (latestFile) {
              // 在备注中插入可访问的文件链接
              const imageRef = `![${latestFile.originalName}](/api/files/${latestFile.id})`
              const newNotes = editNotes + (editNotes ? '\n\n' : '') + imageRef
              setEditNotes(newNotes)
            }
            // 刷新文件列表
            taskFilesRef.current?.reloadFiles()
          } else {
            showFileUploadError('图片上传失败')
          }
        } catch (error) {
          console.error('Error uploading pasted image:', error)
          showFileUploadError('图片上传时发生错误')
        } finally {
          setIsUploadingImage(false)
        }
        break
      }
    }
  }




  const handleTitleSave = async () => {
    if (editTitle.trim()) {
      setIsLoading(true)
      try {
        const success = await updateTask(task.id, editTitle.trim())
        if (success) {
          setIsEditingTitle(false)
          // Update the task in the detail view
          const updatedTask = { ...task, title: editTitle.trim() }
          onUpdate(updatedTask)
        } else {
          console.error('Failed to update task')
        }
      } catch (error) {
        console.error('Error updating task:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleTitleCancel = () => {
    setEditTitle(task.title)
    setIsEditingTitle(false)
  }

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }

  const handleNotesSave = async () => {
    if (editNotes === task.notes) return // No change needed
    
    setIsLoading(true)
    try {
      const success = await updateTaskNotes(task.id, editNotes)
      if (success) {
        // Update the task in the detail view
        const updatedTask = { ...task, notes: editNotes, updatedAt: new Date() }
        onUpdate(updatedTask)
        console.log('Notes saved on blur')
      } else {
        console.error('Failed to update task notes')
        // Revert to original value on failure
        setEditNotes(task.notes || '')
      }
    } catch (error) {
      console.error('Error updating task notes:', error)
      // Revert to original value on error
      setEditNotes(task.notes || '')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleToday = async () => {
    setIsLoading(true)
    try {
      const success = await toggleTodayTask(task.id)
      if (success) {
        const updatedTask = { ...task, isTodayTask: !task.isTodayTask, updatedAt: new Date() }
        onUpdate(updatedTask)
      } else {
        console.error('Failed to toggle today task')
      }
    } catch (error) {
      console.error('Error toggling today task:', error)
    } finally {
      setIsLoading(false)
    }
  }



  const handleToggle = async () => {
    setIsLoading(true)
    try {
      await toggleTask(task.id)
      // Update the task in the detail view
      const updatedTask = { ...task, completed: !task.completed }
      onUpdate(updatedTask)
    } catch (error) {
      console.error('Error toggling task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteTask(task.id)
      onDelete(task.id)
      onClose()
    } catch (error) {
      console.error('Error deleting task:', error)
    } finally {
      setIsLoading(false)
    }
  }



  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            onClick={handleToggle}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : task.completed ? (
              <Check className="h-5 w-5 text-blue-600" />
            ) : null}
          </Button>
          {isEditingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyPress}
              onBlur={handleTitleSave}
              className="flex-1 text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0"
              autoFocus
              disabled={isLoading}
            />
          ) : (
            <h2 
              className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 flex-1"
              onClick={() => setIsEditingTitle(true)}
            >
              {task.title}
            </h2>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-gray-700"
          onClick={handleDelete}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">

          {/* Today Task Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* Today Task Toggle */}
              <div className="w-48 space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-medium text-gray-900">今日任务</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={task.isTodayTask ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center justify-between w-full h-10 ${
                      task.isTodayTask 
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={handleToggleToday}
                    disabled={isLoading}
                  >
                    <span className="flex-1 text-left">
                      {task.isTodayTask ? '今日任务' : '添加到今日任务'}
                    </span>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

            </div>
          </div>

          {/* Tags Section */}
          {isTagFeatureEnabled && (
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <TagSelector
                selectedTags={(() => {
                  try {
                    if (!task || !task.tags || typeof task.tags !== 'string') {
                      return []
                    }
                    return task.tags.split(',').filter(t => t.trim())
                  } catch (error) {
                    console.error('Error processing task tags:', error)
                    return []
                  }
                })()}
                onTagsChange={(tags) => {
                  const updatedTask = { ...task, tags: tags.join(',') }
                  onUpdate(updatedTask)
                }}
                onTagsUpdate={async (tags) => {
                  // 标签已通过 API 更新到数据库，这里同步更新store中的任务列表
                  await updateTaskTags(task.id, tags)
                  // 同时更新任务详情视图
                  const updatedTask = { ...task, tags: tags.join(',') }
                  onUpdate(updatedTask)
                }}
                taskId={task.id}
              />
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-medium text-gray-900">备注</h3>
              {isUploadingImage && (
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>上传图片中...</span>
                </div>
              )}
            </div>
            <div className="w-full">
              <style jsx global>{`
                .w-md-editor {
                  border: 1px solid #e5e7eb !important;
                  border-radius: 0.75rem !important;
                  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06) !important;
                  transition: all 0.2s ease-in-out !important;
                  background-color: #f9fafb !important;
                  height: auto !important;
                  min-height: 200px !important;
                  max-height: 400px !important;
                }
                
                .w-md-editor:hover {
                  border-color: #d1d5db !important;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                }
                
                .w-md-editor:focus-within {
                  border-color: #3b82f6 !important;
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
                  background-color: #ffffff !important;
                }
                
                .w-md-editor .w-md-editor-text,
                .w-md-editor .w-md-editor-text * {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                  font-size: 0.875rem !important;
                  font-weight: 400 !important;
                  line-height: 1.5 !important;
                  color: #374151 !important;
                }
                
                .w-md-editor .w-md-editor-text {
                  padding: 12px !important;
                  background-color: transparent !important;
                  height: auto !important;
                  min-height: 200px !important;
                  max-height: 400px !important;
                  resize: none !important;
                }
                
                .w-md-editor .w-md-editor-text:focus {
                  outline: none !important;
                }
                
                .w-md-editor .w-md-editor-text h1,
                .w-md-editor .w-md-editor-text h2,
                .w-md-editor .w-md-editor-text h3,
                .w-md-editor .w-md-editor-text h4,
                .w-md-editor .w-md-editor-text h5,
                .w-md-editor .w-md-editor-text h6 {
                  font-weight: 600 !important;
                  color: #111827 !important;
                }
                
                .w-md-editor .w-md-editor-text p,
                .w-md-editor .w-md-editor-text div,
                .w-md-editor .w-md-editor-text span {
                  font-weight: 400 !important;
                  color: #374151 !important;
                }
                
                .w-md-editor .w-md-editor-text ul,
                .w-md-editor .w-md-editor-text ol {
                  font-weight: 400 !important;
                  color: #374151 !important;
                }
                
                .w-md-editor .w-md-editor-text li {
                  font-weight: 400 !important;
                  color: #374151 !important;
                }
                
                /* 覆盖MDEditor的默认样式 */
                .w-md-editor .w-md-editor-text textarea {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                  font-size: 0.875rem !important;
                  font-weight: 400 !important;
                  line-height: 1.5 !important;
                  color: #374151 !important;
                }
              `}</style>
              <MDEditor
                  value={editNotes}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
                  onFocus={handleNotesFocus}
                  onPaste={handlePaste}
                  preview="edit"
                  height="auto"
                  minHeight={200}
                  maxHeight={400}
                  hideToolbar={true}
                  className="w-full"
                  data-color-mode="light"
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  ref={mdEditorRef}
                />
              
              {/* 链接列表 */}
              {extractLinks(editNotes).length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">备注中的链接</span>
                  </div>
                  <div className="space-y-2">
                    {extractLinks(editNotes).map((link, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          onClick={() => handleLinkClick(link)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate flex-1 text-left cursor-pointer"
                          title={link}
                        >
                          {link}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Files Section */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <TaskFiles 
              taskId={task.id} 
              ref={taskFilesRef}
              onFileUploaded={() => {
                // 文件上传成功后的回调
              }}
            />
          </div>



          {/* Task Information */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Created: {formatDate(task.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Updated: {formatDate(task.updatedAt)}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>Task ID: {task.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 