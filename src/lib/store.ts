import { create } from 'zustand'
import { Task, Folder, TaskListState, User, TaskStep, TaskFile } from './types'
import { showError } from './toast';

// Helper function to convert date strings to Date objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertDates = (obj: any): any => {
  if (obj && typeof obj === 'object') {
    const converted = { ...obj }
    if (converted.createdAt && typeof converted.createdAt === 'string') {
      converted.createdAt = new Date(converted.createdAt)
    }
    if (converted.updatedAt && typeof converted.updatedAt === 'string') {
      converted.updatedAt = new Date(converted.updatedAt)
    }
    if (converted.startDate && typeof converted.startDate === 'string') {
      converted.startDate = new Date(converted.startDate)
    }
    if (converted.dueDate && typeof converted.dueDate === 'string') {
      converted.dueDate = new Date(converted.dueDate)
    }
    return converted
  }
  return obj
}

// localStorage helpers
const saveUserToStorage = (user: User, token?: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hodo_user', JSON.stringify(user))
    if (token) {
      localStorage.setItem('hodo_token', token)
      // Set JWT token cookie for middleware authentication
      document.cookie = `hodo_token=${token}; path=/; max-age=2592000` // 30 days
    }
    // Set session cookie
    document.cookie = `hodo_session=${user.id}; path=/; max-age=2592000` // 30 days
  }
}

const loadUserFromStorage = (): User | null => {
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem('hodo_user')
    if (userData) {
      try {
        return convertDates(JSON.parse(userData))
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error)
        localStorage.removeItem('hodo_user')
      }
    }
  }
  return null
}

const getTokenFromStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('hodo_token')
  }
  return null
}

const clearUserFromStorage = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hodo_user')
    localStorage.removeItem('hodo_token')
    // Clear session cookie
    document.cookie = 'hodo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    // Clear JWT token cookie
    document.cookie = 'hodo_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }
}



// Helper function to get auth headers for API calls
export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  const token = getTokenFromStorage()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// 全局 fetch 封装
async function hodoFetch(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 403) {
    try {
      const data = await response.clone().json();
      if (data?.error === 100001) {
        showError('账户未解锁');
      } else if (data?.error) {
        showError(data.error);
      } else {
        showError('没有权限进行此操作。');
      }
    } catch {
      showError('没有权限进行此操作。');
    }
  }
  return response;
}



interface TodoStore extends TaskListState {
  // User Actions
  createUser: (username: string, password: string) => Promise<boolean>
  updateUser: (userData: Partial<User> & { currentPassword?: string; newPassword?: string }) => Promise<boolean>
  loginUser: (username: string, password: string) => Promise<boolean>
  logoutUser: () => void
  
  // Folder Actions
  addFolder: (name: string, color?: string) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
  updateFolder: (id: string, name: string, color?: string) => Promise<boolean>
  loadFolders: () => Promise<void>
  reorderFolders: (oldIndex: number, newIndex: number) => void
  getSortedFolders: (userId: string) => Folder[]
  getArchivedFolders: (userId: string) => Promise<Folder[]>
  archiveFolder: (folderId: string, userId: string) => Promise<boolean>
  restoreFolder: (folderId: string) => Promise<boolean>
  
  // Task Actions
  addTask: (title: string, folderId: string) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  toggleTask: (id: string) => Promise<boolean>
  updateTask: (id: string, title: string) => Promise<boolean>
  updateTaskNotes: (id: string, notes: string) => Promise<boolean>
  updateTaskStartDate: (id: string, startDate: string | null) => Promise<boolean>
  updateTaskDueDate: (id: string, dueDate: string | null) => Promise<boolean>
  updateTaskTags: (id: string, tags: string[]) => Promise<boolean>
  toggleTodayTask: (id: string) => Promise<boolean>
  moveTask: (taskId: string, folderId: string) => Promise<boolean>
  loadTasks: (folderId?: string) => Promise<void>
  loadTodayTasks: () => Promise<void>
  setSelectedFolder: (id: string | null) => void
  getTasksByFolder: (folderId: string) => Task[]
  getAllTasks: () => Task[]
  getTodayTasks: () => Task[]
  getFoldersByUser: (userId: string) => Folder[]
  getTaskById: (id: string) => Promise<Task | null>
  
