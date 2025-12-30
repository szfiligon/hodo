"use client"

import { useState, useEffect } from "react"
import { Palette } from "lucide-react"

interface ColorPickerProps {
  color: string
  onColorChange: (color: string) => void
  className?: string
  showLabel?: boolean
}



export function ColorPicker({ color, onColorChange, className = "", showLabel = true }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(color)

  useEffect(() => {
    setCustomColor(color)
  }, [color])



  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    setCustomColor(newColor)
    onColorChange(newColor)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">选择颜色</span>
        </div>
      )}
      
      {/* 颜色预览 */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-8 rounded border border-gray-300 shadow-sm"
          style={{ backgroundColor: color }}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />
      </div>


      
      {/* 自定义颜色选择器 */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={customColor}
          onChange={handleCustomColorChange}
          className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
        />
        <span className="text-xs text-gray-600">自定义颜色</span>
      </div>
    </div>
  )
}
