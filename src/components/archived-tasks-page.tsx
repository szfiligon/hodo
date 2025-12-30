"use client"

import { useState, useEffect, useCallback } from "react"
import { useTodoStore } from "@/lib/store"
import { Folder, Task } from "@/lib/types"
import { Button } from "./ui/button"
import { ChevronDown, ChevronRight, RotateCcw, FolderOpen, Archive } from "lucide-react"
import { TaskDetail } from "./task-detail"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

interface ArchivedTasksPageProps {
  onClose: () => void
}

export function ArchivedTasksPage({ onClose }: ArchivedTasksPageProps) {
  const { currentUser, getArchivedFolders, restoreFolder, archiveFolder, getSortedFolders } = useTodoStore()
  const [archivedFolders, setArchivedFolders] = useState<Folder[]>([])
  const [userFolders, setUserFolders] = useState<Folder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFolderToArchive, setSelectedFolderToArchive] = useState<Folder | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  // 新增：存储所有归档任务的状态
  const [archivedTasks, setArchivedTasks] = useState<Map<string, Task[]>>(new Map())

  // 新增：加载所有归档文件夹下的任务
  const loadAllArchivedTasks = useCallback(async (folders: Folder[]) => {
    if (!folders || folders.length === 0) return
    
    const tasksMap = new Map<string, Task[]>()
    
    for (const folder of folders) {
      try {
        const response = await fetch(`/api/tasks?folderId=${folder.id}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            tasksMap.set(folder.id, result.tasks || [])
          }
        }
      } catch (error) {
        console.error(`加载文件夹 ${folder.name} 的任务失败:`, error)
        tasksMap.set(folder.id, [])
      }
    }
    
    setArchivedTasks(tasksMap)
  }, [])

  // 获取归档的文件夹
  const loadArchivedFolders = useCallback(async () => {
    if (!currentUser) return
    
    setIsLoading(true)
    try {
      const folders = await getArchivedFolders(currentUser.id)
      setArchivedFolders(folders)
      
      // 同时加载所有归档文件夹下的任务
      await loadAllArchivedTasks(folders)
    } catch (error) {
      console.error('加载归档文件夹失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser, getArchivedFolders, loadAllArchivedTasks])

  // 新增：重新加载特定文件夹的任务
  const reloadFolderTasks = useCallback(async (folderId: string) => {
    try {
      const response = await fetch(`/api/tasks?folderId=${folderId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setArchivedTasks(prev => new Map(prev).set(folderId, result.tasks || []))
          
          // 如果当前选中的任务在这个文件夹中，更新选中的任务
          if (selectedTask) {
            const updatedTask = result.tasks?.find((t: Task) => t.id === selectedTask.id)
            if (updatedTask) {
              setSelectedTask(updatedTask)
            }
          }
        }
      }
    } catch (error) {
      console.error(`重新加载文件夹 ${folderId} 的任务失败:`, error)
    }
  }, [selectedTask])

  // 获取用户的文件夹列表
  const loadUserFolders = useCallback(async () => {
    if (!currentUser) return
    
    try {
      // 直接使用store中的文件夹数据，避免重复调用API
      const folders = getSortedFolders(currentUser.id)
      setUserFolders(folders)
    } catch (error) {
      console.error('加载用户文件夹失败:', error)
    }
  }, [currentUser, getSortedFolders])

  useEffect(() => {
    if (currentUser) {
      // 先加载用户文件夹（从store中获取，不调用API）
      loadUserFolders()
      // 再加载归档文件夹（需要调用API）
      loadArchivedFolders()
    }
  }, [currentUser, loadArchivedFolders, loadUserFolders])

  // 切换文件夹展开状态
  const toggleFolderExpansion = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  // 恢复文件夹
  const handleRestoreFolder = async (folderId: string) => {
    if (!currentUser) return
    
    try {
      await restoreFolder(folderId)
      // 重新加载归档文件夹和用户文件夹
      await loadArchivedFolders()
      loadUserFolders() // 不需要await，因为只是从store获取数据
    } catch (error) {
      console.error('恢复文件夹失败:', error)
    }
  }

  // 通过选中的文件夹归档
  const handleArchiveSelectedFolder = async () => {
    if (!currentUser || !selectedFolderToArchive) return
    
    setIsArchiving(true)
    
    try {
      const success = await archiveFolder(selectedFolderToArchive.id, currentUser.id)
      if (success) {
        setSelectedFolderToArchive(null)
        // 重新加载归档文件夹和用户文件夹
        await loadArchivedFolders()
        loadUserFolders() // 不需要await，因为只是从store获取数据
      }
    } catch (error) {
      console.error('归档文件夹失败:', error)
    } finally {
      setIsArchiving(false)
    }
  }

  // 选择要归档的文件夹
  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolderToArchive(folder)
    setIsDropdownOpen(false)
  }

  // 选择任务
  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task)
  }

  // 关闭任务详情
  const handleCloseTaskDetail = () => {
    setSelectedTask(null)
  }

  // 新增：处理任务更新
  const handleTaskUpdate = (updatedTask: Task) => {
    // 更新选中的任务
    setSelectedTask(updatedTask)
    
    // 更新对应文件夹的任务列表
    const folderId = updatedTask.folderId
    if (folderId && archivedTasks.has(folderId)) {
      const folderTasks = archivedTasks.get(folderId) || []
      const updatedTasks = folderTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
      setArchivedTasks(prev => new Map(prev).set(folderId, updatedTasks))
    }
    
    // 同时更新 store 中的任务列表，确保数据一致性
    // 这里可以调用 store 的更新方法，但由于归档任务可能不在 store 的 tasks 中
    // 我们主要依赖本地状态管理
  }

  // 新增：处理任务删除后的清理
  const handleTaskDelete = (taskId: string) => {
    // 从所有文件夹的任务列表中移除被删除的任务
    setArchivedTasks(prev => {
      const newMap = new Map(prev)
      for (const [folderId, tasks] of newMap.entries()) {
        const filteredTasks = tasks.filter(task => task.id !== taskId)
        newMap.set(folderId, filteredTasks)
      }
      return newMap
    })
    
    // 如果删除的是当前选中的任务，清空选择
    if (selectedTask?.id === taskId) {
      setSelectedTask(null)
    }
    
    console.log('Task deleted:', taskId)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex">
      {/* 归档任务列表 */}
      <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">归档任务</h1>
            <Button onClick={onClose} variant="outline">
              返回任务列表
            </Button>
          </div>
          
          {/* 通过下拉框选择归档文件夹 */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-2">
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-between"
                    disabled={(userFolders || []).length === 0}
                  >
                    {selectedFolderToArchive ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded"
                          style={{ backgroundColor: selectedFolderToArchive.color || '#0078d4' }}
                        />
                        <span className="truncate">{selectedFolderToArchive.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">
                        {(userFolders || []).length === 0 ? '暂无可归档的菜单' : '选择要归档的菜单'}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full min-w-[200px]" align="start">
                  {(userFolders || []).map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: folder.color || '#0078d4' }}
                      />
                      <span className="truncate">{folder.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleArchiveSelectedFolder}
                disabled={!selectedFolderToArchive || isArchiving}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {isArchiving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                归档
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {(archivedFolders || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <FolderOpen className="h-16 w-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">暂无归档任务</h2>
                <p className="text-gray-500 text-center mb-6">
                  归档的任务菜单将显示在这里
                </p>
              </div>
            ) : (
              (archivedFolders || []).map((folder) => (
                <div key={folder.id} className="border border-gray-200 rounded-lg">
                  {/* 文件夹头部 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleFolderExpansion(folder.id)}>
                      <div className="text-gray-500 hover:text-gray-700">
                        {expandedFolders.has(folder.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      <div 
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: folder.color || '#6b7280' }}
                      />
                      <span className="font-medium text-gray-900 hover:text-gray-700">{folder.name}</span>
                    </div>
                    <Button
                      onClick={() => handleRestoreFolder(folder.id)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      恢复
                    </Button>
                  </div>
                  
                  {/* 任务列表 */}
                  {expandedFolders.has(folder.id) && (
                    <div className="p-2">
                      <ArchivedTaskList 
                        folderId={folder.id} 
                        tasks={archivedTasks.get(folder.id) || []}
                        onTaskSelect={handleTaskSelect}
                        selectedTaskId={selectedTask?.id}
                        onTasksReload={() => reloadFolderTasks(folder.id)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 任务详情 */}
      <div className="w-1/2">
        {selectedTask ? (
          <TaskDetail 
            task={selectedTask} 
            onClose={handleCloseTaskDetail}
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            选择一个任务查看详情
          </div>
        )}
      </div>
    </div>
  )
}

// 归档任务列表组件
interface ArchivedTaskListProps {
  folderId: string
  tasks: Task[]
  onTaskSelect: (task: Task) => void
  selectedTaskId?: string
  onTasksReload: () => void
}

function ArchivedTaskList({ tasks, onTaskSelect, selectedTaskId, onTasksReload }: ArchivedTaskListProps) {
  // 当任务列表为空时，尝试重新加载
  useEffect(() => {
    if (tasks.length === 0) {
      onTasksReload()
    }
  }, [tasks.length, onTasksReload])

  if ((tasks || []).length === 0) {
    return <div className="text-gray-500 text-sm">该菜单下暂无任务</div>
  }

  return (
    <div className="space-y-1">
      {(tasks || []).map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskSelect(task)}
          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-150 ${
            selectedTaskId === task.id
              ? 'bg-blue-50 shadow-sm'
              : 'hover:bg-gray-50 hover:shadow-sm'
          }`}
        >
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            task.completed ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <span className={`text-sm flex-1 min-w-0 truncate ${
            task.completed ? 'line-through text-gray-500' : 'text-gray-900'
          }`}>
            {task.title}
          </span>
          {task.isTodayTask && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex-shrink-0">
              今日
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