  // Pin Actions
  pinTask: (taskId: string, folderId: string) => void
  unpinTask: (taskId: string, folderId: string) => void
  isTaskPinned: (taskId: string, folderId: string) => boolean
  getPinnedTasks: (folderId: string) => string[]
  pinnedTasksUpdateTrigger: number

  // Task Step Actions
  addTaskStep: (taskId: string, title: string) => Promise<boolean>
  deleteTaskStep: (id: string) => Promise<boolean>
  toggleTaskStep: (id: string) => Promise<boolean>
  updateTaskStep: (id: string, title: string) => Promise<boolean>
  getTaskSteps: (taskId: string) => Promise<TaskStep[]>

  // Task File Actions
  uploadTaskFile: (taskId: string, file: File) => Promise<boolean>
  getTaskFiles: (taskId: string) => Promise<TaskFile[]>
  deleteTaskFile: (fileId: string) => Promise<boolean>

  // Store Initialization
  initializeStore: () => Promise<boolean>
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  folders: [],
  tasks: [],
  selectedFolderId: null,
  currentUser: null,
  pinnedTasksUpdateTrigger: 0,

  // Initialize store with localStorage data
  initializeStore: async () => {
    const savedUser = loadUserFromStorage()
    if (savedUser) {
      set({ currentUser: savedUser })
      await get().loadFolders()
      // 初始化时只加载全部任务，其他任务按需加载
      await get().loadTasks()
      return true
    }
    return false
  },

  logoutUser: () => {
    clearUserFromStorage()
    set({
      currentUser: null,
      folders: [],
      tasks: [],
      selectedFolderId: null
    })
  },

  createUser: async (username: string, password: string) => {
    try {
      const response = await hodoFetch('/api/users', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to create user:', error)
        
        // If it's a 404 error, redirect to 404 page
        if (response.status === 404) {
          window.location.href = '/404'
          return false
        }
        
        return false
      }

      const data = await response.json()
      if (data.success && data.user) {
        // Convert date strings to Date objects
        const userWithDates = convertDates(data.user)
        
        // Clear all existing data before setting new user
        set({
          currentUser: userWithDates,
          folders: [],
          tasks: [],
          selectedFolderId: null
        })
        
        // Save to localStorage with token
        saveUserToStorage(userWithDates, data.token)
        
        // Load user's folders and tasks after account creation
        await get().loadFolders()
        // 创建账户后加载全部任务
        await get().loadTasks()
        return true
      }
      return false
    } catch (error) {
      console.error('Error creating user:', error)
      return false
    }
  },

  updateUser: async (userData: Partial<User> & { currentPassword?: string; newPassword?: string }) => {
    const state = get()
    if (!state.currentUser) return false
    
    try {
      const response = await hodoFetch('/api/users', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: state.currentUser.id,
          ...userData
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update user:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.user) {
        // Convert date strings to Date objects
        const userWithDates = convertDates(data.user)
        set({ currentUser: userWithDates })
        
        // Save to localStorage
        saveUserToStorage(userWithDates)
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating user:', error)
      return false
    }
  },

  loginUser: async (username: string, password: string) => {
    try {
      const response = await hodoFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Login failed:', errorData)
        throw new Error(errorData.error || 'Login failed')
      }

      const data = await response.json()
      
      if (data.success && data.user) {
        // Convert date strings to Date objects
        const userWithDates = convertDates(data.user)
        
        // Set user data first, then save to storage
        set({
          currentUser: userWithDates,
          folders: [],
          tasks: [],
          selectedFolderId: null
        })
        
        // Save new user and token to localStorage and cookies
        saveUserToStorage(userWithDates, data.token)
        
        // Load user's folders and tasks after login
        await get().loadFolders()
        // 登录后加载全部任务
        await get().loadTasks()
        return true
      }
      return false
    } catch (error) {
      console.error('Error logging in:', error)
      throw error
    }
  },



