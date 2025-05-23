'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Paper, Typography, Box, TextField, List, ListItem, ListItemText, ListItemButton, ListItemIcon, IconButton, InputAdornment, Checkbox, Divider, Accordion, AccordionSummary, AccordionDetails, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LoginDialog from './components/LoginDialog';
import UserInfo from './components/UserInfo';

interface TaskMenu {
  id: string;
  name: string;
}

interface TaskStep {
  id: string;
  task_id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

interface Task {
  id: string;
  task_menu_id: string;
  text: string;
  created_at: string;
  completed: boolean;
  remarks?: string;
  color_tag?: string;
  remind_me?: string;
  steps?: TaskStep[];
  importance?: boolean;
  isTodayTask?: boolean;
  due_date?: string;
}

export default function TodoList() {
  const [taskMenus, setTaskMenus] = useState<TaskMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'menu' | 'task'; id: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailInput, setTaskDetailInput] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [remindMe, setRemindMe] = useState<string | null>(null);
  const [newStepText, setNewStepText] = useState('');
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const userInfoRef = useRef<{ refresh: () => Promise<void> }>(null);

  const fixedTaskMenus = useMemo(() => [
    { id: '-1', name: '所有任务' },
    { id: '-2', name: '今日任务' }
  ], []);

  const colorOptions = [
    { value: '#B22222', label: '深红色' },
    { value: '#FF4500', label: '橙红色' },
    { value: '#FFD700', label: '金色' },
    { value: '#228B22', label: '森林绿' },
    { value: '#4169E1', label: '皇家蓝' },
    { value: '#8A2BE2', label: '紫罗兰' },
  ];

  const fetchTaskMenus = useCallback(async () => {
    const response = await fetch('/api/task-menus');
    const data = await response.json();
    setTaskMenus([...fixedTaskMenus, ...data]);
  }, [fixedTaskMenus]);

  useEffect(() => {
    fetchTaskMenus();
    setTaskMenus(fixedTaskMenus);
  }, [fetchTaskMenus]);

  useEffect(() => {
    if (selectedMenu !== null) {
      fetchTasks(selectedMenu);
    }
  }, [selectedMenu]);

  useEffect(() => {
    if (selectedTask) {
      const fetchDetails = async () => {
        try {
          const response = await fetch(`/api/tasks?taskId=${selectedTask.id}`);
          if (!response.ok) throw new Error('Failed to fetch task details');
          const data = await response.json();
          setTaskDetailInput(data.remarks || '');
          setSelectedColor(data.color_tag || null);
          setRemindMe(data.remind_me || null);
          setDueDate(data.due_date || null);

          // Fetch task steps from the dedicated endpoint
          const stepsResponse = await fetch(`/api/task-steps?taskId=${selectedTask.id}`);
          if (!stepsResponse.ok) throw new Error('Failed to fetch task steps');
          const stepsData = await stepsResponse.json();
          setTaskSteps(stepsData || []);

          // Check if the task is part of 'Today's Tasks'
          const todayTaskResponse = await fetch(`/api/tasks?today=true`);
          if (!todayTaskResponse.ok) throw new Error('Failed to fetch today tasks');
          const todayTasks = await todayTaskResponse.json();
          const isToday = todayTasks.some((task: Task) => task.id === selectedTask.id);
          // Only update selectedTask if there is a change
          if (selectedTask.isTodayTask !== isToday) {
            setSelectedTask(prev => prev ? { ...prev, isTodayTask: isToday } : null);
          }
        } catch (error) {
          console.error('Error fetching task details:', error);
        }
      };
      fetchDetails();
    }
  }, [selectedTask]);

  const fetchTasks = async (menuId: string) => {
    let data;
    if (menuId === '-1') {
      const response = await fetch('/api/tasks');
      data = await response.json();
    } else if (menuId === '-2') {
      const response = await fetch('/api/tasks?today=true');
      data = await response.json();
    } else {
      const response = await fetch(`/api/tasks?taskMenuId=${menuId}`);
      data = await response.json();
    }
    setTasks(data);
  };

