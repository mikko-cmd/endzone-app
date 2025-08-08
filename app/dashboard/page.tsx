import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'

export default async function Dashboard() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('user_email', user.email);

  if (error) {
    console.error('Failed to fetch leagues:', error)
  }

  return <DashboardClient user={user} initialLeagues={leagues || []} />
} 