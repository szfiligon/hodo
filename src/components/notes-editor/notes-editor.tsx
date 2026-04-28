"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MutableRefObject } from "react"
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { LinkNode, AutoLinkNode } from "@lexical/link"
import type { LexicalEditor } from "lexical"

import { exportEditorToMarkdown, loadMarkdownToEditor } from "./markdown"
import { extractUniqueUrls, fetchLinkTitles } from "./link-preview-service"

type NotesEditorProps = {
  value: string
  placeholder?: string
  isLoading?: boolean
  onChange: (markdown: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onPaste?: (event: React.ClipboardEvent<HTMLElement>) => void
}

const theme = {
  link: "text-blue-600 underline underline-offset-2 hover:text-blue-800",
}

function SyncFromExternalValuePlugin({
  value,
  internalValueRef,
}: {
  value: string
  internalValueRef: MutableRefObject<string>
}) {
  const [editor] = useLexicalComposerContext()
  const lastExternalValueRef = useRef(value)

  useEffect(() => {
    const externalChanged = value !== lastExternalValueRef.current
    const shouldApplyExternal = externalChanged && value !== internalValueRef.current
    lastExternalValueRef.current = value
    if (!shouldApplyExternal) return
    editor.update(() => {
      loadMarkdownToEditor(value)
    })
    internalValueRef.current = value
  }, [editor, internalValueRef, value])

  return null
}

function serializeMarkdown(editor: LexicalEditor): string {
  let markdown = ""
  editor.getEditorState().read(() => {
    markdown = exportEditorToMarkdown()
  })
  return markdown
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const localValueRef = useRef(value)
  const initialValueRef = useRef(value)

  const urls = useMemo(() => extractUniqueUrls(value), [value])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    const pending = urls.filter((url) => !linkTitles[url])
    if (pending.length === 0) return

    debounceRef.current = window.setTimeout(async () => {
      setIsPreviewLoading(true)
      try {
        const updates = await fetchLinkTitles(pending)
        if (Object.keys(updates).length > 0) {
          setLinkTitles((prev) => ({ ...prev, ...updates }))
        }
      } finally {
        setIsPreviewLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [linkTitles, urls])

  const initialConfig = useMemo(() => {
    return {
      namespace: "hodo-notes-editor",
      theme,
      onError(error: Error) {
        throw error
      },
      nodes: [LinkNode, AutoLinkNode],
      editorState: () => {
        loadMarkdownToEditor(initialValueRef.current)
      },
    }
  }, [])

  return (
    <div className="space-y-2">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="min-h-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-700 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[160px] whitespace-pre-wrap break-words outline-none"
                aria-label="任务备注编辑器"
                onFocus={onFocus}
                onBlur={onBlur}
                onPaste={onPaste}
              />
            }
            placeholder={<div className="pointer-events-none text-sm text-gray-400">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <LinkPlugin />
          <AutoLinkPlugin
            matchers={[
              (text: string) => {
                const match = /(https?:\/\/[^\s)\]}]+)/.exec(text)
                if (!match) return null
                return {
                  index: match.index,
                  length: match[1].length,
                  text: match[1],
                  url: match[1],
                  attributes: { rel: "noreferrer", target: "_blank" },
                }
              },
            ]}
          />
          <OnChangePlugin
            onChange={(_, editor) => {
              const markdown = serializeMarkdown(editor)
              if (markdown === localValueRef.current) return
              localValueRef.current = markdown
              onChange(markdown)
            }}
            ignoreSelectionChange
          />
          <SyncFromExternalValuePlugin value={value} internalValueRef={localValueRef} />
        </div>
      </LexicalComposer>

      {urls.length > 0 && (
        <div className="space-y-2">
          {urls.map((url) => (
            <div key={url} className="rounded-md border border-gray-200 bg-white px-3 py-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                {url}
              </a>
              <p className="mt-1 text-xs text-gray-500">
                {linkTitles[url] || (isPreviewLoading ? "正在获取链接标题..." : "未获取到标题")}
              </p>
            </div>
          ))}
        </div>
      )}

      {isLoading && <p className="text-xs text-gray-500">保存中...</p>}
    </div>
  )
}
