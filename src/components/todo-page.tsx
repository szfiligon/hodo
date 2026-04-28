"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useTodoStore } from "@/lib/store"
import { TaskItem } from "./task-item"
import { AddTask } from "./add-task"
import { TaskDetail } from "./task-detail"
import { SearchBox } from "./search-box"
import { SearchMediaPanel } from "./search-media-panel"
import { TagFilter } from "./tag-filter"
import { Task, SearchMode, SearchResult, TaskStep } from "@/lib/types"
import { openExternalLink } from "@/lib/utils"

export function TodoPage() {
  const { selectedFolderId, folders, tasks, currentUser, loadTodayTasks, getPinnedTasks, pinnedTasksUpdateTrigger } = useTodoStore()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchMode, setSearchMode] = useState<SearchMode>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [stepsByTask, setStepsByTask] = useState<Record<string, TaskStep[]>>({})
  const lastStepsRequestKeyRef = useRef<string>("")
  const inFlightStepsRequestKeyRef = useRef<string | null>(null)
  
  // Filter folders by current user
  const userFolders = folders.filter(folder => folder.userId === currentUser?.id)
  const selectedFolder = userFolders.find(folder => folder.id === selectedFolderId)
  const activeFolderIdSet = useMemo(
    () => new Set(userFolders.filter((folder) => !folder.archived).map((folder) => folder.id)),
    [userFolders]
  )

  const isSameDay = (date: Date, baseDate: Date) => {
    return (
      date.getFullYear() === baseDate.getFullYear() &&
      date.getMonth() === baseDate.getMonth() &&
      date.getDate() === baseDate.getDate()
    )
  }

  // 计算 tasks - 现在直接从store获取，因为已经按需加载了
  const folderFilteredTasks = useMemo(() => {
    if (!currentUser) return [];
    
    if (selectedFolderId === 'all-tasks') {
      return tasks.filter(
        (task) => task.userId === currentUser.id && activeFolderIdSet.has(task.folderId)
      );
    } else if (selectedFolderId === 'today-tasks') {
      const now = new Date()
      return tasks.filter((task) => {
        if (!task.isTodayTask || task.userId !== currentUser.id) return false
        if (!task.completed) return true
        return isSameDay(new Date(task.updatedAt), now)
      });
    } else if (selectedFolder && selectedFolderId) {
      return tasks.filter(task => 
        task.folderId === selectedFolderId && task.userId === currentUser.id
      );
    }
    return [];
  }, [selectedFolderId, selectedFolder, tasks, currentUser, activeFolderIdSet]);

  // 应用标签筛选
  const filteredTasks = useMemo(() => {
    if (selectedTags.length > 0) {
      return folderFilteredTasks.filter(task => {
        if (!task.tags) return false;
        const taskTagIds = task.tags.split(',').filter(t => t.trim());
        return selectedTags.some(selectedTagId => taskTagIds.includes(selectedTagId));
      });
    }
    return folderFilteredTasks;
  }, [folderFilteredTasks, selectedTags]);

  // 计算 folderName 和 folderColor
  const { folderName, folderColor } = useMemo(() => {
    if (selectedFolderId === 'all-tasks') {
      return { folderName: '全部任务', folderColor: '#6b7280' };
    } else if (selectedFolderId === 'today-tasks') {
      return { folderName: '今日任务', folderColor: '#10b981' };
    } else if (selectedFolder && selectedFolderId) {
      return { folderName: selectedFolder.name, folderColor: selectedFolder.color || '#0078d4' };
    }
    return { folderName: '', folderColor: '#0078d4' };
  }, [selectedFolderId, selectedFolder]);

  const shouldShowTaskFolderHint = selectedFolderId === 'all-tasks' || selectedFolderId === 'today-tasks'

  const folderNameMap = useMemo(() => {
    return new Map(userFolders.map((folder) => [folder.id, folder.name]))
  }, [userFolders])

  // 获取置顶任务列表
  const pinnedTaskIds = useMemo(() => {
    if (!selectedFolderId) return []
    return getPinnedTasks(selectedFolderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, getPinnedTasks, pinnedTasksUpdateTrigger])

  // 按置顶状态和后端排序结果进行排序
  const sortedTasks = useMemo(() => {
    return filteredTasks.slice().sort((a, b) => {
      // 已完成的任务不参与置顶排序，保持后端返回的顺序
      if (a.completed || b.completed) {
        return 0;
      }
      
      const aIsPinned = pinnedTaskIds.includes(a.id)
      const bIsPinned = pinnedTaskIds.includes(b.id)
      
      // 置顶任务排在前面
      if (aIsPinned && !bIsPinned) return -1
      if (!aIsPinned && bIsPinned) return 1
      
      // 如果都是置顶任务，按置顶时间排序（最新的在前面）
      if (aIsPinned && bIsPinned) {
        const aPinnedIndex = pinnedTaskIds.indexOf(a.id)
        const bPinnedIndex = pinnedTaskIds.indexOf(b.id)
        return aPinnedIndex - bPinnedIndex
      }
      
      // 非置顶任务保持后端返回的顺序（已完成状态 + 到期时间 + 更新时间）
      // 后端已经按照我们的要求排序了，这里不需要重新排序
      return 0;
    });
  }, [filteredTasks, pinnedTaskIds]);

  const completedTasks = sortedTasks.filter(task => task.completed)
  const activeTasks = sortedTasks.filter(task => !task.completed)

  const formatMinuteDuration = (minutes: number) => {
    const safeMinutes = Math.max(0, Math.round(minutes))
    const hours = Math.floor(safeMinutes / 60)
    const mins = safeMinutes % 60
    if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
    if (hours > 0) return `${hours}小时`
    return `${mins}分钟`
  }

  const getStepActualMinutes = (step: TaskStep) => {
    if (!step.startedAt || !step.completedAt) return 0
    const start = new Date(step.startedAt).getTime()
    const end = new Date(step.completedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
    return Math.round((end - start) / 60000)
  }

  const totalEstimatedMinutes = Object.values(stepsByTask).flat().reduce((sum, step) => sum + step.estimatedMinutes, 0)
  const totalActualMinutes = Object.values(stepsByTask).flat().reduce((sum, step) => sum + getStepActualMinutes(step), 0)
  const totalDiffMinutes = totalActualMinutes - totalEstimatedMinutes

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    setSelectedTask(updatedTask)
  }

  const handleTaskDelete = (taskId: string) => {
    if (selectedTask?.id === taskId) {
      setSelectedTask(null)
    }
  }

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags)
  }

  const openTaskById = async (taskId: string) => {
    const { getTaskById, setSelectedFolder } = useTodoStore.getState()

    let task = tasks.find(t => t.id === taskId)

    if (!task) {
      const fetchedTask = await getTaskById(taskId)
      if (fetchedTask) {
        useTodoStore.setState(state => ({
          tasks: [...state.tasks, fetchedTask]
        }))
        task = fetchedTask
      }
    }

    if (task) {
      setSelectedTask(task)
      if (task.folderId !== selectedFolderId) {
        setSelectedFolder(task.folderId)
      }
    }
  }

  // 处理搜索结果选择
  const handleSearchResultSelect = async (result: SearchResult) => {
    if (result.type === 'task') {
      await openTaskById(result.id)
      return
    }
    if (result.taskId) {
      await openTaskById(result.taskId)
    }
  }

  const handleSearchStateChange = useCallback(({
    query,
    mode,
    results,
    isLoading,
  }: {
    query: string
    mode: SearchMode
    results: SearchResult[]
    isLoading: boolean
  }) => {
    setSearchQuery(query)
    setSearchMode(mode)
    setSearchResults(results)
    setSearchLoading(isLoading)
  }, [])

  // 处理外部链接点击
  const handleExternalLink = async (url: string) => {
    await openExternalLink(url);
  };

  // 修复：如果 selectedTask 已经不在 tasks 里，自动关闭详情页
  useEffect(() => {
    if (selectedTask && !filteredTasks.find(t => t.id === selectedTask.id)) {
      setSelectedTask(null)
    }
  }, [filteredTasks, selectedTask])

  useEffect(() => {
    let cancelled = false
    const loadStepsForCurrentList = async () => {
      const taskIds = filteredTasks.map((task) => task.id)
      const requestKey = [...taskIds].sort().join(",")

      if (!requestKey) {
        lastStepsRequestKeyRef.current = ""
        if (!cancelled) {
          setStepsByTask({})
        }
        return
      }

      if (
        requestKey === lastStepsRequestKeyRef.current ||
        requestKey === inFlightStepsRequestKeyRef.current
      ) {
        return
      }

      inFlightStepsRequestKeyRef.current = requestKey
      const stepMap = await useTodoStore.getState().getTaskStepsByTaskIds(taskIds)
      if (inFlightStepsRequestKeyRef.current === requestKey) {
        inFlightStepsRequestKeyRef.current = null
      }
      if (!cancelled) {
        setStepsByTask(stepMap)
        lastStepsRequestKeyRef.current = requestKey
      }
    }
    void loadStepsForCurrentList()
    return () => {
      cancelled = true
    }
  }, [filteredTasks])

  // 当选择今日任务时，调用API获取最新数据
  useEffect(() => {
    if (selectedFolderId === 'today-tasks' && currentUser) {
      loadTodayTasks()
    }
  }, [selectedFolderId, currentUser, loadTodayTasks])

  // 当文件夹切换时，重置标签筛选
  useEffect(() => {
    setSelectedTags([])
    setSearchMode("all")
    setSearchQuery("")
    setSearchResults([])
    setSearchLoading(false)
  }, [selectedFolderId])

  const detailPanelRef = useRef<HTMLDivElement>(null)
  const hasMediaResults = searchResults.some((result) => result.type === "image" || result.type === "file")
  const isMediaSearchActive =
    searchMode === "media" &&
    searchQuery.trim().length > 0 &&
    (searchLoading || hasMediaResults)

  useEffect(() => {
    if (!selectedTask) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      
      // 检查是否点击的是下拉框相关元素
      const isDropdownElement = target.closest('[data-radix-popper-content-wrapper]') ||
                               target.closest('[role="menu"]') ||
                               target.closest('[role="menuitem"]') ||
                               target.closest('[data-state="open"]')
      
      if (detailPanelRef.current && !detailPanelRef.current.contains(target) && !isDropdownElement) {
        setSelectedTask(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [selectedTask])

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!selectedFolderId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">欢迎使用 Hodo</h2>
          <p className="text-gray-600 mb-8">从侧边栏选择一个列表开始使用</p>
          <button 
            onClick={() => handleExternalLink("https://openx.huawei.com/hodo/overview")}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 font-medium leading-relaxed bg-transparent border-none cursor-pointer mb-8"
          >
            联系我：提交BUG 或 解锁账号
          </button>
          <p className="text-sm text-gray-400">版本 v1.1.0</p>
        </div>
      </div>
    )
  }

  // 如果显示标签管理，直接返回标签管理组件
  // if (showTagManager) { // This block is removed as per the edit hint
  //   return <TagManager onBack={handleTagManagerBack} />
  // }

  return (
    <div className="h-full flex relative">
      {/* Task List Panel */}
      <div className={`${selectedTask ? 'w-1/2' : 'w-full'} border-r border-gray-200 overflow-y-auto`}>
        <div className="p-4">
          {/* 搜索框，仅样式，无逻辑 */}
          <SearchBox 
            key={selectedFolderId}
            placeholder="搜索任务..." 
            onResultSelect={handleSearchResultSelect}
            onSearchStateChange={handleSearchStateChange}
          />

          {isMediaSearchActive && (
            <SearchMediaPanel
              query={searchQuery}
              results={searchResults}
              isLoading={searchLoading}
              onOpenTask={openTaskById}
            />
          )}

          {!isMediaSearchActive && (
            <>
          <div className="mb-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="h-5 w-5 rounded"
                style={{ backgroundColor: folderColor }}
              />
              <h1 className="text-xl font-bold text-gray-900">{folderName}</h1>
            </div>
            <p className="text-sm text-gray-600">
              {filteredTasks.length} {filteredTasks.length === 1 ? '个任务' : '个任务'}
              {completedTasks.length > 0 && (
                <span className="text-green-600">
                  • {completedTasks.length} 已完成
                </span>
              )}
              {selectedTags.length > 0 && (
                <span className="ml-2 text-blue-600">
                  • 已筛选 {selectedTags.length} 个标签
                </span>
              )}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              总预计 {formatMinuteDuration(totalEstimatedMinutes)}
              <span className="mx-1">|</span>
              总实际 {formatMinuteDuration(totalActualMinutes)}
              <span className="mx-1">|</span>
              总差值 {totalDiffMinutes >= 0 ? "+" : ""}{formatMinuteDuration(Math.abs(totalDiffMinutes))}
            </p>
          </div>

          <div className="space-y-3">
            {/* Add Task - Only show for user folders, not system folders */}
            {selectedFolderId && selectedFolderId !== 'all-tasks' && selectedFolderId !== 'today-tasks' && (
              <AddTask folderId={selectedFolderId} />
            )}
          
            {/* 标签筛选器 */}
            <TagFilter
              tasks={folderFilteredTasks}
              selectedTags={selectedTags}
              onTagsChange={handleTagsChange}
              className="mb-3"
            />
            {/* Active Tasks */}
            {activeTasks.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">进行中的任务</h2>
                <div className="space-y-1">
                  {activeTasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      isSelected={selectedTask?.id === task.id}
                      isSystemFolder={selectedFolderId === 'all-tasks' || selectedFolderId === 'today-tasks'}
                      folderName={folderNameMap.get(task.folderId)}
                      showFolderHint={shouldShowTaskFolderHint}
                      onClick={() => handleTaskClick(task)}
                      onUpdate={handleTaskUpdate}
                      onDelete={handleTaskDelete}
                      hideEditDelete={!!selectedTask} // 新增：详情展示时隐藏按钮
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">已完成</h2>
                <div className="space-y-1">
                  {completedTasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      isSelected={selectedTask?.id === task.id}
                      isSystemFolder={selectedFolderId === 'all-tasks' || selectedFolderId === 'today-tasks'}
                      folderName={folderNameMap.get(task.folderId)}
                      showFolderHint={shouldShowTaskFolderHint}
                      onClick={() => handleTaskClick(task)}
                      onUpdate={handleTaskUpdate}
                      onDelete={handleTaskDelete}
                      hideEditDelete={!!selectedTask} // 新增：详情展示时隐藏按钮
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredTasks.length === 0 && (
              <div className="text-center py-10">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无任务</h3>
                <p className="text-gray-600">添加您的第一个任务开始使用</p>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <div
          ref={detailPanelRef}
          className="w-1/2 overflow-y-auto z-40 relative"
        >
          <TaskDetail 
            task={selectedTask} 
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
            onClose={() => setSelectedTask(null)}
          />
        </div>
      )}
    </div>
  )
} 