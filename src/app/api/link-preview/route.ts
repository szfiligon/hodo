import { NextRequest, NextResponse } from "next/server"
import { authenticateUser } from "@/lib/auth"
import logger from "@/lib/logger"

function extractTitle(html: string): string | null {
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  if (ogTitleMatch?.[1]) {
    return ogTitleMatch[1].trim()
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!titleMatch?.[1]) {
    return null
  }

  return titleMatch[1].replace(/\s+/g, " ").trim()
}

export async function GET(request: NextRequest) {
  try {
    await authenticateUser(request, { skipUnlockCheck: true })

    const url = request.nextUrl.searchParams.get("url")?.trim()
    if (!url) {
      return NextResponse.json({ success: false, error: "Missing url parameter" }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid url" }, { status: 400 })
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ success: false, error: "Unsupported protocol" }, { status: 400 })
    }

    const headers: Record<string, string> = {
      "User-Agent": "hodo-link-preview/1.0",
      Accept: "text/html,application/xhtml+xml",
    }

    const isSameHost = parsedUrl.host === request.nextUrl.host
    if (isSameHost) {
      const cookieHeader = request.headers.get("cookie")
      if (cookieHeader) {
        headers.Cookie = cookieHeader
      }
    }

    const response = await fetch(parsedUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Failed to fetch url" }, { status: 502 })
    }

    const html = await response.text()
    const title = extractTitle(html)

    return NextResponse.json({
      success: true,
      title: title || parsedUrl.hostname,
      url: parsedUrl.toString(),
    })
  } catch (error) {
    logger.error("Link preview failed", error as Error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
