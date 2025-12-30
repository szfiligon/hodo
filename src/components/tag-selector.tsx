"use client"

import { useState } from "react"
import { Tag, X, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useTagsCache } from "@/lib/hooks/use-tags-cache"

interface TagSelectorProps {
  selectedTags?: string[]
  onTagsChange: (tags: string[]) => void
  taskId: string
  onTagsUpdate?: (tags: string[]) => void // 新增：用于通知父组件标签已更新
}

interface Tag {
  id: string
  name: string
  color: string
  selectable: boolean
}

export function TagSelector({ selectedTags, onTagsChange, taskId, onTagsUpdate }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()
  const { tags, loading } = useTagsCache()

  // 确保 selectedTags 是数组
  const selectedTagsArray = Array.isArray(selectedTags) ? selectedTags : []

  // 添加标签到任务
  const addTagToTask = async (tagId: string) => {
    if (selectedTagsArray.includes(tagId)) {
      return // 标签已存在
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagId }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const newTags = [...selectedTagsArray, tagId]
          onTagsChange(newTags)
          // 通知父组件标签已更新
          if (onTagsUpdate) {
            onTagsUpdate(newTags)
          }
          toast({
            title: "标签添加成功",
          })
        } else {
          toast({
            title: "标签添加失败",
            description: result.error || '未知错误',
            variant: "destructive"
          })
        }
      } else {
        toast({
          title: "标签添加失败",
          description: `HTTP ${response.status}: ${response.statusText}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('添加标签失败:', error)
      toast({
        title: "添加标签失败",
        description: error instanceof Error ? error.message : '未知错误',
        variant: "destructive"
      })
    }
  }

  // 从任务中移除标签
  const removeTagFromTask = async (tagId: string) => {
    console.log('开始移除标签:', { taskId, tagId, currentTags: selectedTagsArray })
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/tags/${tagId}`, {
        method: 'DELETE',
      })

      console.log('标签移除 API 响应状态:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('标签移除 API 响应结果:', result)
        
        if (result.success) {
          const newTags = selectedTagsArray.filter(id => id !== tagId)
          console.log('更新后的标签列表:', newTags)
          
          onTagsChange(newTags)
          // 通知父组件标签已更新
          if (onTagsUpdate) {
            onTagsUpdate(newTags)
          }
          toast({
            title: "标签移除成功",
          })
        } else {
          console.error('标签移除失败:', result)
          toast({
            title: "标签移除失败",
            description: result.error || '未知错误',
            variant: "destructive"
          })
        }
      } else {
        console.error('标签移除 API 请求失败:', response.status, response.statusText)
        toast({
          title: "标签移除失败",
          description: `HTTP ${response.status}: ${response.statusText}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('移除标签失败:', error)
      toast({
        title: "移除标签失败",
        description: error instanceof Error ? error.message : '未知错误',
        variant: "destructive"
      })
    }
  }

  // 获取标签名称
  const getTagName = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId)
    return tag ? tag.name : ''
  }

  // 获取标签颜色
  const getTagColor = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId)
    return tag ? tag.color : '#6B7280'
  }

  // 移除 useEffect，因为 useTagsCache 会自动处理数据获取

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-medium text-gray-900">标签</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-md transition-colors duration-200"
          title={isOpen ? "收起" : "展开"}
        >
          <span className="text-xs text-gray-600">
            {isOpen ? "收起" : "添加"}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* 已选标签 */}
      {selectedTagsArray.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagsArray
            .filter(tagId => getTagName(tagId)) // 过滤掉名称为空的标签
            .map((tagId) => (
            <div
              key={tagId}
              className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getTagColor(tagId) }}
              />
              <span className="text-gray-700">{getTagName(tagId)}</span>
              <button
                onClick={() => removeTagFromTask(tagId)}
                className="p-0.5 hover:bg-gray-200 rounded-full transition-colors duration-200"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 标签选择器 */}
      {isOpen && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="flex flex-wrap gap-1.5">
            {loading ? (
              <div className="w-full text-center py-4 text-gray-500">加载中...</div>
            ) : !tags || tags.length === 0 ? (
              <div className="w-full text-center py-4 text-gray-500">暂无标签</div>
            ) : (
              tags
                .filter(tag => tag.selectable) // 只显示可选择的标签
                .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => addTagToTask(tag.id)}
                  disabled={selectedTagsArray.includes(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors duration-200 min-w-0 ${
                    selectedTagsArray.includes(tag.id)
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'
                      : 'hover:bg-white hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-xs font-medium text-gray-900 truncate">
                    {tag.name}
                  </span>
                  {selectedTagsArray.includes(tag.id) && (
                    <span className="ml-1 text-xs text-gray-500 flex-shrink-0">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedTagsArray.length === 0 && !isOpen && (
        <div className="text-sm text-gray-500">点击&quot;添加&quot;按钮选择标签</div>
      )}
    </div>
  )
}
