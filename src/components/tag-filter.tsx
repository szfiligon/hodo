"use client"

import { useMemo } from "react"
import { Tag } from "lucide-react"
import { useTagsCache } from "@/lib/hooks/use-tags-cache"
import { useTagFeatureStore } from "@/lib/store"
import { Task } from "@/lib/types"

interface TagFilterProps {
  tasks: Task[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  className?: string
}

export function TagFilter({ tasks, selectedTags, onTagsChange, className = "" }: TagFilterProps) {
  const { isEnabled: isTagFeatureEnabled } = useTagFeatureStore()
  const { tags: allTags, loading } = useTagsCache()

  // 获取当前任务列表中所有任务的标签的去重集合
  const availableTags = useMemo(() => {
    // 如果标签功能被禁用，返回空数组
    if (!isTagFeatureEnabled) {
      return []
    }

    const tagIds = new Set<string>()
    
    tasks.forEach(task => {
      if (task.tags) {
        const taskTagIds = task.tags.split(',').filter(t => t.trim())
        taskTagIds.forEach(tagId => tagIds.add(tagId))
      }
    })
    
    return allTags.filter(tag => tagIds.has(tag.id))
  }, [tasks, allTags, isTagFeatureEnabled])

  // 如果标签功能被禁用，直接返回 null
  if (!isTagFeatureEnabled) {
    return null
  }

  // 如果没有可用标签，不显示筛选器
  if (availableTags.length === 0) {
    return null
  }

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 bg-gray-50 rounded-lg ${className}`}>
        <Tag className="h-3 w-3 text-gray-400 animate-pulse" />
        <span className="text-xs text-gray-400">加载中...</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {availableTags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => handleTagToggle(tag.id)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-colors ${
            selectedTags.includes(tag.id)
              ? 'bg-blue-100 border-blue-200 text-blue-700'
              : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 hover:border-gray-300'
          }`}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span>{tag.name}</span>
        </button>
      ))}
    </div>
  )
}
