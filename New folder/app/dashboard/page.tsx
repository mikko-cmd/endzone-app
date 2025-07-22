'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | undefined>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
      } else {
        setUserEmail(user.email)
      }
    }

    fetchUser()
  }, [router, supabase.auth])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Logged out successfully!')
      router.push('/auth/login')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a0033] text-white">
      <div className="w-full max-w-4xl p-8 text-center">
        <h1 className="text-5xl font-bold mb-4">Welcome to your Dashboard</h1>
        {userEmail && <p className="mt-4 text-lg">Logged in as: {userEmail}</p>}
        <button
          onClick={handleLogout}
          className="mt-8 px-6 py-2 bg-[#6e00ff] hover:bg-purple-700 rounded-md font-semibold"
        >
          Logout
        </button>
      </div>
    </div>
  )
} 