"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Check, Trash2, Edit, X, Loader2, Clock, MoreVertical, Pin, PinOff, FolderOpen } from "lucide-react"
import { Task } from "@/lib/types"
import { useTodoStore } from "@/lib/store"
import { formatDateRange } from "@/lib/utils"
import { TaskTags } from "./task-tags"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"

interface TaskItemProps {
  task: Task
  isSelected?: boolean
  isSystemFolder?: boolean
  onClick?: () => void
  onUpdate?: (updatedTask: Task) => void
  onDelete?: (taskId: string) => void
  hideEditDelete?: boolean // 新增：控制是否隐藏编辑和删除按钮
}

export function TaskItem({ task, isSelected = false, isSystemFolder = false, onClick, onUpdate, onDelete, hideEditDelete = false }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [isLoading, setIsLoading] = useState(false)
  const [isMovingTask, setIsMovingTask] = useState(false)
  const { toggleTask, deleteTask, updateTask, pinTask, unpinTask, isTaskPinned, selectedFolderId, moveTask, folders, currentUser, tasks } = useTodoStore()

  // 从store中获取最新的任务数据，确保标签变更时能够同步显示
  const currentTask = tasks.find(t => t.id === task.id) || task

  // 当store中的任务数据更新时，同步更新本地状态
  useEffect(() => {
    if (currentTask && currentTask.title !== editTitle && !isEditing) {
      setEditTitle(currentTask.title)
    }
  }, [currentTask, editTitle, isEditing])

  const handleSave = async () => {
    if (editTitle.trim()) {
      setIsLoading(true)
      try {
        const success = await updateTask(currentTask.id, editTitle.trim())
        if (success) {
          setIsEditing(false)
          // Notify parent component about the update
          if (onUpdate) {
            const updatedTask = { ...currentTask, title: editTitle.trim() }
            onUpdate(updatedTask)
          }
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

  const handleCancel = () => {
    setEditTitle(currentTask.title)
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      await toggleTask(currentTask.id)
      // Notify parent component about the update
      if (onUpdate) {
        const updatedTask = { ...currentTask, completed: !currentTask.completed }
        onUpdate(updatedTask)
      }
    } catch (error) {
      console.error('Error toggling task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteTask(currentTask.id)
      // Notify parent component about the deletion
      if (onDelete) {
        onDelete(currentTask.id)
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    if (onClick && !isEditing) {
      onClick()
    }
  }

  const handlePinToggle = () => {
    if (!selectedFolderId) return
    
    if (isTaskPinned(currentTask.id, selectedFolderId)) {
      unpinTask(currentTask.id, selectedFolderId)
    } else {
      pinTask(currentTask.id, selectedFolderId)
    }
  }

  const handleMoveTask = async (targetFolderId: string) => {
    setIsMovingTask(true)
    try {
      const success = await moveTask(currentTask.id, targetFolderId)
      if (success) {
        // Update the task in the list
        const updatedTask = { ...currentTask, folderId: targetFolderId, updatedAt: new Date() }
        if (onUpdate) {
          onUpdate(updatedTask)
        }
      } else {
        console.error('Failed to move task')
      }
    } catch (error) {
      console.error('Error moving task:', error)
    } finally {
      setIsMovingTask(false)
    }
  }

  const isPinned = selectedFolderId ? isTaskPinned(currentTask.id, selectedFolderId) : false

  // 获取可移动的目标文件夹（排除当前文件夹）
  const availableFolders = folders.filter(folder => 
    folder.userId === currentUser?.id && folder.id !== currentTask.folderId
  )

  return (
    <div 
      className={`flex items-start gap-3 p-3 rounded-lg group cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-blue-50 outline outline-blue-200 outline-offset-0' 
          : 'hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 mt-0.5"
        onClick={(e) => {
          e.stopPropagation()
          handleToggle()
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentTask.completed ? (
          <Check className="h-4 w-4 text-blue-600" />
        ) : null}
      </Button>
      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            autoFocus
            disabled={isLoading}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center min-w-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span 
                className={`truncate ${
                  currentTask.completed ? 'line-through text-gray-500' : 'text-gray-900'
                }`}
              >
                {currentTask.title}
              </span>
              
              {/* 标签显示 - 紧跟任务标题 */}
              <TaskTags tagsString={currentTask.tags} className="flex-shrink-0" />
            </div>
            
            {(currentTask.startDate || currentTask.dueDate) && (
              <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 ml-2">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">{formatDateRange(currentTask.startDate, currentTask.dueDate)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 置顶图标 - 已完成的任务不显示置顶标记 */}
      {!isEditing && isPinned && !currentTask.completed && (
        <div className="flex items-center mr-2 mt-0.5">
          <Pin className="h-3 w-3 text-blue-600" />
        </div>
      )}
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                handleCancel()
              }}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {!hideEditDelete && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                  }}
                  disabled={isLoading}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {!isSystemFolder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete()
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </>
            )}
            
            {/* 右键菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  disabled={isLoading}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                {/* 置顶选项 - 已完成的任务不显示 */}
                {!currentTask.completed && (
                  <DropdownMenuItem 
                    onClick={handlePinToggle}
                    className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {isPinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        取消置顶
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        置顶任务
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                
                {/* 移动到子菜单 */}
                {availableFolders.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer hover:bg-gray-50">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      移动到
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[160px]">
                      {isMovingTask && (
                        <DropdownMenuItem disabled className="text-xs text-blue-600 px-2 py-1">
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                          移动中...
                        </DropdownMenuItem>
                      )}
                      {availableFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => handleMoveTask(folder.id)}
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1"
                          disabled={isMovingTask}
                        >
                          <div
                            className="w-3 h-3 rounded mr-2"
                            style={{ backgroundColor: folder.color || '#0078d4' }}
                          />
                          <span className="flex-1 text-sm">{folder.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  )
} 