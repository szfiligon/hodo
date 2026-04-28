export interface User {
  id: string
  username: string
  password: string
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  id: string
  title: string
  completed: boolean
  folderId: string
  userId: string
  notes?: string
  isTodayTask: boolean
  tags?: string
  files?: TaskFile[]
  createdAt: Date
  updatedAt: Date
}

export type TaskStepStatus = "pending" | "in_progress" | "completed"

export interface TaskStep {
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

export interface TaskFile {
  id: string
  taskId: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  filePath: string
  createdAt: Date
  updatedAt: Date
}

export interface Folder {
  id: string
  name: string
  color?: string
  userId: string
  isSystem?: boolean
  archived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TaskListState {
  folders: Folder[]
  tasks: Task[]
  selectedFolderId: string | null
  currentUser: User | null
}

export interface UnlockRecord {
  username: string;
  date: string; // yyyyMMdd
  unlockCode: string;
} 

export type SearchMode = "all" | "media"

export type SearchResultType = "task" | "image" | "file"

export interface SearchResult {
  id: string
  title: string
  type: SearchResultType
  createdAt: string
  completed?: boolean
  folderId?: string
  taskId?: string
  taskTitle?: string
  notes?: string
  tags?: string
  mimeType?: string
  fileSize?: number
  fileId?: string
}