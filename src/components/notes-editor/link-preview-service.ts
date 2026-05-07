"use client"

export type LinkTitleMap = Record<string, string>

const linkTitleCache = new Map<string, string>()

export function getCachedLinkTitle(url: string): string | undefined {
  return linkTitleCache.get(url)
}

export function setCachedLinkTitle(url: string, title: string): void {
  if (!url || !title) return
  linkTitleCache.set(url, title)
}

export function getHostnameFallback(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function extractUniqueUrls(text: string): string[] {
  const regex = /(https?:\/\/[^\s)\]}]+)/g
  const dedup = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[.,;:!?)]$/, "")
    if (cleaned) {
      dedup.add(cleaned)
    }
  }

  return Array.from(dedup)
}

async function requestLinkTitle(url: string): Promise<string | null> {
  const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
  if (!response.ok) return null

  const data = await response.json()
  if (!data?.success || typeof data.title !== "string") return null

  const title = data.title.trim()
  return title || null
}

export async function fetchLinkTitles(urls: string[]): Promise<LinkTitleMap> {
  const updates: LinkTitleMap = {}

  await Promise.all(
    urls.map(async (url) => {
      const cached = getCachedLinkTitle(url)
      if (cached) {
        updates[url] = cached
        return
      }

      let title: string | null = null
      try {
        title = await requestLinkTitle(url)
      } catch {
        title = null
      }

      if (!title) {
        // lightweight one-time retry
        try {
          title = await requestLinkTitle(url)
        } catch {
          title = null
        }
      }

      if (title) {
        setCachedLinkTitle(url, title)
        updates[url] = title
      } else {
        const fallback = getHostnameFallback(url)
        setCachedLinkTitle(url, fallback)
        updates[url] = fallback
      }
    })
  )

  return updates
}
