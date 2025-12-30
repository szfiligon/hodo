"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquare, X, Bell, AlertCircle, Info, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Message {
  id: string
  msg: string
  type: string
  read: boolean
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface MessageListProps {
  isOpen: boolean
  onClose: () => void
  onMessageStatusChange?: () => void
}

export function MessageList({ isOpen, onClose, onMessageStatusChange }: MessageListProps) {
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const { toast } = useToast()

  // 获取消息列表
  const fetchMessages = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/messages?page=${page}&pageSize=50`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setMessages(result.data.messages)
          setPagination(result.data.pagination)
          setCurrentPage(page)
        }
      } else {
        throw new Error('获取消息失败')
      }
    } catch (error) {
      console.error('获取消息失败:', error)
      toast({
        title: "获取消息失败",
        description: "无法加载消息列表，请稍后重试",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // 标记消息已读
  const markMessagesAsRead = async (messageIds: string[]) => {
    try {
      const response = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // 更新本地状态
          setMessages(prev => 
            prev.map(msg => 
              messageIds.includes(msg.id) ? { ...msg, read: true } : msg
            )
          )
          
          // 通知父组件消息状态发生变化
          if (onMessageStatusChange) {
            onMessageStatusChange()
          }
          
          toast({
            title: "标记成功",
            description: result.message,
          })
        }
      } else {
        throw new Error('标记已读失败')
      }
    } catch (error) {
      console.error('标记已读失败:', error)
      toast({
        title: "标记失败",
        description: "无法标记消息为已读，请稍后重试",
        variant: "destructive"
      })
    }
  }

  // 标记全部已读
  const markAllAsRead = () => {
    const unreadIds = messages.filter(msg => !msg.read).map(msg => msg.id)
    if (unreadIds.length > 0) {
      markMessagesAsRead(unreadIds)
    }
  }

  // 分页导航
  const goToPage = (page: number) => {
    if (page >= 1 && pagination && page <= pagination.totalPages) {
      fetchMessages(page)
    }
  }

  // 组件挂载时获取消息
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // 根据消息类型获取图标和样式
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'expiry':
        return <AlertCircle className="h-4 w-4 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // 根据消息类型获取样式类
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'feature':
        return 'border-l-4 border-l-blue-500 bg-blue-50';
      case 'expiry':
        return 'border-l-4 border-l-green-500 bg-green-50';
      case 'info':
      default:
        return 'border-l-4 border-l-gray-500 bg-gray-50';
    }
  };

  if (!isOpen) return null

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">消息列表</h1>
            <p className="text-gray-600">查看您的所有消息和通知</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无消息</h3>
            <p className="text-gray-600">您还没有收到任何消息</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg ${getMessageStyle(message.type)} ${
                  message.read 
                    ? 'opacity-75' 
                    : 'ring-2 ring-blue-200 cursor-pointer hover:ring-blue-400 hover:shadow-md transition-all duration-200'
                }`}
                onClick={() => !message.read && markMessagesAsRead([message.id])}
                title={!message.read ? '点击标记为已读' : ''}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getMessageIcon(message.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-medium text-gray-900 leading-tight">
                          {message.msg}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          message.type === 'feature' ? 'bg-blue-100 text-blue-700' :
                          message.type === 'expiry' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {message.type === 'feature' ? '功能提醒' :
                           message.type === 'expiry' ? '到期提醒' : '系统通知'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(message.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {!message.read && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-blue-600 font-medium">未读</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                第 {currentPage} 页，共 {pagination.totalPages} 页
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={!pagination.hasNext}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm text-gray-600">
              共 {pagination.totalCount} 条消息
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            共 {pagination?.totalCount || 0} 条消息 • {messages.filter(m => !m.read).length} 条未读
          </span>
          <button 
            onClick={markAllAsRead}
            disabled={messages.filter(m => !m.read).length === 0}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            标记全部已读
          </button>
        </div>
      </div>
    </div>
  )
} 