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
  startDate?: Date
  dueDate?: Date
  tags?: string
  files?: TaskFile[]
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

export interface TaskStep {
  id: string
  taskId: string
  title: string
  completed: boolean
  order: number
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