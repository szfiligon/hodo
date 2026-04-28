import { NextRequest, NextResponse } from 'next/server'
import { db, taskSteps, tasks } from '@/lib/db'
import { authenticateUser, extractUserFromRequest } from '@/lib/auth'
import { createLogger, generateTraceId } from '@/lib/logger'
import { sql } from 'drizzle-orm'
import { TaskStep, TaskStepStatus } from '@/lib/types'

type TaskStepRecord = {
  id: string
  taskId: string
  title: string
  estimatedMinutes: number
  order: number
  status: TaskStepStatus
  startedAt?: Date | null
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

function normalizeTaskStepRecord(record: Record<string, unknown>): TaskStepRecord {
  const estimatedRaw =
    typeof record.estimatedMinutes === 'number'
      ? record.estimatedMinutes
      : Number(record.estimatedMinutes ?? 0)
  const orderRaw =
    typeof record.order === 'number'
      ? record.order
      : Number(record.order ?? 0)
  const statusRaw = String(record.status ?? 'pending')
  const status: TaskStepStatus =
    statusRaw === 'in_progress' || statusRaw === 'completed' ? statusRaw : 'pending'

  return {
    id: String(record.id),
    taskId: String(record.taskId),
    title: String(record.title),
    estimatedMinutes: Number.isFinite(estimatedRaw) ? Math.max(0, Math.round(estimatedRaw)) : 0,
    order: Number.isFinite(orderRaw) ? Math.max(0, Math.round(orderRaw)) : 0,
    status,
    startedAt: typeof record.startedAt === 'string' ? new Date(record.startedAt) : null,
    completedAt: typeof record.completedAt === 'string' ? new Date(record.completedAt) : null,
    createdAt: new Date(String(record.createdAt)),
    updatedAt: new Date(String(record.updatedAt)),
  }
}

async function assertTaskOwnedByUser(taskId: string, userId: string) {
  const rows = await db
    .select()
    .from(tasks)
    .where(sql`${tasks.id} = ${taskId} AND ${tasks.userId} = ${userId}`)
    .limit(1)
  return rows.length > 0
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId()
  const userInfo = extractUserFromRequest(request)
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined)

  try {
    const authResult = await authenticateUser(request, { skipUnlockCheck: true })
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const taskIdsParam = searchParams.get('taskIds')
    const taskIds = taskIdsParam
      ? taskIdsParam.split(',').map((item) => item.trim()).filter(Boolean)
      : []
    let stepRows: Record<string, unknown>[]
    if (taskId) {
      stepRows = await db
        .select()
        .from(taskSteps)
        .where(sql`${taskSteps.taskId} = ${taskId} AND ${taskSteps.taskId} IN (SELECT id FROM tasks WHERE user_id = ${authResult.user.userId})`)
    } else if (taskIds.length > 0) {
      const allOwnedStepRows = await db
        .select()
        .from(taskSteps)
        .where(sql`${taskSteps.taskId} IN (SELECT id FROM tasks WHERE user_id = ${authResult.user.userId})`)
      const taskIdSet = new Set(taskIds)
      stepRows = allOwnedStepRows.filter((row) => taskIdSet.has(String((row as Record<string, unknown>).taskId)))
    } else {
      return NextResponse.json({ error: 'Missing query: taskId or taskIds' }, { status: 400 })
    }

    const normalizedSteps = stepRows
      .map((row) => normalizeTaskStepRecord(row))
      .sort((a, b) => (a.taskId === b.taskId ? a.order - b.order : a.taskId.localeCompare(b.taskId)))

    logger.info(`Task steps retrieved successfully {"count":${normalizedSteps.length}}`)

    return NextResponse.json({
      steps: normalizedSteps,
      success: true,
      count: normalizedSteps.length,
    })
  } catch (error) {
    logger.error('Error in task step retrieval API: ' + (error instanceof Error ? error.message : String(error)), error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()
  const userInfo = extractUserFromRequest(request)
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined)

  try {
    const authResult = await authenticateUser(request, { skipUnlockCheck: true })
    if (authResult instanceof NextResponse) return authResult

    const body: unknown = await request.json()
    const taskId = typeof (body as { taskId?: unknown })?.taskId === 'string' ? (body as { taskId: string }).taskId : ''
    const title = typeof (body as { title?: unknown })?.title === 'string' ? (body as { title: string }).title.trim() : ''
    const estimatedMinutesRaw = (body as { estimatedMinutes?: unknown })?.estimatedMinutes
    const estimatedMinutes =
      typeof estimatedMinutesRaw === 'number' && Number.isFinite(estimatedMinutesRaw)
        ? Math.max(0, Math.round(estimatedMinutesRaw))
        : 0

    if (!taskId || !title) {
      return NextResponse.json({ error: 'Missing required fields: taskId, title' }, { status: 400 })
    }

    const isOwned = await assertTaskOwnedByUser(taskId, authResult.user.userId)
    if (!isOwned) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const maxOrderRow = await db
      .select({ maxOrder: sql`COALESCE(MAX(${taskSteps.order}), -1)` })
      .from(taskSteps)
      .where(sql`${taskSteps.taskId} = ${taskId}`)
      .limit(1)
    const nextOrder = Number(maxOrderRow[0]?.maxOrder ?? -1) + 1

    const now = new Date().toISOString()
    const step: TaskStep = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      title,
      estimatedMinutes,
      order: nextOrder,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }

    await db.insert(taskSteps).values({
      id: step.id,
      taskId: step.taskId,
      title: step.title,
      estimatedMinutes: step.estimatedMinutes,
      order: step.order,
      status: step.status,
      startedAt: null,
      completedAt: null,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    })

    logger.info(`Task step created successfully {"stepId":"${step.id}","taskId":"${taskId}"}`)
    return NextResponse.json({ step, success: true }, { status: 201 })
  } catch (error) {
    logger.error('Error in task step creation API: ' + (error instanceof Error ? error.message : String(error)), error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const traceId = generateTraceId()
  const userInfo = extractUserFromRequest(request)
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined)

  try {
    const authResult = await authenticateUser(request, { skipUnlockCheck: true })
    if (authResult instanceof NextResponse) return authResult

    const body: unknown = await request.json()
    const id = typeof (body as { id?: unknown })?.id === 'string' ? (body as { id: string }).id : ''
    const title = typeof (body as { title?: unknown })?.title === 'string' ? (body as { title: string }).title.trim() : undefined
    const estimatedMinutes =
      typeof (body as { estimatedMinutes?: unknown })?.estimatedMinutes === 'number'
        ? Math.max(0, Math.round((body as { estimatedMinutes: number }).estimatedMinutes))
        : undefined
    const statusRaw = typeof (body as { status?: unknown })?.status === 'string' ? (body as { status: string }).status : undefined

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    const existingRows = await db
      .select()
      .from(taskSteps)
      .where(sql`${taskSteps.id} = ${id} AND ${taskSteps.taskId} IN (SELECT id FROM tasks WHERE user_id = ${authResult.user.userId})`)
      .limit(1)
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Task step not found' }, { status: 404 })
    }

    const updateData: Record<string, string | number | null> = {
      updatedAt: new Date().toISOString(),
    }

    if (title !== undefined) {
      updateData.title = title
    }
    if (estimatedMinutes !== undefined) {
      updateData.estimatedMinutes = estimatedMinutes
    }

    if (statusRaw !== undefined) {
      const now = new Date().toISOString()
      const status: TaskStepStatus = statusRaw === 'completed' ? 'completed' : statusRaw === 'in_progress' ? 'in_progress' : 'pending'
      const previousStatusRaw = String((existingRows[0] as Record<string, unknown>).status ?? 'pending')
      const previousStatus: TaskStepStatus =
        previousStatusRaw === 'completed' || previousStatusRaw === 'in_progress' ? previousStatusRaw : 'pending'
      const previousCompletedAt = (existingRows[0] as Record<string, unknown>).completedAt
      updateData.status = status
      if (status === 'pending') {
        updateData.completedAt = null
      } else if (status === 'in_progress') {
        // 简化模式下不需要记录 in_progress 时间点
      } else {
        // 仅在首次从非 completed 转换为 completed 时写入完成时间
        if (previousStatus !== 'completed' || !previousCompletedAt) {
          updateData.completedAt = now
        }
      }
    }

    await db.update(taskSteps).set(updateData).where(sql`${taskSteps.id} = ${id}`)
    const updatedRows = await db.select().from(taskSteps).where(sql`${taskSteps.id} = ${id}`).limit(1)
    const step = updatedRows[0] ? normalizeTaskStepRecord(updatedRows[0] as Record<string, unknown>) : null

    logger.info(`Task step updated successfully {"stepId":"${id}"}`)
    return NextResponse.json({ step, success: true })
  } catch (error) {
    logger.error('Error in task step update API: ' + (error instanceof Error ? error.message : String(error)), error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const traceId = generateTraceId()
  const userInfo = extractUserFromRequest(request)
  const logger = createLogger('task-steps.route', traceId, userInfo || undefined)

  try {
    const authResult = await authenticateUser(request)
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    const ownedStepRows = await db
      .select()
      .from(taskSteps)
      .where(sql`${taskSteps.id} = ${id} AND ${taskSteps.taskId} IN (SELECT id FROM tasks WHERE user_id = ${authResult.user.userId})`)
      .limit(1)
    if (ownedStepRows.length === 0) {
      return NextResponse.json({ error: 'Task step not found' }, { status: 404 })
    }

    await db.delete(taskSteps).where(sql`${taskSteps.id} = ${id}`)
    logger.info(`Task step deleted successfully {"stepId":"${id}"}`)

    return NextResponse.json({ success: true, message: 'Task step deleted successfully' })
  } catch (error) {
    logger.error('Error in task step deletion API: ' + (error instanceof Error ? error.message : String(error)), error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
