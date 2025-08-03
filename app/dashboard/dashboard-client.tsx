'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import type { User } from '@supabase/supabase-js';
import { PlusCircle } from 'lucide-react';

interface RosterData {
  username: string;
  starters: any[];
  roster: any[];
}

interface Matchup {
  week: number;
  matchup_id: number;
  team: string;
  opponent: string;
  starters: string[];
  points: number;
}

interface League {
  id: string;
  sleeper_league_id: string;
  user_email: string;
  league_name: string;
  sleeper_username: string | null;
  created_at: string;
  last_synced_at: string | null;
  rosters_json: RosterData | null;
  matchups_json: Matchup[] | null;
  last_synced_matchups_at: string | null;
}

interface LeagueCardProps {
  league: League;
}

const LeagueCard: React.FC<LeagueCardProps> = ({ league }) => {
  return (
    <Link href={`/league/${league.sleeper_league_id}`}>
      <div className="cursor-pointer bg-purple-900 text-white rounded-xl p-4 shadow-md hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105 transition-all duration-200 ease-in-out">
        <h2 className="text-xl font-semibold">{league.league_name}</h2>
        <p className="text-sm text-gray-300">ID: {league.sleeper_league_id}</p>
      </div>
    </Link>
  );
};

interface DashboardClientProps {
  user: User;
  initialLeagues: League[];
}

export default function DashboardClient({
  user,
  initialLeagues,
}: DashboardClientProps) {
  const [leagueId, setLeagueId] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [syncingLeague, setSyncingLeague] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const userEmail = user.email;

  // Add this useEffect to log league data
  useEffect(() => {
    console.log('[DashboardClient] Leagues loaded:', leagues.length, leagues);
  }, [leagues]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully!');
    router.push('/auth/login');
  };

  const handleSyncRoster = useCallback(
    async (sleeper_league_id: string, email: string, username: string) => {
      try {
        const response = await fetch('/api/rosters/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sleeper_league_id,
            user_email: email,
            sleeper_username: username,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.data) {
          throw new Error(result.error || 'Failed to sync roster.');
        }

        setLeagues(prev =>
          prev.map(l =>
            l.sleeper_league_id === sleeper_league_id ? result.data : l
          )
        );
        return result.data;
      } catch (error: any) {
        console.error('Sync Roster Error:', error);
        toast.error(error.message);
      }
    },
    []
  );

  // TEMPORARILY DISABLE AUTO-SYNC TO IMPROVE PERFORMANCE
  // useEffect(() => {
  //   const syncAllRosters = async () => {
  //     if (!userEmail) return;

  //     const syncPromises = leagues
  //       .filter(league => league.sleeper_username)
  //       .map(league =>
  //         handleSyncRoster(
  //           league.sleeper_league_id,
  //           userEmail,
  //           league.sleeper_username!
  //         )
  //       );

  //     await Promise.all(syncPromises);
  //   };

  //   syncAllRosters();
  // }, [userEmail, handleSyncRoster]);

  const handleSyncLeague = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leagueId || !userEmail || !sleeperUsername) {
      toast.error('Please provide a League ID and your Sleeper Username.');
      return;
    }
    setSyncingLeague(true);

    try {
      const response = await fetch('/api/sync-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_league_id: leagueId,
          user_email: userEmail,
          sleeper_username: sleeperUsername,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.data) {
        throw new Error(result.error || 'Failed to connect league.');
      }

      const newLeague = result.data as League;
      toast.success(`League "${newLeague.league_name}" connected!`);

      const syncedLeague = await handleSyncRoster(
        newLeague.sleeper_league_id,
        newLeague.user_email,
        sleeperUsername
      );

      if (syncedLeague) {
        setLeagues(prevLeagues => {
          const existingIndex = prevLeagues.findIndex(
            l => l.id === syncedLeague.id
          );
          if (existingIndex > -1) {
            const updated = [...prevLeagues];
            updated[existingIndex] = syncedLeague;
            return updated;
          }
          return [...prevLeagues, syncedLeague];
        });
      }

      setIsModalOpen(false);
      setLeagueId('');
      setSleeperUsername('');
    } catch (error: any) {
      console.error('Connect League Error:', error);
      toast.error(error.message);
    } finally {
      setSyncingLeague(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
      <div className="w-full max-w-4xl text-center">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            {userEmail && (
              <p className="text-sm sm:text-lg hidden md:block">
                Signed in as: {userEmail}
              </p>
            )}
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
            className="px-6 py-3 bg-[#6e00ff] hover:bg-purple-700 rounded-md font-semibold text-lg flex items-center"
          >
            <PlusCircle className="mr-2" size={20} />
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
                  onChange={e => setLeagueId(e.target.value)}
                  placeholder="Enter Sleeper League ID"
                  className="w-full p-3 bg-[#1a0033] border border-purple-800 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  disabled={syncingLeague}
                />
                <input
                  type="text"
                  value={sleeperUsername}
                  onChange={e => setSleeperUsername(e.target.value)}
                  placeholder="Your Sleeper Username"
                  className="w-full p-3 bg-[#1a0033] border border-purple-800 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  disabled={syncingLeague}
                />
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                    disabled={syncingLeague}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#6e00ff] hover:bg-purple-700 rounded-md font-semibold"
                    disabled={syncingLeague}
                  >
                    {syncingLeague ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 border-b-2 border-purple-800 pb-2">
            Your Connected Leagues
          </h2>
          {leagues.length === 0 ? (
            <div>
              <p>You haven't connected any leagues yet.</p>
              <p className="text-sm text-gray-400">
                Click the button above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leagues.map(league => {
                console.log('[DashboardClient] Rendering league card for:', league.league_name);
                return <LeagueCard key={league.id} league={league} />;
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
