import { Segment, modules, dicts, synonyms, stopwords } from "segmentit"

const MAX_TOKENS = 10

const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "与",
  "及",
  "或",
  "是",
  "在",
  "to",
  "the",
  "a",
  "an",
  "and",
  "or",
])

const normalizeText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

const segmentit = new Segment()
segmentit.use(modules)
segmentit.loadDict(dicts)
segmentit.loadSynonymDict(synonyms)
segmentit.loadStopwordDict(stopwords)

const isUsableToken = (token: string) => {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.length <= 1) return false
  if (STOP_WORDS.has(normalized)) return false
  return /[\p{L}\p{N}]/u.test(normalized)
}

const isChineseWord = (token: string) => /^[\u4e00-\u9fff]+$/u.test(token)

export const tokenizeSearchQuery = (query: string) => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return {
      normalizedQuery: "",
      tokens: [] as string[],
    }
  }

  const tokenSet = new Set<string>()

  // 基础切分：按符号和空白拆分，确保中英文混合关键词可用
  for (const part of normalizedQuery.split(/[^\p{L}\p{N}]+/u)) {
    if (isUsableToken(part)) {
      tokenSet.add(part)
    }
  }

  // 中文分词增强：提高自然语句匹配能力
  try {
    const segmented = segmentit.doSegment(normalizedQuery, {
      simple: true,
    }) as Array<string | { w?: string }>

    for (const item of segmented) {
      const token = typeof item === "string" ? item : item?.w
      if (token && isUsableToken(token)) {
        tokenSet.add(token)
      }
    }
  } catch {
    // 分词失败时保留基础切分结果，避免影响搜索可用性
  }

  // 中文长词补充边缘子词（前2字/后2字），避免“我的世界”仅命中“世界”。
  // 例如：我的世界 -> 我的 + 世界
  for (const token of Array.from(tokenSet)) {
    if (!isChineseWord(token) || token.length < 3) continue

    const prefix = token.slice(0, 2)
    const suffix = token.slice(-2)

    if (isUsableToken(prefix)) {
      tokenSet.add(prefix)
    }
    if (isUsableToken(suffix)) {
      tokenSet.add(suffix)
    }
  }

  // 如果分词结果里同时出现“整句”和“子词”，去掉整句，
  // 避免在 AND 匹配语义下把结果错误收窄（如 "我的世界"）。
  if (tokenSet.size > 1 && tokenSet.has(normalizedQuery)) {
    tokenSet.delete(normalizedQuery)
  }

  const tokens = Array.from(tokenSet).slice(0, MAX_TOKENS)
  return { normalizedQuery, tokens }
}
