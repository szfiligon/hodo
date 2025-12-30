"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from "@/components/layout"
import { TodoPage } from "@/components/todo-page"
import { useTodoStore } from '@/lib/store'

export default function Home() {
  const { currentUser, initializeStore } = useTodoStore()
  const router = useRouter()

  useEffect(() => {
    if (!currentUser) {
      initializeStore().then(userRestored => {
        if (!userRestored) {
          router.push('/login')
        }
      })
    }
  }, [currentUser, initializeStore, router])

  // Show loading while checking authentication
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Checking authentication</p>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <TodoPage />
    </Layout>
  )
}
