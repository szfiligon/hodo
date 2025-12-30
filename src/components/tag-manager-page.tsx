"use client"

import { TagManager } from "./tag-manager"

export function TagManagerPage() {
  const handleBack = () => {
    // 这里需要通过某种方式返回到任务视图
    // 暂时使用事件系统
    window.dispatchEvent(new CustomEvent('switchToTasks'))
  }

  return <TagManager onBack={handleBack} />
}
