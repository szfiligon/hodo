import { useState, useEffect, useCallback } from 'react'

interface Tag {
  id: string
  name: string
  color: string
  selectable: boolean
  createdAt?: string
  updatedAt?: string
}

interface TagsCache {
  tags: Tag[]
  loading: boolean
  error: string | null
  lastFetched: number | null
}

// 全局缓存状态
let globalCache: TagsCache = {
  tags: [],
  loading: false,
  error: null,
  lastFetched: null
}

// 缓存过期时间：5分钟
const CACHE_EXPIRY = 5 * 60 * 1000

// 订阅者列表
const subscribers = new Set<(cache: TagsCache) => void>()

// 通知所有订阅者
const notifySubscribers = () => {
  subscribers.forEach(callback => callback(globalCache))
}

// 检查缓存是否过期
const isCacheExpired = () => {
  if (!globalCache.lastFetched) return true
  return Date.now() - globalCache.lastFetched > CACHE_EXPIRY
}

// 获取标签数据
const fetchTags = async (): Promise<Tag[]> => {
  try {
    const response = await fetch('/api/tags')
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        return result.data.tags
      }
    }
    throw new Error('Failed to fetch tags')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown error')
  }
}

// 更新缓存
const updateCache = (updates: Partial<TagsCache>) => {
  globalCache = { ...globalCache, ...updates }
  notifySubscribers()
}

// 强制刷新缓存
export const refreshTagsCache = async () => {
  if (globalCache.loading) return globalCache.tags
  
  updateCache({ loading: true, error: null })
  
  try {
    const tags = await fetchTags()
    updateCache({
      tags,
      loading: false,
      error: null,
      lastFetched: Date.now()
    })
    return tags
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    updateCache({
      loading: false,
      error: errorMessage
    })
    throw error
  }
}

// 添加标签到缓存
export const addTagToCache = (tag: Tag) => {
  const existingIndex = globalCache.tags.findIndex(t => t.id === tag.id)
  if (existingIndex >= 0) {
    // 更新现有标签
    globalCache.tags[existingIndex] = tag
  } else {
    // 添加新标签
    globalCache.tags.push(tag)
  }
  // 按颜色字符串排序，然后按名称倒序排序
  globalCache.tags.sort((a, b) => {
    // 颜色排序（优先级最高）
    const colorComparison = a.color.localeCompare(b.color)
    if (colorComparison !== 0) return colorComparison
    
    // 如果颜色相同，按名称倒序排序
    const nameComparison = b.name.localeCompare(a.name)
    return nameComparison
  })
  updateCache({ tags: [...globalCache.tags] })
}

// 从缓存中移除标签
export const removeTagFromCache = (tagId: string) => {
  globalCache.tags = globalCache.tags.filter(t => t.id !== tagId)
  updateCache({ tags: [...globalCache.tags] })
}

// 更新缓存中的标签
export const updateTagInCache = (tagId: string, updates: Partial<Tag>) => {
  const tagIndex = globalCache.tags.findIndex(t => t.id === tagId)
  if (tagIndex >= 0) {
    globalCache.tags[tagIndex] = { ...globalCache.tags[tagIndex], ...updates }
    // 按颜色字符串排序，然后按名称倒序排序
    globalCache.tags.sort((a, b) => {
      // 颜色排序（优先级最高）
      const colorComparison = a.color.localeCompare(b.color)
      if (colorComparison !== 0) return colorComparison
      
      // 如果颜色相同，按名称倒序排序
      const nameComparison = b.name.localeCompare(a.name)
      return nameComparison
    })
    updateCache({ tags: [...globalCache.tags] })
  }
}

// Hook
export const useTagsCache = () => {
  const [cache, setCache] = useState<TagsCache>(globalCache)

  useEffect(() => {
    // 订阅缓存更新
    const handleCacheUpdate = (newCache: TagsCache) => {
      setCache(newCache)
    }
    
    subscribers.add(handleCacheUpdate)
    
    // 如果缓存为空或已过期，自动获取数据
    if (globalCache.tags.length === 0 || isCacheExpired()) {
      refreshTagsCache().catch(console.error)
    }
    
    return () => {
      subscribers.delete(handleCacheUpdate)
    }
  }, [])

  const refetch = useCallback(async () => {
    return await refreshTagsCache()
  }, [])

  return {
    tags: cache.tags,
    loading: cache.loading,
    error: cache.error,
    refetch,
    addTag: addTagToCache,
    removeTag: removeTagFromCache,
    updateTag: updateTagInCache
  }
}
