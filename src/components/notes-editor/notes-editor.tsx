"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { extractUniqueUrls, fetchLinkTitles, getHostnameFallback } from "./link-preview-service"

type NotesEditorProps = {
  value: string
  placeholder?: string
  isLoading?: boolean
  onChange: (markdown: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onPaste?: (event: React.ClipboardEvent<HTMLElement>) => void
}

export function NotesEditor({
  value,
  placeholder = "输入备注，支持 Markdown 与链接自动识别",
  isLoading = false,
  onChange,
  onFocus,
  onBlur,
  onPaste,
}: NotesEditorProps) {
  const [linkTitles, setLinkTitles] = useState<Record<string, string>>({})
  const debounceRef = useRef<number | null>(null)

  const urls = useMemo(() => extractUniqueUrls(value), [value])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    const pending = urls.filter((url) => !linkTitles[url])
    if (pending.length === 0) return

    debounceRef.current = window.setTimeout(async () => {
      try {
        const updates = await fetchLinkTitles(pending)
        if (Object.keys(updates).length > 0) {
          setLinkTitles((prev) => ({ ...prev, ...updates }))
        }
      } finally {}
    }, 500)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [linkTitles, urls])

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={onPaste}
        placeholder={placeholder}
        className="min-h-[180px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />

      {urls.length > 0 && (
        <div className="space-y-1">
          {urls.map((url) => {
            const title = linkTitles[url] || getHostnameFallback(url)
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block truncate rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-blue-600 hover:bg-gray-100 hover:text-blue-800 hover:underline"
                title={`${title} · ${url}`}
              >
                {title}
              </a>
            )
          })}
        </div>
      )}

      {isLoading && <p className="text-xs text-gray-500">保存中...</p>}
    </div>
  )
}
