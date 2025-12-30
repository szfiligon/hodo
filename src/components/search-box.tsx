"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, CheckCircle, Circle, FileText } from "lucide-react"
import { getAuthHeaders } from "@/lib/store"
import { useTagsCache } from "@/lib/hooks/use-tags-cache"

interface SearchResult {
  id: string
  title: string
  type: 'task' | 'step'
  completed: boolean
  folderId?: string
  taskId?: string
  notes?: string
  tags?: string
  createdAt: string
}

interface SearchBoxProps {
  placeholder?: string
  onSearch?: (query: string) => void
  onResultSelect?: (result: SearchResult) => void
  disabled?: boolean
}

export function SearchBox({ 
  placeholder = "搜索任务标题、备注或标签...", 
  onSearch,
  onResultSelect,
  disabled = false 
}: SearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { tags } = useTagsCache()

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: {
          ...getAuthHeaders(),
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSearchResults(data.results)
          setShowDropdown(data.results.length > 0)
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 防抖搜索
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      await performSearch(searchQuery)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, performSearch])

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch?.(value)
  }

  const handleResultClick = (result: SearchResult) => {
    onResultSelect?.(result)
    setShowDropdown(false)
    setSearchQuery("")
  }

  const getResultIcon = (result: SearchResult) => {
    if (result.type === 'task') {
      return result.completed ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
      ) : (
        <Circle className="w-4 h-4 text-gray-400" />
      )
    } else {
      return <FileText className="w-4 h-4 text-blue-500" />
    }
  }

  const getResultTypeLabel = (result: SearchResult) => {
    return result.type === 'task' ? '任务' : '步骤'
  }

  // 获取标签名称的函数
  const getTagNames = (tagIds: string) => {
    if (!tagIds || !tags) return []
    const tagIdArray = tagIds.split(',').map(id => id.trim()).filter(id => id)
    return tagIdArray
      .map(tagId => {
        const tag = tags.find(t => t.id === tagId)
        return tag ? tag.name : null
      })
      .filter(tagName => tagName !== null) // 过滤掉已删除的标签
  }

  return (
    <div className="mb-6 relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 border-0 border-b border-gray-300 focus:border-blue-500 focus:ring-0 focus:outline-none bg-transparent rounded-sm transition-colors placeholder-gray-400"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* 搜索结果下拉框 */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* 搜索结果提示 */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            找到 {searchResults.length} 条结果
            <div className="text-xs text-gray-500 mt-1">
              支持搜索：任务标题、备注、标签
            </div>
          </div>
          
          {/* 搜索结果列表 */}
          <div className="max-h-96 overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getResultIcon(result)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </span>
                      {result.type === 'task' && result.tags && result.tags.trim() && (() => {
                        const tagNames = getTagNames(result.tags)
                        return tagNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tagNames.map((tagName, index) => (
                              <span 
                                key={index} 
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                              >
                                {tagName}
                              </span>
                            ))}
                          </div>
                        ) : null
                      })()}
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {getResultTypeLabel(result)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(result.createdAt).toLocaleDateString('zh-CN')}
                      {result.type === 'task' && result.notes && result.notes.trim() && (
                        <div className="text-xs text-gray-400 mt-1 max-w-full overflow-hidden">
                          <div className="truncate">
                            {result.notes.length > 100 ? `${result.notes.substring(0, 100)}...` : result.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 