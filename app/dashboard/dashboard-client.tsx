'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'
import RosterPreviewCard from '@/components/RosterPreviewCard';

interface Roster {
  owner_name: string;
  players: string[];
}

interface League {
  id: string; // The unique UUID from Supabase
  sleeper_league_id: string; // The ID from the Sleeper API
  user_email: string;
  league_name: string;
  created_at: string;
  last_synced_at: string | null;
  rosters: Roster[] | null;
}

interface DashboardClientProps {
    user: User;
    initialLeagues: League[];
}

export default function DashboardClient({ user, initialLeagues }: DashboardClientProps) {
  const [leagueId, setLeagueId] = useState('');
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [syncing, setSyncing] = useState(false);
  const [syncingRosterId, setSyncingRosterId] = useState<string | null>(null);
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
        body: JSON.stringify({
          sleeper_league_id: leagueId,
          user_email: userEmail
        }),
      });

      const result = await response.json();
      console.log('API Response:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to sync league.');
      }
      
      // Upsert logic for the frontend state
      setLeagues(prevLeagues => {
        const existingLeagueIndex = prevLeagues.findIndex(l => l.id === result.data.id);
        if (existingLeagueIndex > -1) {
          // Update existing league
          const updatedLeagues = [...prevLeagues];
          updatedLeagues[existingLeagueIndex] = result.data;
          return updatedLeagues;
        } else {
          // Add new league
          return [...prevLeagues, result.data];
        }
      });

      toast.success('Sleeper League connected successfully!');
      setIsModalOpen(false);
      setLeagueId('');

    } catch (error: any) {
      console.error('Sync League Error:', error);
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncRoster = async (sleeper_league_id: string) => {
    if (!userEmail) {
      toast.error("User not found. Please log in again.");
      return;
    }
    setSyncingRosterId(sleeper_league_id);

    try {
      const response = await fetch('/api/rosters/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_league_id, user_email: userEmail }),
      });

      const result = await response.json();
      console.log('Roster Sync API Response:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to sync roster.');
      }

      setLeagues(prevLeagues =>
        prevLeagues.map(league =>
          league.id === result.data.id ? result.data : league
        )
      );

      toast.success('Roster synced successfully!');
    } catch (error: any) {
      console.error('Sync Roster Error:', error);
      toast.error(error.message);
    } finally {
      setSyncingRosterId(null);
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
                <div>
                  <p>You haven’t connected any leagues yet.</p>
                  <p className='text-sm text-gray-400'>Click the button above to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leagues.map(league => (
                        <div key={league.id} className="bg-[#2c1a4d] p-6 rounded-xl shadow-lg text-left flex flex-col justify-between">
                            <div>
                              <h3 className="text-xl font-bold mb-2">{league.league_name || `League ${league.sleeper_league_id}`}</h3>
                              <p className="text-purple-400 mb-4 text-sm">
                                Last synced: {league.last_synced_at ? new Date(league.last_synced_at).toLocaleString() : 'Never'}
                              </p>
                            </div>
                            <div>
                              <button
                                onClick={() => handleSyncRoster(league.sleeper_league_id)}
                                disabled={syncingRosterId === league.sleeper_league_id}
                                className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold text-sm disabled:bg-gray-500 disabled:cursor-not-allowed"
                              >
                                {syncingRosterId === league.sleeper_league_id ? 'Syncing...' : 'Sync Roster Now'}
                              </button>
                            </div>
                            <RosterPreviewCard rosters={league.rosters} />
                        </div>
                    ))}
                </div>
            )}
        </section>
      </div>
    </div>
  )
} 