  const createTaskMenu = async () => {
    if (!newMenuName.trim()) return;
    
    const response = await fetch('/api/task-menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMenuName }),
    });
    
    const data = await response.json();
    setTaskMenus([...taskMenus, data]);
    setNewMenuName('');
  };

  const createTask = async () => {
    if (!newTaskText.trim() || selectedMenu === null) return;
    
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskMenuId: selectedMenu, text: newTaskText }),
    });
    
    const data = await response.json();
    setTasks([...tasks, data]);
    setNewTaskText('');
  };

  const createTaskStep = async () => {
    if (!newStepText.trim() || !selectedTask) return;
    
    const response = await fetch('/api/task-steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: selectedTask.id, text: newStepText }),
    });
    
    const data = await response.json();
    setTaskSteps([...taskSteps, data]);
    setNewStepText('');
  };

  const deleteTaskMenu = async (id: string) => {
    await fetch('/api/task-menus', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    
    setTaskMenus(taskMenus.filter(menu => menu.id !== id));
    if (selectedMenu === id) {
      setSelectedMenu(null);
      setTasks([]);
    }
  };

  const deleteTask = async (id: string) => {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    
    setTasks(tasks.filter(task => task.id !== id));
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: !completed }),
    });
    
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !completed } : task
    ));
  };

  const toggleTaskStep = async (stepId: string, completed: boolean) => {
    await fetch('/api/task-steps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stepId, completed: !completed }),
    });
    
    setTaskSteps(taskSteps.map(step => 
      step.id === stepId ? { ...step, completed: !completed } : step
    ));
  };

  const deleteTaskStep = async (stepId: string) => {
    await fetch('/api/task-steps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stepId }),
    });
    
    setTaskSteps(taskSteps.filter(step => step.id !== stepId));
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'menu' | 'task', id: string) => {
    e.preventDefault();
    if (type === 'menu' && id === '-1') return;
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
      setContextMenu(null);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredTasks = tasks
    .filter(task => task.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.completed === b.completed) {
        return 0; // Maintain original order for tasks with the same completion status
      }
      return a.completed ? 1 : -1; // Move completed tasks to the end
    });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const saveTaskDetail = async (taskId: string, detail: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, remarks: detail }),
    });
  };

  const saveColorTag = async (taskId: string, color: string | undefined) => {
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, color_tag: color }),
      });

      // Update the task in the global state
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, color_tag: color } : task
      ));

      // Update the selected task if it matches
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, color_tag: color });
      }
    } catch (error) {
      console.error('Failed to update color tag:', error);
    }
  };

  const saveRemindMe = async (taskId: string, remindMe: string | null) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, remind_me: remindMe }),
    });
  };

  const saveDueDate = async (taskId: string, dueDate: string | null) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, due_date: dueDate }),
    });
  };

  const handleTitleClick = () => {
    if (selectedTask) {
      setIsEditingTitle(true);
      setEditedTitle(selectedTask.text);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleBlur = async () => {
    if (editedTitle.trim() && selectedTask) {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTask.id, text: editedTitle }),
      });
      
      setSelectedTask({ ...selectedTask, text: editedTitle });
      
      setTasks(tasks.map(task => 
        task.id === selectedTask.id ? { ...task, text: editedTitle } : task
      ));
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    }
  };

  const toggleImportance = (taskId: string, currentImportance: boolean = false) => {
    console.log(`Toggling importance for task ID: ${taskId}, current importance: ${currentImportance}`);
    // Optimistically update the local state
    setTasks(tasks.map(task => {
      const updatedTask = task.id === taskId ? { ...task, importance: !currentImportance } : task;
      if (task.id === taskId) {
        console.log('Updated task:', updatedTask);
      }
      return updatedTask;
    }));

    // Perform the API call in the background
    fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, importance: !currentImportance }),
    }).then(() => {
      // Re-fetch task details to update the details view
      if (selectedTask && selectedTask.id === taskId) {
        fetch(`/api/tasks?taskId=${taskId}`)
          .then(response => response.json())
          .then(data => setSelectedTask(data))
          .catch(error => console.error('Failed to re-fetch task details:', error));
      }
    }).catch(error => {
      console.error('Failed to update task importance:', error);
      // Optionally revert the state if the API call fails
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, importance: currentImportance } : task
      ));
    });
  };

  const toggleTodayTask = async (taskId: string, isTodayTask: boolean) => {
    // Optimistically update the local state
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, isTodayTask: !isTodayTask } : task
    ));

    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, isTodayTask: !isTodayTask }),
      });
    } catch (error) {
      // Revert the state if the API call fails
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, isTodayTask } : task
      ));
      console.error('Failed to update task:', error);
    }

    // Re-fetch task details to update the UI
    const response = await fetch(`/api/tasks?taskId=${taskId}`);
    const updatedTask = await response.json();
    setSelectedTask(updatedTask);

    // Refresh task list if 'Today's Tasks' menu is selected
    if (selectedMenu === '-2') {
      fetchTasks('-2');
    }
  };

  useEffect(() => {
    const fetchHelloWorld = async () => {
      try {
        const response = await fetch('/api/hello');
        const data = await response.json();
        console.log(data.message); // Log the message to the console
      } catch (error) {
        console.error('Error fetching hello world message:', error);
      }
    };

    fetchHelloWorld();
  }, []);

  const handleColorTagClick = (color: string | null) => {
    const newColor: string | null = selectedColor === color ? 'white' : color;
    setSelectedColor(newColor);
    if (selectedTask) {
      saveColorTag(selectedTask.id, newColor || undefined);
    }
  };

  const handleLoginClick = () => {
    setIsLoginDialogOpen(true);
  };

  const handleLoginClose = () => {
    setIsLoginDialogOpen(false);
  };

  const handleLoginSubmit = async (username: string, password: string) => {
    // Implement login logic here
    // For now, just set the current user
    setCurrentUser(username);
  };

  const handleUserUpdate = () => {
    userInfoRef.current?.refresh();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800">
        <div className="flex h-screen">
          {/* Left Pane - Task Menus */}
          <Paper 
            elevation={3}
            sx={{ 
              width: '25%',
              height: '100%',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              borderRadius: 0
            }}
          >
            <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
              任务菜单
            </Typography>
            
            <TextField
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createTaskMenu()}
              placeholder="创建新菜单..."
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'grey.50',
                  '& fieldset': {
                    border: 'none'
                  },
                  '&:hover fieldset': {
                    border: 'none'
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none'
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '14px'
                }
              }}
            />

            <List sx={{ 
              flex: 1, 
              overflow: 'auto',
              '& .MuiListItem-root': {
                px: 1,
                py: 0.5,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }
            }}>
              {/* Fixed Task Menus */}
              {fixedTaskMenus.map(menu => (
                <ListItem
                  key={menu.id}
                  onClick={() => setSelectedMenu(menu.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'menu', menu.id)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: selectedMenu === menu.id ? 'grey.200' : 'transparent',
                    '&:hover': {
                      backgroundColor: selectedMenu === menu.id ? 'grey.300' : 'action.hover'
                    },
                    '&:focus': {
                      outline: 'none'
                    },
                    userSelect: 'none'
                  }}
                >
                  <ListItemText 
                    primary={
                      <Typography
                        sx={{
                          fontSize: '14px',
                          fontWeight: selectedMenu === menu.id ? 500 : 400
                        }}
                      >
                        {menu.name}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              <Divider sx={{ my: 1 }} />
              {/* User-defined Task Menus */}
              {taskMenus.filter(menu => menu.id >= '0').map(menu => (
                <ListItem
                  key={menu.id}
                  onClick={() => setSelectedMenu(menu.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'menu', menu.id)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: selectedMenu === menu.id ? 'grey.200' : 'transparent',
                    '&:hover': {
                      backgroundColor: selectedMenu === menu.id ? 'grey.300' : 'action.hover'
                    },
                    '&:focus': {
                      outline: 'none'
                    },
                    userSelect: 'none'
                  }}
                >
                  <ListItemText 
                    primary={
                      <Typography
                        sx={{
                          fontSize: '14px',
                          fontWeight: selectedMenu === menu.id ? 500 : 400
                        }}
                      >
                        {menu.name}
                      </Typography>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTaskMenu(menu.id);
                    }}
                    sx={{
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      '&:hover': {
                        color: 'error.main'
                      },
                      '.MuiListItem-root:hover &': {
                        opacity: 1
                      }
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </IconButton>
                </ListItem>
              ))}
            </List>
            <UserInfo ref={userInfoRef} onLoginClick={handleLoginClick} />
          </Paper>

          {/* Right Pane - Tasks */}
          <div className="w-3/4 p-8">
            {selectedMenu ? (
              <>
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索任务..."
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'white',
                          '& fieldset': {
                            border: 'none'
                          },
                          '&:hover fieldset': {
                            border: 'none'
                          },
                          '&.Mui-focused fieldset': {
                            border: 'none'
                          }
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '14px'
                        }
                      }}
                    />
                  </Box>
                  <Box>
                    <TextField
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && createTask()}
                      placeholder="添加新任务..."
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'white',
                          '& fieldset': {
                            border: 'none'
                          },
                          '&:hover fieldset': {
                            border: 'none'
                          },
                          '&.Mui-focused fieldset': {
                            border: 'none'
                          }
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '14px'
                        }
                      }}
                    />
                  </Box>
                </Box>
                <List sx={{ 
                  maxHeight: 'calc(100vh - 16rem)',
                  overflow: 'auto',
                  '& .MuiListItem-root': {
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }
                }}>
                  {filteredTasks.map(task => (
                    <ListItem
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      onContextMenu={(e) => handleContextMenu(e, 'task', task.id)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: selectedTask?.id === task.id ? 'grey.200' : 'white',
                        '&:hover': {
                          backgroundColor: selectedTask?.id === task.id ? 'grey.300' : 'action.hover'
                        },
                        '&:focus': {
                          outline: 'none'
                        },
                        userSelect: 'none'
                      }}
                    >
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        flex: 1,
                        minWidth: 0
                      }}>
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={task.completed}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTask(task.id, task.completed);
                            }}
                            size="small"
                            sx={{
                              p: 0.5,
                              '& .MuiSvgIcon-root': {
                                fontSize: 20
                              }
                            }}
                          />
                          <Typography
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              color: task.completed ? 'text.secondary' : 'text.primary',
                              fontSize: '14px',
                              fontWeight: selectedTask?.id === task.id ? 500 : 400
                            }}
                          >
                            {task.text}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleImportance(task.id, task.importance ?? false);
                              }}
                              size="small"
                              sx={{
                                color: task.importance ? 'red' : 'grey',
                                '& .MuiSvgIcon-root': {
                                  fontSize: 18,
                                },
                              }}
                            >
                              {task.importance ? <StarIcon /> : <StarBorderIcon />}
                            </IconButton>
                            <Box sx={{ width: '4px' }} />
                            {task.color_tag && task.color_tag !== 'white' && (
                              <Box 
                                sx={{ 
                                  width: 16,
                                  height: 16,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  backgroundColor: task.color_tag
                                }}
                              />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                            <Typography
                              sx={{
                                fontSize: '14px',
                                color: 'text.secondary',
                              }}
                            >
                              {task.due_date ? new Date(task.due_date).toLocaleString('default', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(task.id);
                        }}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          '&:hover': {
                            color: 'error.main'
                          },
                          '.MuiListItem-root:hover &': {
                            opacity: 1
                          }
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </IconButton>
                    </ListItem>
                  ))}
                </List>

                {/* Task Details Pane */}
                {selectedTask && (
                  <Paper 
                    elevation={3} 
                    sx={{ 
                      position: 'fixed',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '30%',
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {isEditingTitle ? (
                        <TextField
                          value={editedTitle}
                          onChange={handleTitleChange}
                          onBlur={handleTitleBlur}
                          onKeyPress={handleTitleKeyPress}
                          autoFocus
                          fullWidth
                          variant="standard"
                          sx={{
                            '& .MuiInputBase-root': {
                              fontSize: '1.25rem',
                              fontWeight: 500,
                              '&:before': {
                                borderBottom: 'none'
                              },
                              '&:hover:not(.Mui-disabled):before': {
                                borderBottom: 'none'
                              },
                              '&:after': {
                                borderBottom: 'none'
                              }
                            }
                          }}
                        />
                      ) : (
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            mb: 0,
                            cursor: 'pointer',
                            '&:hover': {
                              color: 'primary.main'
                            },
                            flex: 1
                          }}
                          onClick={handleTitleClick}
                        >
                          {selectedTask.text}
                        </Typography>
                      )}
                      <IconButton
                        onClick={() => toggleImportance(selectedTask.id, selectedTask.importance ?? false)}
                        size="small"
                        sx={{
                          color: selectedTask.importance ? 'red' : 'grey',
                          '& .MuiSvgIcon-root': {
                            fontSize: 18,
                          },
                        }}
                      >
                        {selectedTask.importance ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setSelectedTask(null)}
                        sx={{
                          '&:hover': {
                            color: 'error.main'
                          }
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {/* Task Steps Section */}
                      <Accordion 
                        defaultExpanded
                        elevation={0}
                        sx={{ 
                          backgroundColor: 'transparent',
                          '&:before': {
                            display: 'none',
                          },
                          '& .MuiAccordionSummary-root': {
                            display: 'none'
                          },
                          '& .MuiAccordionDetails-root': {
                            padding: 0
                          }
                        }}
                      >
                        <AccordionSummary />
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {/* Add New Step Input */}
                            <TextField
                              value={newStepText}
                              onChange={(e) => setNewStepText(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && createTaskStep()}
                              placeholder="添加新步骤..."
                              size="small"
                              fullWidth
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </InputAdornment>
                                ),
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  height: '28px',
                                  fontSize: '13px',
                                  '& fieldset': {
                                    borderColor: 'divider'
                                  }
                                }
                              }}
                            />

                            {/* Steps List */}
                            <List 
                              dense
                              disablePadding
                              sx={{ 
                                maxHeight: '200px',
                                overflow: 'auto',
                                '& .MuiListItem-root': {
                                  py: 0
                                }
                              }}
                            >
                              {taskSteps.map(step => (
                                <ListItem
                                  key={step.id}
                                  disablePadding
                                  secondaryAction={
                                    <IconButton
                                      edge="end"
                                      size="small"
                                      onClick={() => deleteTaskStep(step.id)}
                                      sx={{
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        '&:hover': {
                                          color: 'error.main'
                                        },
                                        '.MuiListItem-root:hover &': {
                                          opacity: 1
                                        }
                                      }}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </IconButton>
                                  }
                                >
                                  <ListItemButton
                                    dense
                                    onClick={() => toggleTaskStep(step.id, step.completed)}
                                    sx={{
                                      py: 0.25,
                                      '&:hover': {
                                        backgroundColor: 'action.hover'
                                      }
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: '28px' }}>
                                      <Checkbox
                                        edge="start"
                                        checked={step.completed}
                                        size="small"
                                        sx={{ p: 0.25 }}
                                      />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={
                                        <Typography
                                          sx={{
                                            fontSize: '13px',
                                            textDecoration: step.completed ? 'line-through' : 'none',
                                            color: step.completed ? 'text.secondary' : 'text.primary'
                                          }}
                                        >
                                          {step.text}
                                        </Typography>
                                      }
                                    />
                                  </ListItemButton>
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    </Box>

                    {/* Color Tag Selection */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      {colorOptions.map((color) => (
                        <Box
                          key={color.value}
                          onClick={() => handleColorTagClick(color.value)}
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            backgroundColor: selectedColor === color.value ? color.value : 'transparent',
                            border: '1px solid',
                            borderColor: color.value,
                            '&:hover': {
                              opacity: 0.8
                            },
                            '&:focus': {
                              outline: 'none'
                            },
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            msUserSelect: 'none',
                            MozUserSelect: 'none',
                            '&::selection': {
                              background: 'transparent'
                            }
                          }}
                          tabIndex={-1}
                          title={color.label}
                        />
                      ))}
                    </Box>

                    <Button
                      variant={selectedTask?.isTodayTask ? 'contained' : 'outlined'}
                      {...(selectedTask?.isTodayTask ? { color: 'primary' } : {})}
                      onClick={() => toggleTodayTask(selectedTask.id, selectedTask.isTodayTask ?? false)}
                      size="small"
                      sx={{
                        mt: 0.5,
                        width: '33%',
                        color: selectedTask?.isTodayTask ? 'white' : 'grey',
                        borderColor: selectedTask?.isTodayTask ? 'primary.main' : 'grey.400',
                        '&:hover': {
                          backgroundColor: selectedTask?.isTodayTask ? 'primary.dark' : 'grey.100',
                        },
                      }}
                    >
                      {selectedTask?.isTodayTask ? '已加入今日任务' : '今日任务'}
                    </Button>

                    {/* Remind Me Date-Time Picker */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DateTimePicker
                            value={remindMe ? new Date(remindMe) : null}
                            onChange={(newValue: Date | null) => {
                              setRemindMe(newValue ? newValue.toISOString() : null);
                              if (selectedTask) {
                                saveRemindMe(selectedTask.id, newValue ? newValue.toISOString() : null);
                              }
                            }}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                placeholder: "提醒我",
                                sx: { 
                                  '& .MuiInputBase-root': {
                                    height: '32px',
                                    fontSize: '14px'
                                  }
                                }
                              }
                            }}
                            sx={{ flex: 1 }}
                          />
                        </LocalizationProvider>
                      </Box>

                      <Box sx={{ flex: 1 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DateTimePicker
                            value={dueDate ? new Date(dueDate) : null}
                            onChange={(newValue: Date | null) => {
                              setDueDate(newValue ? newValue.toISOString() : null);
                              if (selectedTask) {
                                saveDueDate(selectedTask.id, newValue ? newValue.toISOString() : null);
                              }
                            }}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                placeholder: "到期时间",
                                sx: { 
                                  '& .MuiInputBase-root': {
                                    height: '32px',
                                    fontSize: '14px'
                                  }
                                }
                              }
                            }}
                            sx={{ flex: 1 }}
                          />
                        </LocalizationProvider>
                      </Box>
                    </Box>

                    {/* Remarks Textarea */}
                    <TextField
                      multiline
                      value={taskDetailInput}
                      onChange={(e) => setTaskDetailInput(e.target.value)}
                      onBlur={() => saveTaskDetail(selectedTask.id, taskDetailInput)}
                      placeholder="备注"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '14px',
                          minHeight: '240px',
                          alignItems: 'flex-start',
                          '& textarea': {
                            overflow: 'hidden',
                            resize: 'none',
                            paddingTop: '14px'
                          }
                        }
                      }}
                    />
                  </Paper>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-lg">Select a task menu to view tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white shadow-lg rounded-lg py-2 z-50 min-w-[150px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="w-full px-4 py-2 text-left text-red-500 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                if (contextMenu.type === 'menu') {
                  deleteTaskMenu(contextMenu.id);
                } else if (contextMenu.type === 'task') {
                  deleteTask(contextMenu.id);
                }
                setContextMenu(null);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}

        <LoginDialog
          open={isLoginDialogOpen}
          onClose={handleLoginClose}
          onLogin={handleLoginSubmit}
          onUserUpdate={handleUserUpdate}
        />
      </div>
    </LocalizationProvider>
  );
} 