  addFolder: async (name: string, color?: string) => {
    const state = get()
    if (!state.currentUser) return false
    
    try {
      const response = await hodoFetch('/api/folders', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          color,
          userId: state.currentUser.id
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to create folder:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.folder) {
        // Convert date strings to Date objects
        const folderWithDates = convertDates(data.folder)
        
        // Add the new folder to the sort order
        const storageKey = `hodo_folder_order_${state.currentUser!.id}`
        const existingOrder = localStorage.getItem(storageKey)
        const newOrder = existingOrder ? [...JSON.parse(existingOrder), folderWithDates.id] : [folderWithDates.id]
        localStorage.setItem(storageKey, JSON.stringify(newOrder))
        
        set((state) => ({
          folders: [...state.folders, folderWithDates]
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error creating folder:', error)
      return false
    }
  },

  deleteFolder: async (id: string) => {
    try {
      const response = await hodoFetch(`/api/folders?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to delete folder:', error)
        return false
      }

      // Remove the folder from the sort order
      const state = get()
      if (state.currentUser) {
        const storageKey = `hodo_folder_order_${state.currentUser.id}`
        const existingOrder = localStorage.getItem(storageKey)
        if (existingOrder) {
          const newOrder = JSON.parse(existingOrder).filter((folderId: string) => folderId !== id)
          localStorage.setItem(storageKey, JSON.stringify(newOrder))
        }
      }
      
      set((state) => ({
        folders: state.folders.filter(folder => folder.id !== id),
        tasks: state.tasks.filter(task => task.folderId !== id),
        selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId
      }))
      return true
    } catch (error) {
      console.error('Error deleting folder:', error)
      return false
    }
  },

  updateFolder: async (id: string, name: string, color?: string) => {
    try {
      const response = await hodoFetch('/api/folders', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name, color }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update folder:', error)
        return false
      }

      set((state) => ({
        folders: state.folders.map(folder =>
          folder.id === id
            ? { ...folder, name, color, updatedAt: new Date() }
            : folder
        )
      }))
      return true
    } catch (error) {
      console.error('Error updating folder:', error)
      return false
    }
  },

  loadFolders: async () => {
    const state = get()
    if (!state.currentUser) return

    try {
      const response = await hodoFetch(`/api/folders?userId=${state.currentUser.id}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Convert date strings to Date objects for all folders
          const foldersWithDates = data.folders.map(convertDates)
          set({ folders: foldersWithDates })
        }
      }
    } catch (error) {
      console.error('Error loading folders:', error)
    }
  },

  addTask: async (title: string, folderId: string) => {
    const state = get()
    if (!state.currentUser) return false
    
    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          folderId,
          userId: state.currentUser.id
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to create task:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: [...state.tasks, taskWithDates]
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error creating task:', error)
      return false
    }
  },

  deleteTask: async (id: string) => {
    try {
      const response = await hodoFetch(`/api/tasks?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to delete task:', error)
        return false
      }

      set((state) => ({
        tasks: state.tasks.filter(task => task.id !== id)
      }))
      return true
    } catch (error) {
      console.error('Error deleting task:', error)
      return false
    }
  },

  toggleTask: async (id: string) => {
    const state = get()
    const task = state.tasks.find(t => t.id === id)
    if (!task) return false

    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          completed: !task.completed
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to toggle task:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        
        // 重新获取任务列表以反映新的排序
        const currentState = get()
        if (currentState.selectedFolderId === 'today-tasks') {
          await get().loadTodayTasks()
        } else if (currentState.selectedFolderId && currentState.selectedFolderId !== 'all-tasks') {
          await get().loadTasks(currentState.selectedFolderId)
        } else {
          await get().loadTasks()
        }
        
        return true
      }
      return false
    } catch (error) {
      console.error('Error toggling task:', error)
      return false
    }
  },

  updateTask: async (id: string, title: string) => {
    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          title
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update task:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating task:', error)
      return false
    }
  },

  updateTaskNotes: async (id: string, notes: string) => {
    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          notes
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update task notes:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating task notes:', error)
      return false
    }
  },

  updateTaskDueDate: async (id: string, dueDate: string | null) => {
    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          dueDate
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update task due date:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating task due date:', error)
      return false
    }
  },

  updateTaskStartDate: async (id: string, startDate: string | null) => {
    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          startDate
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update task start date:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating task start date:', error)
      return false
    }
  },

  updateTaskTags: async (id: string, tags: string[]) => {
    try {
      // 更新本地状态中的任务标签
      set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === id ? { ...task, tags: tags.join(','), updatedAt: new Date() } : task
        )
      }))
      return true
    } catch (error) {
      console.error('Error updating task tags:', error)
      return false
    }
  },

  toggleTodayTask: async (id: string) => {
    const state = get()
    const task = state.tasks.find(t => t.id === id)
    if (!task) return false

    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          isToday: !task.isTodayTask
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to toggle today task:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error toggling today task:', error)
      return false
    }
  },

  moveTask: async (taskId: string, folderId: string) => {
    const state = get()
    const task = state.tasks.find(t => t.id === taskId)
    if (!task) {
      console.error('Task not found in store:', taskId)
      return false
    }

    try {
      const response = await hodoFetch('/api/tasks', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          folderId
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to move task:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.task) {
        // Convert date strings to Date objects and update local state
        const taskWithDates = convertDates(data.task)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === taskId ? taskWithDates : task
          )
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Error moving task:', error)
      return false
    }
  },

  loadTasks: async (folderId?: string) => {
    const state = get()
    if (!state.currentUser) return

    try {
      let url = '/api/tasks'
      if (folderId && folderId !== 'all-tasks') {
        url += `?folderId=${folderId}`
      }
      
      const response = await hodoFetch(url, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Convert date strings to Date objects for tasks
          const tasksWithDates = data.tasks.map(convertDates)
          
          if (folderId && folderId !== 'all-tasks') {
            // 如果是特定文件夹，更新该文件夹的任务
            set((state) => {
              // 移除该文件夹的旧任务
              const otherTasks = state.tasks.filter(task => task.folderId !== folderId)
              return {
                tasks: [...otherTasks, ...tasksWithDates]
              }
            })
          } else {
            // 如果是全部任务，直接替换
            set({ tasks: tasksWithDates })
          }
        }
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  },

  loadTodayTasks: async () => {
    const state = get()
    if (!state.currentUser) return

    try {
      const response = await hodoFetch('/api/tasks/today', {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Convert date strings to Date objects for today tasks
          const todayTasksWithDates = data.tasks.map(convertDates)
          
          // Update the store: replace existing tasks with updated ones and add new ones
          set((state) => {
            // Create a map of today tasks for quick lookup
            const todayTasksMap = new Map(todayTasksWithDates.map((task: Task) => [task.id, task]))
            
            // Update existing tasks and keep non-today tasks unchanged
            const updatedTasks = state.tasks.map((task: Task) => {
              // If this task is in today tasks, use the updated version
              if (todayTasksMap.has(task.id)) {
                return todayTasksMap.get(task.id)!
              }
              // If this task was previously a today task but not in the response, update its isTodayTask to false
              if (task.isTodayTask) {
                return { ...task, isTodayTask: false }
              }
              // Keep other tasks unchanged
              return task
            })
            
            // Add new today tasks that don't exist in current tasks
            const newTodayTasks = todayTasksWithDates.filter((todayTask: Task) => 
              !state.tasks.find((task: Task) => task.id === todayTask.id)
            )
            
            return {
              tasks: [...updatedTasks, ...newTodayTasks]
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading today tasks:', error)
    }
  },

  setSelectedFolder: (id: string | null) => {
    // Allow system folders (all-tasks, today-tasks) and user folders
    set({ selectedFolderId: id })
    
    // 移除重复的API调用，因为useEffect会处理
    // 只在选择特定文件夹时加载任务
    if (id && id !== 'all-tasks' && id !== 'today-tasks') {
      get().loadTasks(id)
    }
  },

  getTasksByFolder: (folderId: string) => {
    const state = get()
    if (!state.currentUser) return []
    return state.tasks.filter(task => 
      task.folderId === folderId && task.userId === state.currentUser!.id
    )
  },

  getAllTasks: () => {
    const state = get()
    if (!state.currentUser) return []
    return state.tasks.filter(task => task.userId === state.currentUser!.id)
  },

  getTodayTasks: () => {
    const state = get()
    if (!state.currentUser) return []
    return state.tasks.filter(task => task.isTodayTask && task.userId === state.currentUser!.id)
  },

  getFoldersByUser: (userId: string) => {
    return get().folders.filter(folder => folder.userId === userId)
  },

  getTaskById: async (id: string) => {
    try {
      const response = await hodoFetch(`/api/tasks?id=${id}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.tasks && data.tasks.length > 0) {
          // Convert date strings to Date objects
          const taskWithDates = convertDates(data.tasks[0])
          return taskWithDates
        }
      }
      return null
    } catch (error) {
      console.error('Error loading task by ID:', error)
      return null
    }
  },

  // Task Step Actions
  addTaskStep: async (taskId: string, title: string) => {
    try {
      const response = await hodoFetch('/api/task-steps', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          title
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to create task step:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.step) {
        // Note: We don't store steps in global state, they're fetched per task
        return true
      }
      return false
    } catch (error) {
      console.error('Error creating task step:', error)
      return false
    }
  },

  deleteTaskStep: async (id: string) => {
    try {
      const response = await hodoFetch(`/api/task-steps?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to delete task step:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting task step:', error)
      return false
    }
  },

  toggleTaskStep: async (id: string) => {
    try {
      // 首先获取当前步骤的状态
      const getResponse = await hodoFetch(`/api/task-steps?id=${id}`, {
        headers: getAuthHeaders()
      })
      
      if (!getResponse.ok) {
        console.error('Failed to get task step for toggle')
        return false
      }
      
      const getData = await getResponse.json()
      if (!getData.success || !getData.steps || getData.steps.length === 0) {
        console.error('Task step not found for toggle')
        return false
      }
      
      const currentStep = getData.steps[0]
      const newCompletedState = !currentStep.completed
      
      // 然后更新步骤状态
      const response = await hodoFetch('/api/task-steps', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          completed: newCompletedState
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to toggle task step:', error)
        return false
      }

      const data = await response.json()
      if (data.success && data.step) {
        return true
      }
      return false
    } catch (error) {
      console.error('Error toggling task step:', error)
      return false
    }
  },

  updateTaskStep: async (id: string, title: string) => {
    try {
      const response = await hodoFetch('/api/task-steps', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, title }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update task step:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating task step:', error)
      return false
    }
  },

  getTaskSteps: async (taskId: string) => {
    try {
      const response = await hodoFetch(`/api/task-steps?taskId=${taskId}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Convert date strings to Date objects for all steps
          return data.steps.map(convertDates)
        }
      }
      return []
    } catch (error) {
      console.error('Error loading task steps:', error)
      return []
    }
  },

