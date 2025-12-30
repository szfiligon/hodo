"use client"

import { useState } from "react"
import { X, Plus, Tag, Edit, Trash2, Check, ArrowLeft, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ColorPicker } from "@/components/ui/color-picker"
import { useTagFeatureStore } from "@/lib/store"
import { useTagsCache } from "@/lib/hooks/use-tags-cache"

interface TagManagerProps {
  onBack: () => void
}

interface Tag {
  id: string
  name: string
  color: string
  selectable: boolean
  createdAt?: string
  updatedAt?: string
}

export function TagManager({ onBack }: TagManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3B82F6")
  const [editingName, setEditingName] = useState("")
  const [editingColor, setEditingColor] = useState("")
  const [editingSelectable, setEditingSelectable] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  
  const { isEnabled, toggle } = useTagFeatureStore()
  const { tags, refetch } = useTagsCache()

  // 添加新标签
  const addTag = async () => {
    if (!newTagName.trim()) {
      return
    }

    const name = newTagName.trim()
    const color = newTagColor
    // 新创建的标签默认可选择
    const selectable = true

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, color, selectable }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setNewTagName("")
          setNewTagColor("#3B82F6") // 重置为默认颜色
          // 重新获取标签列表以确保数据同步
          refetch()
        }
      } else {
        console.error('添加标签失败')
      }
    } catch (error) {
      console.error('添加标签失败:', error)
    }
  }

  // 开始编辑
  const startEdit = (tag: Tag) => {
    setEditingId(tag.id)
    setEditingName(tag.name)
    setEditingColor(tag.color)
    setEditingSelectable(tag.selectable)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
    setEditingColor("")
  }

  // 保存编辑
  const saveEdit = async (tagId: string) => {
    if (!editingName.trim()) {
      return
    }

    const name = editingName.trim()
    const color = editingColor
    const selectable = editingSelectable

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, color, selectable }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEditingId(null)
          setEditingName("")
          setEditingColor("")
          setEditingSelectable(true)
          // 重新获取标签列表以确保数据同步
          refetch()
        }
      } else {
        console.error('更新标签失败')
      }
    } catch (error) {
      console.error('更新标签失败:', error)
    }
  }

  // 打开删除确认对话框
  const openDeleteDialog = (tag: Tag) => {
    setTagToDelete(tag)
    setDeleteDialogOpen(true)
  }

  // 确认删除标签
  const confirmDelete = async () => {
    if (!tagToDelete) return

    try {
      const response = await fetch(`/api/tags/${tagToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // 如果删除的是正在编辑的标签，取消编辑状态
          if (editingId === tagToDelete.id) {
            setEditingId(null)
            setEditingName("")
            setEditingColor("")
          }
          
          // 重新获取标签列表以确保数据同步
          refetch()
        }
      } else {
        console.error('删除标签失败')
      }
    } catch (error) {
      console.error('删除标签失败:', error)
    } finally {
      setDeleteDialogOpen(false)
      setTagToDelete(null)
    }
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent, action: 'add' | 'edit', tagId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (action === 'add') {
        addTag()
      } else if (action === 'edit' && tagId) {
        saveEdit(tagId)
      }
    } else if (e.key === 'Escape') {
      if (action === 'edit') {
        cancelEdit()
      }
    }
  }

  // 移除 useEffect，因为 useTagsCache 会自动处理数据获取

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">标签管理</h1>
          </div>
        </div>
      </div>

      {/* 添加新标签 */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-3">添加新标签</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded border-2 border-gray-200 shadow-sm"
              style={{ backgroundColor: newTagColor }}
            />
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="输入标签名称"
              onKeyPress={(e) => handleKeyPress(e, 'add')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* 取色盘 */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <ColorPicker
              color={newTagColor}
              onColorChange={setNewTagColor}
              showLabel={false}
              className="max-w-lg"
            />
          </div>
          

          
          <div className="flex gap-2">
            <Button
              onClick={addTag}
              disabled={!newTagName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加标签
            </Button>
          </div>
        </div>
      </div>

      {/* 标签列表 */}
      <div className="flex-1 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Tag className="h-12 w-12 mb-2 opacity-50" />
            <p>暂无标签</p>
            <p className="text-sm">创建你的第一个标签</p>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {editingId === tag.id ? (
                  // 编辑模式
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded border-2 border-gray-200 shadow-sm"
                        style={{ backgroundColor: editingColor }}
                      />
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'edit', tag.id)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    
                    {/* 编辑时的取色盘 */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <ColorPicker
                        color={editingColor}
                        onColorChange={setEditingColor}
                        showLabel={false}
                        className="max-w-lg"
                      />
                    </div>
                    
                    {/* 编辑时的可选择控制 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`editingSelectable-${tag.id}`}
                        checked={editingSelectable}
                        onChange={(e) => setEditingSelectable(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor={`editingSelectable-${tag.id}`} className="text-sm text-gray-700">
                        此标签可用
                      </label>
                    </div>
                  </div>
                ) : (
                  // 显示模式
                  <>
                    <div
                      className="w-6 h-6 rounded border-2 border-gray-200 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                      {tag.name}
                    </span>
                    <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                      {tag.color}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${tag.selectable ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-xs text-gray-500">
                        {tag.selectable ? '可用' : '不可用'}
                      </span>
                    </div>
                  </>
                )}
                
                <div className="flex items-center gap-1">
                  {editingId === tag.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveEdit(tag.id)}
                        className="h-6 w-6 text-green-600 hover:text-green-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelEdit}
                        className="h-6 w-6 text-gray-600 hover:text-gray-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(tag)}
                        className="h-6 w-6 text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(tag)}
                        className="h-6 w-6 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 标签功能开关 */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className={`rounded-lg border p-4 transition-all duration-200 ${
          isEnabled 
            ? 'bg-white border-gray-200' 
            : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors duration-200 ${
                isEnabled 
                  ? 'bg-blue-100' 
                  : 'bg-gray-200'
              }`}>
                <Tag className={`h-5 w-5 transition-colors duration-200 ${
                  isEnabled 
                    ? 'text-blue-600' 
                    : 'text-gray-500'
                }`} />
              </div>
              <div>
                <h3 className={`text-base font-semibold transition-colors duration-200 ${
                  isEnabled 
                    ? 'text-gray-800' 
                    : 'text-gray-600'
                }`}>标签功能控制</h3>
                <p className={`text-sm transition-colors duration-200 ${
                  isEnabled 
                    ? 'text-gray-600' 
                    : 'text-gray-500'
                }`}>
                  {isEnabled 
                    ? '标签功能已启用，任务中显示标签区块'
                    : '标签功能已禁用，任务中不会显示标签区块'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={toggle}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                isEnabled 
                  ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400 shadow-sm' 
                  : 'bg-gray-100 border-gray-400 text-gray-600 hover:bg-gray-200 hover:border-gray-500 shadow-sm'
              }`}
              title={isEnabled ? '点击禁用标签功能' : '点击启用标签功能'}
            >
              {isEnabled ? (
                <>
                  <ToggleRight className="h-4 w-4" />
                  <span className="text-sm font-medium">功能已启用</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">功能已禁用</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除标签"
        description={`确定要删除标签 "${tagToDelete?.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  )
}
