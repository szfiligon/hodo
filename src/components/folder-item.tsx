"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, X, GripVertical } from "lucide-react"
import { Folder } from "@/lib/types"
import { useTodoStore } from "@/lib/store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface FolderItemProps {
  folder: Folder
  isSelected: boolean
  onSelect?: () => void
}

export function FolderItem({ folder, isSelected, onSelect }: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { setSelectedFolder, deleteFolder, updateFolder } = useTodoStore()

  // Drag and drop functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    if (editName.trim()) {
      updateFolder(folder.id, editName.trim(), folder.color)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditName(folder.name)
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-50' : ''}`}
    >
      {isEditing ? (
        <div className="flex items-center gap-2 p-2">
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: folder.color || '#0078d4' }}
          />
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleSave}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => {
            if (onSelect) {
              onSelect()
            } else {
              setSelectedFolder(folder.id)
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
            isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
          }`}
        >
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: folder.color || '#0078d4' }}
          />
          <span className="flex-1 text-left truncate">{folder.name}</span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {/* Drag handle - subtle and only visible on hover */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-gray-300 hover:text-gray-500" />
            </div>
          </div>
        </div>
      )}
      
      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="删除列表"
        description={`确定要删除列表"${folder.name}"吗？此操作将同时删除列表中的所有任务，且无法撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={() => {
          deleteFolder(folder.id)
          setShowDeleteConfirm(false)
        }}
      />
    </div>
  )
} 