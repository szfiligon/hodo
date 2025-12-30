"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTodoStore } from '@/lib/store'
import { Loader2, User, Lock } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)

  const { loginUser, createUser } = useTodoStore()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isCreatingAccount) {
        // Create new account
        const success = await createUser(username, password)
        if (success) {
          router.push('/')
        } else {
          setError('Failed to create account. Username might already exist.')
        }
      } else {
        // Login to existing account
        const success = await loginUser(username, password)
        if (success) {
          router.push('/')
        } else {
          setError('Invalid username or password')
        }
      }
    } catch {
      setError(isCreatingAccount ? 'Account creation failed. Please try again.' : 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsCreatingAccount(!isCreatingAccount)
    setError('')
  }



  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Hodo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isCreatingAccount ? '创建您的账户开始使用' : '登录您的账户'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 focus:z-10 sm:text-sm transition-colors"
                  placeholder="请输入用户名"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isCreatingAccount ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 focus:z-10 sm:text-sm transition-colors"
                  placeholder="请输入密码"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}



          <div className="space-y-3">
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isCreatingAccount ? '创建账户中...' : '登录中...'}
                </>
              ) : (
                <>
                  <User className="h-4 w-4 mr-2" />
                  {isCreatingAccount ? '创建账户' : '登录'}
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={toggleMode}
              disabled={isLoading}
            >
              {isCreatingAccount ? '已有账户？登录' : '新用户？创建账户'}
            </Button>
            

          </div>
        </form>
      </div>
    </div>
  )
} 