  uploadTaskFile: async (taskId: string, file: File) => {
    const state = get()
    if (!state.currentUser) return false
    
    try {
      // 检查文件大小限制 (30MB)
      const maxSize = 30 * 1024 * 1024
      if (file.size > maxSize) {
        console.error('File too large:', file.size, 'bytes')
        return false
      }

      // 使用FileReader API进行更可靠的base64转换
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        
        reader.onload = () => {
          const result = reader.result as string
          if (result && result.startsWith('data:')) {
            // 提取base64部分
            const base64Data = result.split(',')[1]
            resolve(base64Data)
          } else {
            reject(new Error('FileReader failed to convert file to base64'))
          }
        }
        
        reader.onerror = () => {
          reject(new Error('FileReader error: ' + reader.error?.message))
        }
        
        // 读取文件为base64
        reader.readAsDataURL(file)
      })
      
      console.log('Uploading file:', {
        taskId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        base64Length: base64.length,
        originalSize: file.size
      })
      
      // 验证转换后的数据完整性
      if (base64.length === 0) {
        console.error('Base64 conversion failed: empty result')
        return false
      }
      
      const response = await hodoFetch(`/api/tasks/${taskId}/files`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64, // 直接发送base64数据，不包含data URL前缀
          fileType: file.type,
          fileSize: file.size,
        }),
      })
      
      console.log('Upload response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })

      if (!response.ok) {
        try {
          const errorData = await response.json()
          console.error('Failed to upload file:', errorData)
          if (errorData?.error) {
            showError(`文件上传失败: ${errorData.error}`)
          } else {
            showError('文件上传失败，请稍后重试')
          }
        } catch (parseError) {
          console.error('Failed to parse upload error response:', parseError)
          showError('文件上传失败，请稍后重试')
        }
        return false
      }

      return true
    } catch (error) {
      console.error('Error uploading file:', error)
      showError(`文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  },

  getTaskFiles: async (taskId: string) => {
    try {
      const response = await hodoFetch(`/api/tasks/${taskId}/files`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const files = await response.json()
        // Convert date strings to Date objects for all files
        return files.map(convertDates)
      }
      return []
    } catch (error) {
      console.error('Error loading task files:', error)
      return []
    }
  },

  deleteTaskFile: async (fileId: string) => {
    try {
      const response = await hodoFetch(`/api/tasks/files/${fileId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        try {
          const errorData = await response.json()
          console.error('Failed to delete file:', errorData)
          if (errorData?.error) {
            showError(`文件删除失败: ${errorData.error}`)
          } else {
            showError('文件删除失败，请稍后重试')
          }
        } catch (parseError) {
          console.error('Failed to parse delete error response:', parseError)
          showError('文件删除失败，请稍后重试')
        }
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  },

  // Pin Actions
  pinTask: (taskId: string, folderId: string) => {
    const state = get()
    if (!state.currentUser) return

    const storageKey = `hodo_pinned_${state.currentUser.id}_${folderId}`
    const pinnedTasks = JSON.parse(localStorage.getItem(storageKey) || '[]')
    
    // 如果任务已经置顶，不重复添加
    if (!pinnedTasks.some((item: { taskId: string; pinnedAt: number }) => item.taskId === taskId)) {
      const newPinnedTasks = [...pinnedTasks, { taskId, pinnedAt: Date.now() }]
      localStorage.setItem(storageKey, JSON.stringify(newPinnedTasks))
      // 触发重新渲染
      set({ pinnedTasksUpdateTrigger: state.pinnedTasksUpdateTrigger + 1 })
    }
  },

  unpinTask: (taskId: string, folderId: string) => {
    const state = get()
    if (!state.currentUser) return

    const storageKey = `hodo_pinned_${state.currentUser.id}_${folderId}`
    const pinnedTasks = JSON.parse(localStorage.getItem(storageKey) || '[]')
    
    const newPinnedTasks = pinnedTasks.filter((item: { taskId: string; pinnedAt: number }) => item.taskId !== taskId)
    localStorage.setItem(storageKey, JSON.stringify(newPinnedTasks))
    // 触发重新渲染
    set({ pinnedTasksUpdateTrigger: state.pinnedTasksUpdateTrigger + 1 })
  },

  isTaskPinned: (taskId: string, folderId: string) => {
    const state = get()
    if (!state.currentUser) return false

    const storageKey = `hodo_pinned_${state.currentUser.id}_${folderId}`
    const pinnedTasks = JSON.parse(localStorage.getItem(storageKey) || '[]')
    
    return pinnedTasks.some((item: { taskId: string; pinnedAt: number }) => item.taskId === taskId)
  },

  getPinnedTasks: (folderId: string) => {
    const state = get()
    if (!state.currentUser) return []

    const storageKey = `hodo_pinned_${state.currentUser.id}_${folderId}`
    const pinnedTasks = JSON.parse(localStorage.getItem(storageKey) || '[]')
    
    // 按置顶时间排序，最新的在前面
    return pinnedTasks
      .sort((a: { taskId: string; pinnedAt: number }, b: { taskId: string; pinnedAt: number }) => b.pinnedAt - a.pinnedAt)
      .map((item: { taskId: string; pinnedAt: number }) => item.taskId)
  },

  // Folder sorting methods
  reorderFolders: (oldIndex: number, newIndex: number) => {
    const state = get()
    if (!state.currentUser) return

    const userFolders = state.folders.filter(folder => folder.userId === state.currentUser!.id)
    const reorderedFolders = [...userFolders]
    const [movedFolder] = reorderedFolders.splice(oldIndex, 1)
    reorderedFolders.splice(newIndex, 0, movedFolder)

    // Save the new order to localStorage
    const storageKey = `hodo_folder_order_${state.currentUser.id}`
    const folderOrder = reorderedFolders.map(folder => folder.id)
    localStorage.setItem(storageKey, JSON.stringify(folderOrder))

    // Update the folders state with the new order
    const allFolders = state.folders.filter(folder => folder.userId !== state.currentUser!.id)
    set({ folders: [...allFolders, ...reorderedFolders] })
  },

  getSortedFolders: (userId: string) => {
    const state = get()
    const userFolders = state.folders.filter(folder => folder.userId === userId && !folder.archived)
    
    // Get saved order from localStorage
    const storageKey = `hodo_folder_order_${userId}`
    const savedOrder = localStorage.getItem(storageKey)
    
    if (savedOrder) {
      try {
        const folderOrder = JSON.parse(savedOrder)
        // Sort folders according to saved order
        const sortedFolders = [...userFolders].sort((a, b) => {
          const aIndex = folderOrder.indexOf(a.id)
          const bIndex = folderOrder.indexOf(b.id)
          
          // If both folders are in the saved order, sort by their position
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex
          }
          
          // If only one folder is in the saved order, put it first
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          
          // If neither folder is in the saved order, sort by creation date
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })
        return sortedFolders
      } catch (error) {
        console.error('Error parsing folder order from localStorage:', error)
      }
    }
    
    // Fallback to sorting by creation date
    return userFolders.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  },

  // 获取归档的文件夹
  getArchivedFolders: async (userId: string) => {
    try {
      const response = await hodoFetch(`/api/folders?archived=true&userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch archived folders')
      }
      const data = await response.json()
      if (data.success) {
        return data.folders.map((folder: Folder) => convertDates(folder))
      }
      return []
    } catch (error) {
      console.error('Error fetching archived folders:', error)
      return []
    }
  },

  // 归档文件夹
  archiveFolder: async (folderId: string, userId: string) => {
    try {
      const response = await hodoFetch(`/api/folders/${folderId}/archive`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to archive folder:', error)
        return false
      }

      // 从当前文件夹列表中移除
      const state = get()
      set({
        folders: state.folders.map(folder => 
          folder.id === folderId ? { ...folder, archived: true } : folder
        )
      })

      // 从排序顺序中移除
      const storageKey = `hodo_folder_order_${userId}`
      const existingOrder = localStorage.getItem(storageKey)
      if (existingOrder) {
        const folderOrder = JSON.parse(existingOrder)
        const newOrder = folderOrder.filter((id: string) => id !== folderId)
        localStorage.setItem(storageKey, JSON.stringify(newOrder))
      }

      return true
    } catch (error) {
      console.error('Error archiving folder:', error)
      return false
    }
  },

  // 恢复文件夹
  restoreFolder: async (folderId: string) => {
    try {
      const response = await hodoFetch(`/api/folders/${folderId}/archive`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: false }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to restore folder:', error)
        return false
      }

      // 更新当前文件夹状态
      const state = get()
      set({
        folders: state.folders.map(folder => 
          folder.id === folderId ? { ...folder, archived: false } : folder
        )
      })

      // 重新加载文件夹和任务
      await get().loadFolders()
      await get().loadTasks()

      return true
    } catch (error) {
      console.error('Error restoring folder:', error)
      return false
    }
  },


})) 

// 标签功能开关状态
interface TagFeatureState {
  isEnabled: boolean
  toggle: () => void
  setEnabled: (enabled: boolean) => void
}

// 创建标签功能开关的 store
export const useTagFeatureStore = create<TagFeatureState>((set) => ({
  isEnabled: true, // 默认启用
  toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
  setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),
})) 