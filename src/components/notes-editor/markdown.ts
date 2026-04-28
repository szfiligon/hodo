"use client"

import { $createParagraphNode, $createTextNode, $getRoot } from "lexical"

export function loadMarkdownToEditor(markdown: string): void {
  const content = markdown ?? ""
  const root = $getRoot()
  root.clear()

  const lines = content.split("\n")
  for (const line of lines) {
    const paragraph = $createParagraphNode()
    if (line.length > 0) {
      paragraph.append($createTextNode(line))
    }
    root.append(paragraph)
  }
}

export function exportEditorToMarkdown(): string {
  const root = $getRoot()
  return root
    .getChildren()
    .map((node) => node.getTextContent())
    .join("\n")
}
