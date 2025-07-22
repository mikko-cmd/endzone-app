'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'

interface League {
  id: string;
  user_email: string;
  league_name: string;
  roster: {
    team_count: number;
    players: string[];
  };
  created_at: string;
}

interface DashboardClientProps {
    user: User;
    initialLeagues: League[];
}

export default function DashboardClient({ user, initialLeagues }: DashboardClientProps) {
  const [leagueId, setLeagueId] = useState('');
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const userEmail = user.email;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Logged out successfully!')
      router.push('/auth/login')
    }
  }

  const handleSyncLeague = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leagueId || !userEmail) {
      toast.error("Please enter a Sleeper League ID.");
      return;
    }
    setSyncing(true);

    try {
      const response = await fetch('/api/sync-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, userEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync league.');
      }
      
      setLeagues(prevLeagues => [...prevLeagues, result.data]);
      toast.success('Sleeper League connected successfully!');
      setIsModalOpen(false);
      setLeagueId('');

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
       <div className="w-full max-w-4xl text-center">
        <header className="flex justify-between items-center mb-12">
            <h1 className="text-3xl sm:text-5xl font-bold">Dashboard</h1>
            <div className="flex items-center space-x-4">
                {userEmail && <p className="text-sm sm:text-lg hidden md:block">Signed in as: {userEmail}</p>}
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold text-sm"
                >
                    Logout
                </button>
            </div>
        </header>
        
        <div className="mb-12">
            <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-[#6e00ff] hover:bg-purple-700 rounded-md font-semibold text-lg"
            >
                Connect New Sleeper League
            </button>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2c1a4d] p-8 rounded-2xl shadow-lg w-full max-w-sm">
              <h2 className="text-2xl font-bold mb-6">Connect Your League</h2>
              <form onSubmit={handleSyncLeague} className="space-y-4">
                <input
                  type="text"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  placeholder="Enter Sleeper League ID"
                  className="w-full p-3 bg-[#1a0033] border border-purple-800 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  disabled={syncing}
                />
                <div className="flex justify-end space-x-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white" disabled={syncing}>
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-[#6e00ff] hover:bg-purple-700 rounded-md font-semibold" disabled={syncing}>
                    {syncing ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 border-b-2 border-purple-800 pb-2">Your Connected Leagues</h2>
            {leagues.length === 0 ? (
                <div>You haven’t connected any leagues yet.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leagues.map(league => (
                        <div key={league.id} className="bg-[#2c1a4d] p-6 rounded-xl shadow-lg text-left">
                            <h3 className="text-xl font-bold mb-2">{league.league_name}</h3>
                            <p className="text-purple-400 mb-4">{league.roster.team_count} Teams</p>
                            <h4 className="font-semibold mb-2">Your Top Players:</h4>
                            <p className="text-gray-300 text-sm">
                                {league.roster.players.slice(0, 3).join(', ')}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </section>
      </div>
    </div>
  )
} 