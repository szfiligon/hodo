"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Plus, Loader2, X } from "lucide-react"
import { TaskStep } from "@/lib/types"
import { useTodoStore } from "@/lib/store"

interface TaskStepsProps {
  taskId: string
}

export function TaskSteps({ taskId }: TaskStepsProps) {
  console.log('TaskSteps: component rendered with taskId', taskId)
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [newStepTitle, setNewStepTitle] = useState("")
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)
  const { addTaskStep, deleteTaskStep, toggleTaskStep, updateTaskStep, getTaskSteps } = useTodoStore()

  const loadSteps = useCallback(async () => {
    try {
      const taskSteps = await getTaskSteps(taskId)
      setSteps(taskSteps)
    } catch (error) {
      console.error('Error loading task steps:', error)
    }
  }, [taskId, getTaskSteps])

  // Load steps when component mounts or taskId changes
  useEffect(() => {
    console.log('TaskSteps: taskId changed to', taskId)
    // Force reset all state when taskId changes
    setSteps([])
    setNewStepTitle("")
    setIsAddingStep(false)
    setEditingStepId(null)
    setEditingTitle("")
    // Then load new steps
    loadSteps()
  }, [taskId, loadSteps])

  // Cleanup function to reset editing state when component unmounts
  useEffect(() => {
    return () => {
      setEditingStepId(null)
      setEditingTitle("")
    }
  }, [])



  const handleAddStep = async () => {
    if (!newStepTitle.trim()) return

    setIsAddingStep(true)
    try {
      const success = await addTaskStep(taskId, newStepTitle.trim())
      if (success) {
        setNewStepTitle("")
        // Reload steps to get the updated list
        await loadSteps()
        // Focus back to input after adding step
        setTimeout(() => {
          inputRef?.focus()
        }, 100)
      } else {
        console.error('Failed to add task step')
      }
    } catch (error) {
      console.error('Error adding task step:', error)
    } finally {
      setIsAddingStep(false)
    }
  }

  const handleToggleStep = async (stepId: string) => {
    try {
      const success = await toggleTaskStep(stepId)
      if (success) {
        // Update local state
        setSteps(steps.map(step =>
          step.id === stepId
            ? { ...step, completed: !step.completed }
            : step
        ))
      } else {
        console.error('Failed to toggle task step')
      }
    } catch (error) {
      console.error('Error toggling task step:', error)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    try {
      const success = await deleteTaskStep(stepId)
      if (success) {
        // Remove from local state
        setSteps(steps.filter(step => step.id !== stepId))
      } else {
        console.error('Failed to delete task step')
      }
    } catch (error) {
      console.error('Error deleting task step:', error)
    }
  }

  const handleStartEdit = (step: TaskStep) => {
    console.log('TaskSteps: starting edit for step', step.id, 'in task', taskId)
    setEditingStepId(step.id)
    setEditingTitle(step.title)
  }

  const handleSaveEdit = async () => {
    if (!editingStepId || !editingTitle.trim()) return

    try {
      const success = await updateTaskStep(editingStepId, editingTitle.trim())
      if (success) {
        // Update local state
        setSteps(steps.map(step =>
          step.id === editingStepId
            ? { ...step, title: editingTitle.trim() }
            : step
        ))
        setEditingStepId(null)
        setEditingTitle("")
      } else {
        console.error('Failed to update task step')
      }
    } catch (error) {
      console.error('Error updating task step:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingStepId(null)
    setEditingTitle("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddStep()
    }
  }

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">任务步骤</h3>
        <div className="text-xs text-gray-500">
          {steps.filter(step => step.completed).length} / {steps.length} 完成
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-0">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-center w-6 h-6">
              <Checkbox
                checked={step.completed}
                onCheckedChange={() => handleToggleStep(step.id)}
                className="w-5 h-5"
              />
            </div>
            
            <div className="flex-1 min-h-0">
              {editingStepId === step.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={handleEditKeyPress}
                  onBlur={handleSaveEdit}
                  className="w-full text-base font-medium leading-none border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 px-2 py-1 transition-colors"
                  autoFocus
                />
              ) : (
                <label
                  className={`block text-base font-medium leading-none cursor-pointer hover:text-blue-600 ${
                    step.completed
                      ? 'text-gray-500'
                      : 'text-gray-900'
                  }`}
                  onClick={() => handleStartEdit(step)}
                >
                  {step.title}
                </label>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {editingStepId === step.id ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:text-gray-700"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
              
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                onClick={() => handleDeleteStep(step.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Step */}
      <div className="flex gap-2">
        <input
          ref={setInputRef}
          type="text"
          value={newStepTitle}
          onChange={(e) => setNewStepTitle(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="添加新步骤..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
          disabled={isAddingStep}
        />
        <Button
          size="sm"
          onClick={handleAddStep}
          disabled={!newStepTitle.trim() || isAddingStep}
          className="px-3 py-2"
        >
          {isAddingStep ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Empty State */}
      {steps.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">暂无步骤</p>
          <p className="text-xs mt-1">点击上方输入框添加第一个步骤</p>
        </div>
      )}
    </div>
  )
} 