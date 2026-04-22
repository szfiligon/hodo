"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { SearchResult } from "@/lib/types"

interface SearchMediaPanelProps {
  query: string
  results: SearchResult[]
  isLoading: boolean
  onOpenTask?: (taskId: string) => void
}

interface MediaGroup {
  taskId: string
  taskTitle: string
  images: SearchResult[]
  files: SearchResult[]
}

type MediaFilter = "all" | "image" | "file"

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "未知大小"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function SearchMediaPanel({ query, results, isLoading, onOpenTask }: SearchMediaPanelProps) {
  const [previewImages, setPreviewImages] = useState<SearchResult[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")

  const allMediaResults = useMemo(
    () => results.filter((result) => result.type === "image" || result.type === "file"),
    [results]
  )

  const filteredMediaResults = useMemo(
    () =>
      allMediaResults.filter((result) => {
        if (mediaFilter === "all") return true
        return result.type === mediaFilter
      }),
    [allMediaResults, mediaFilter]
  )

  const groups = useMemo(() => {
    const grouped = new Map<string, MediaGroup>()

    for (const result of filteredMediaResults) {
      const taskId = result.taskId || "unknown-task"
      const existingGroup = grouped.get(taskId) || {
        taskId,
        taskTitle: result.taskTitle || "未关联任务",
        images: [],
        files: [],
      }

      if (result.type === "image") {
        existingGroup.images.push(result)
      } else {
        existingGroup.files.push(result)
      }
      grouped.set(taskId, existingGroup)
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const dateA = a.images[0]?.createdAt || a.files[0]?.createdAt || ""
      const dateB = b.images[0]?.createdAt || b.files[0]?.createdAt || ""
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
  }, [filteredMediaResults])

  const allImageCount = useMemo(
    () => allMediaResults.filter((result) => result.type === "image").length,
    [allMediaResults]
  )
  const allFileCount = useMemo(
    () => allMediaResults.filter((result) => result.type === "file").length,
    [allMediaResults]
  )

  const openImagePreview = (groupImages: SearchResult[], index: number) => {
    setPreviewImages(groupImages)
    setPreviewIndex(index)
    setIsPreviewOpen(true)
  }

  const currentPreviewImage = previewImages[previewIndex]

  const handleDownload = (result: SearchResult) => {
    const fileId = result.fileId || result.id
    const link = document.createElement("a")
    link.href = `/api/files/${fileId}`
    link.download = result.title
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!query.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        输入关键词后可在此查看图片和文件结果
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        共找到 <span className="font-medium text-gray-900">{allImageCount}</span> 张图片，
        <span className="font-medium text-gray-900"> {allFileCount} </span> 个文件
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMediaFilter("all")}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              mediaFilter === "all"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("image")}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              mediaFilter === "image"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            仅图片
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("file")}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              mediaFilter === "file"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            仅文件
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">当前筛选下没有结果，试试切换到“全部”或其它筛选</p>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.taskId} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{group.taskTitle}</h3>
              <p className="text-xs text-muted-foreground">
                图片 {group.images.length} 张 · 文件 {group.files.length} 个
              </p>
            </div>
            {group.taskId !== "unknown-task" && onOpenTask && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenTask(group.taskId)}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                打开任务
              </Button>
            )}
          </div>

          {group.images.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                <ImageIcon className="h-3.5 w-3.5" />
                图片
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {group.images.map((image, index) => {
                  const fileId = image.fileId || image.id
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => openImagePreview(group.images, index)}
                      className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
                    >
                      <Image
                        src={`/api/files/${fileId}`}
                        alt={image.title}
                        fill
                        unoptimized
                        className="object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-2 py-1 text-left text-[11px] text-white">
                        {image.title}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {group.files.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                <FileText className="h-3.5 w-3.5" />
                文件
              </div>
              <div className="space-y-2">
                {group.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{file.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)} · {new Date(file.createdAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleDownload(file)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl bg-black p-2 text-white sm:p-4">
          <DialogHeader>
            <DialogTitle className="pr-10 text-sm text-white">
              {currentPreviewImage?.title || "图片预览"} ({previewIndex + 1}/{previewImages.length})
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center">
            {currentPreviewImage && (
              <Image
                src={`/api/files/${currentPreviewImage.fileId || currentPreviewImage.id}`}
                alt={currentPreviewImage.title}
                width={1600}
                height={1200}
                unoptimized
                className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            )}

            {previewImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                  onClick={() => setPreviewIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                  onClick={() => setPreviewIndex((prev) => (prev + 1) % previewImages.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
