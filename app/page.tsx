import { createClient } from '@/lib/supabase/server'
import DashboardClient from './dashboard/dashboard-client'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's leagues if they're logged in
  let leagues = null;
  if (user) {
    const { data: userLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('user_email', user.email);
    leagues = userLeagues;
  }

  return (
    <DashboardClient
      initialLeagues={leagues || []}
      isAuthenticated={!!user}
      userEmail={user?.email || null}
    />
  );
} 