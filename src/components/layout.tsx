"use client"

import { useState, useEffect } from "react"
import { useTodoStore } from "@/lib/store"
import { FolderItem } from "./folder-item"
import { AddFolder } from "./add-folder"
import { UserProfile } from './user-profile'
import { MessageList } from './message-list'
import { TagManagerPage } from './tag-manager-page'
import { ArchivedTasksPage } from './archived-tasks-page'
import { Button } from "./ui/button"
import { MessageSquare, Settings, Tag } from "lucide-react"
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"


interface LayoutProps {
  children: React.ReactNode
}

// 定义视图类型
type ViewType = 'tasks' | 'messages' | 'tags' | 'archived'

export function Layout({ children }: LayoutProps) {
  const { selectedFolderId, currentUser, reorderFolders, getSortedFolders } = useTodoStore()
  const [currentView, setCurrentView] = useState<ViewType>('tasks')
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)

  // Get sorted folders for current user
  const userFolders = currentUser ? getSortedFolders(currentUser.id) : []

  // 检查是否有未读消息
  const checkUnreadMessages = async () => {
    try {
      const response = await fetch('/api/messages/has-unread')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setHasUnreadMessages(result.data.hasUnread)
        }
      }
    } catch (error) {
      console.error('检查未读消息失败:', error)
    }
  }

  // 定期检查未读消息
  useEffect(() => {
    if (currentUser) {
      // 初始检查
      checkUnreadMessages()
      
      // 每10分钟检查一次 (10 * 60 * 1000 = 600000 毫秒)
      const interval = setInterval(checkUnreadMessages, 600000)
      
      return () => clearInterval(interval)
    }
  }, [currentUser])

  // 当切换到消息视图时，重新检查未读消息
  useEffect(() => {
    if (currentView === 'messages') {
      checkUnreadMessages()
    }
  }, [currentView])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = userFolders.findIndex(folder => folder.id === active.id)
      const newIndex = userFolders.findIndex(folder => folder.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderFolders(oldIndex, newIndex)
      }
    }
  }

  const switchToView = (view: ViewType) => {
    setCurrentView(view)
  }

  const handleFolderSelect = (folderId: string) => {
    // 切换到任务视图
    setCurrentView('tasks')
    // 选择文件夹
    useTodoStore.getState().setSelectedFolder(folderId)
  }

  // 监听返回到任务视图的事件
  useEffect(() => {
    const handleSwitchToTasks = () => {
      setCurrentView('tasks')
    }

    window.addEventListener('switchToTasks', handleSwitchToTasks)
    
    return () => {
      window.removeEventListener('switchToTasks', handleSwitchToTasks)
    }
  }, [])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Hodo</h1>
          </div>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* System Folders */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">快速访问</h3>
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolderId === 'all-tasks' && currentView === 'tasks'
                      ? 'bg-blue-50 text-blue-700' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => handleFolderSelect('all-tasks')}
                >
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#6b7280' }} />
                  <span className="text-sm font-medium">全部任务</span>
                </div>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolderId === 'today-tasks' && currentView === 'tasks'
                      ? 'bg-blue-50 text-blue-700' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => handleFolderSelect('today-tasks')}
                >
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#10b981' }} />
                  <span className="text-sm font-medium">今日任务</span>
                </div>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    currentView === 'archived'
                      ? 'bg-orange-50 text-orange-700' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => switchToView('archived')}
                >
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#f97316' }} />
                  <span className="text-sm font-medium">归档任务</span>
                </div>
              </div>
            </div>

            {/* User Folders */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">任务菜单</h3>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={userFolders.map(folder => folder.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {userFolders.map((folder) => (
                      <FolderItem 
                        key={folder.id} 
                        folder={folder} 
                        isSelected={selectedFolderId === folder.id && currentView === 'tasks'}
                        onSelect={() => handleFolderSelect(folder.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <AddFolder />
            </div>
          </div>
        </div>

        {/* User Profile at Bottom */}
        <div className="border-t border-gray-200">
          {/* Icon Menu */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-around">
              {/* Information Menu */}
              <Button
                variant="ghost"
                size="sm"
                className={`h-10 w-10 p-0 transition-colors duration-200 relative ${
                  currentView === 'messages'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                onClick={() => switchToView('messages')}
              >
                <MessageSquare className="h-5 w-5" />
                {/* 未读消息小红点 */}
                {hasUnreadMessages && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></div>
                )}
              </Button>

              {/* Tag Manager */}
              <Button
                variant="ghost"
                size="sm"
                className={`h-10 w-10 p-0 transition-colors duration-200 ${
                  currentView === 'tags'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                onClick={() => switchToView('tags')}
              >
                <Tag className="h-5 w-5" />
              </Button>

              {/* Settings Button - Opens User Profile */}
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-gray-100 transition-colors duration-200"
                onClick={() => {
                  // 触发用户资料页面的打开
                  const userProfileButton = document.querySelector('[data-user-profile-trigger]') as HTMLButtonElement
                  if (userProfileButton) {
                    userProfileButton.click()
                  }
                }}
                title="用户设置"
              >
                <Settings className="h-5 w-5 text-gray-600" />
              </Button>
            </div>
          </div>
          
          <UserProfile />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'messages' ? (
          <MessageList 
            isOpen={true} 
            onClose={() => switchToView('tasks')} 
            onMessageStatusChange={checkUnreadMessages}
          />
        ) : currentView === 'tags' ? (
          <TagManagerPage />
        ) : currentView === 'archived' ? (
          <ArchivedTasksPage onClose={() => switchToView('tasks')} />
        ) : (
          children
        )}
      </div>
    </div>
  )
} 