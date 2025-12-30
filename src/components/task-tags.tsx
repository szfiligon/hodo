"use client"

import { Tag } from "lucide-react"
import { useTagFeatureStore } from "@/lib/store"
import { useTagsCache } from "@/lib/hooks/use-tags-cache"

interface TaskTagsProps {
  tagsString?: string
  className?: string
}

interface TagInfo {
  id: string
  name: string
  color: string
}

export function TaskTags({ tagsString, className = "" }: TaskTagsProps) {
  const { isEnabled: isTagFeatureEnabled } = useTagFeatureStore()
  const { tags: allTags, loading } = useTagsCache()

  // 从缓存中过滤出当前任务使用的标签
  const taskTags = allTags.filter(tag => {
    if (!tagsString) return false
    try {
      const tagIds = tagsString.split(',').filter(t => t.trim())
      return tagIds.includes(tag.id)
    } catch (err) {
      console.log('TaskTags filter error', err)
      return false
    }
  })

  // 移除 useEffect，因为现在直接从缓存获取数据

  // 如果标签功能被禁用，直接返回 null
  if (!isTagFeatureEnabled) {
    return null
  }

  if (!tagsString || taskTags.length === 0) {
    return null
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Tag className="h-3 w-3 text-gray-400 animate-pulse" />
        <span className="text-xs text-gray-400">加载中...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 flex-shrink-0 ${className}`}>
      {taskTags.map((tag: TagInfo) => (
        <div
          key={tag.id}
          className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs border border-gray-200 hover:bg-gray-200 transition-colors"
          title={tag.name}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span className="text-gray-600 truncate max-w-20 hidden sm:inline">
            {tag.name}
          </span>
        </div>
      ))}
    </div>
  )
}
