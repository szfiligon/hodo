'use client';

import { useState, useEffect, useRef } from 'react';

interface TaskMenu {
  id: number;
  name: string;
}

interface Task {
  id: number;
  task_menu_id: number;
  text: string;
  created_at: string;
  completed: boolean;
}

export default function TodoList() {
  const [taskMenus, setTaskMenus] = useState<TaskMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'menu' | 'task'; id: number } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailInput, setTaskDetailInput] = useState('');

  const contextMenuRef = useRef<HTMLDivElement>(null);

  const fixedTaskMenus: TaskMenu[] = [{ id: -1, name: '所有任务' }];

  useEffect(() => {
    fetchTaskMenus();
    setTaskMenus(fixedTaskMenus);
  }, []);

  useEffect(() => {
    if (selectedMenu !== null) {
      fetchTasks(selectedMenu);
    }
  }, [selectedMenu]);

  useEffect(() => {
    if (selectedTask) {
      fetchTaskDetail(selectedTask.id);
    }
  }, [selectedTask]);

  const fetchTaskMenus = async () => {
    const response = await fetch('/api/task-menus');
    const data = await response.json();
    setTaskMenus([...fixedTaskMenus, ...data]);
  };

  const fetchTasks = async (menuId: number) => {
    let data;
    if (menuId === -1) {
      const response = await fetch('/api/tasks');
      data = await response.json();
    } else {
      const response = await fetch(`/api/tasks?taskMenuId=${menuId}`);
      data = await response.json();
    }
    setTasks(data);
  };

  const fetchTaskDetail = async (taskId: number) => {
    const response = await fetch(`/api/tasks?taskId=${taskId}`);
    const data = await response.json();
    setTaskDetailInput(data.remarks || '');
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

  const deleteTaskMenu = async (id: number) => {
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

  const deleteTask = async (id: number) => {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    
    setTasks(tasks.filter(task => task.id !== id));
  };

  const toggleTask = async (id: number, completed: boolean) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: !completed }),
    });
    
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !completed } : task
    ));
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'menu' | 'task', id: number) => {
    e.preventDefault();
    if (type === 'menu' && id === -1) return;
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
        return b.id - a.id; // Assuming `id` is a proxy for creation time
      }
      return a.completed ? 1 : -1;
    });

  function truncateText(text: string, maxLength: number) {
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const saveTaskDetail = async (taskId: number, detail: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, remarks: detail }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800">
      <div className="flex h-screen">
        {/* Left Pane - Task Menus */}
        <div className="w-1/4 bg-white border-r border-gray-200 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-6">Task Menus</h2>
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createTaskMenu()}
                placeholder="Create new menu..."
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
              <svg
                className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {taskMenus.map(menu => (
              <div
                key={menu.id}
                className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedMenu === menu.id 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
                onClick={() => setSelectedMenu(menu.id)}
                onContextMenu={(e) => handleContextMenu(e, 'menu', menu.id)}
                style={{ outline: 'none' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{truncateText(menu.name, 10)}</span>
                  {menu.id !== 0 && (
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTaskMenu(menu.id);
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane - Tasks */}
        <div className="w-3/4 p-8">
          {selectedMenu ? (
            <>
              <div className="mb-8">
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  <svg
                    className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createTask()}
                    placeholder="Add a new task..."
                    className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  <svg
                    className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                    onClick={() => handleTaskClick(task)}
                    onContextMenu={(e) => handleContextMenu(e, 'task', task.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id, task.completed)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                        />
                        {!!task.completed && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className={`${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {truncateText(task.text, 30)}
                      </span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity duration-200"
                      onClick={() => deleteTask(task.id)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Task Details Pane */}
              {selectedTask && (
                <div className="fixed right-0 top-0 h-full w-1/4 bg-white shadow-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Task Details</h3>
                  <p><strong>Name:</strong> {selectedTask.text}</p>
                  <p><strong>Created At:</strong> {new Date(selectedTask.created_at).toLocaleString()}</p>
                  <textarea
                    value={taskDetailInput}
                    onChange={(e) => {
                      setTaskDetailInput(e.target.value);
                      saveTaskDetail(selectedTask.id, e.target.value);
                    }}
                    style={{ width: '90%', height: '30%' }}
                    className="border border-gray-150 rounded-lg p-2 mt-4 focus:border-gray-150"
                  />
                </div>
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
    </div>
  );
} 