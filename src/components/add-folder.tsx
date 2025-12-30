"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { useTodoStore } from "@/lib/store"

// 预定义的颜色列表
const availableColors = [
  '#0078d4', '#107c10', '#d83b01', '#e81123', '#b4009e',
  '#5c2d91', '#8e44ad', '#e67e22', '#27ae60', '#3498db',
  '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e'
]

export function AddFolder() {
  const [isAdding, setIsAdding] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { addFolder, folders } = useTodoStore()

  const addDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAdding) return
    function handleClickOutside(event: MouseEvent) {
      if (addDivRef.current && !addDivRef.current.contains(event.target as Node)) {
        setIsAdding(false)
        setFolderName("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAdding])

  // 生成不与现有文件夹颜色重复的默认颜色
  const getDefaultColor = () => {
    const existingColors = folders.map(folder => folder.color).filter(Boolean)
    const availableColor = availableColors.find(color => !existingColors.includes(color))
    return availableColor || availableColors[0] // 如果所有颜色都被使用，返回第一个
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      setIsLoading(true)
      try {
        const defaultColor = getDefaultColor()
        const success = await addFolder(folderName.trim(), defaultColor)
        if (success) {
          setFolderName("")
          setIsAdding(false)
        } else {
          // You could show an error message here
          console.error('Failed to create folder')
        }
      } catch (error) {
        console.error('Error creating folder:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCancel = () => {
    setFolderName("")
    setIsAdding(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        onClick={() => setIsAdding(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        新建列表
      </Button>
    )
  }

  return (
    <div ref={addDivRef} className="p-3 border-t">
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded"
              style={{ backgroundColor: getDefaultColor() }}
            />
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="列表名称"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
              autoFocus
              disabled={isLoading}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!folderName.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                '添加列表'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              取消
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 