"use client"

import { useState, useRef } from "react"
import { useTodoStore } from "@/lib/store"

interface AddTaskProps {
  folderId: string
}

export function AddTask({ folderId }: AddTaskProps) {
  // 只保留输入框，移除按钮和左侧圆圈
  const [taskTitle, setTaskTitle] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { addTask } = useTodoStore()

  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (taskTitle.trim()) {
      setIsLoading(true)
      try {
        const success = await addTask(taskTitle.trim(), folderId)
        if (success) {
          setTaskTitle("")
          // 新增：添加任务成功后自动聚焦输入框
          setTimeout(() => {
            inputRef.current?.focus()
          }, 0)
        } else {
          console.error('Failed to create task')
        }
      } catch (error) {
        console.error('Error creating task:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTaskTitle("")
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="p-3">
      <input
        ref={inputRef}
        type="text"
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="添加任务，按回车提交"
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
        autoFocus
        disabled={isLoading}
      />
    </form>
  )
} 