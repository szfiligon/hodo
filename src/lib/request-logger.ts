import { NextRequest } from 'next/server'
import { createLogger, generateTraceId } from './logger'
import { extractUserFromRequest } from './auth'

export function createRequestLogger(component: string, request: NextRequest) {
  const traceId = generateTraceId()
  const userInfo = extractUserFromRequest(request)
  const logger = createLogger(component, traceId, userInfo || undefined)
  return { logger, traceId, userInfo }
}

