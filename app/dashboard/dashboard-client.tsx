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
      <div
        className="cursor-pointer bg-black text-white border border-white p-6 hover:bg-gray-900 hover:border-gray-300 transition-all duration-200 ease-in-out"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        <h2 className="text-xl font-normal mb-2">[{league.league_name}]</h2>
        <p className="text-sm text-gray-400">id: {league.sleeper_league_id}</p>
        {league.rosters_json?.username && (
          <p className="text-sm text-gray-400">team: {league.rosters_json.username}</p>
        )}
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
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-normal"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [dashboard]
          </h1>
          <div className="flex items-center space-x-6">
            {userEmail && (
              <p
                className="text-sm text-gray-400 hidden md:block"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                {userEmail}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [log out]
            </button>
          </div>
        </header>

        {/* Add League Button */}
        <div className="mb-12 text-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 flex items-center mx-auto"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <PlusCircle className="mr-2" size={16} />
            [connect sleeper league]
          </button>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 p-8 w-full max-w-md">
              <h2
                className="text-2xl font-normal mb-6 text-center"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [connect league]
              </h2>
              <form onSubmit={handleSyncLeague} className="space-y-6">
                <div>
                  <label
                    className="block text-sm text-gray-400 mb-2"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    sleeper league id
                  </label>
                  <input
                    type="text"
                    value={leagueId}
                    onChange={e => setLeagueId(e.target.value)}
                    placeholder="123456789"
                    className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                    style={{ fontFamily: 'Consolas, monospace' }}
                    disabled={syncingLeague}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm text-gray-400 mb-2"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    your sleeper username
                  </label>
                  <input
                    type="text"
                    value={sleeperUsername}
                    onChange={e => setSleeperUsername(e.target.value)}
                    placeholder="username"
                    className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                    style={{ fontFamily: 'Consolas, monospace' }}
                    disabled={syncingLeague}
                  />
                </div>
                <div className="flex justify-center space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                    style={{ fontFamily: 'Consolas, monospace' }}
                    disabled={syncingLeague}
                  >
                    [cancel]
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
                    style={{ fontFamily: 'Consolas, monospace' }}
                    disabled={syncingLeague}
                  >
                    {syncingLeague ? '[connecting...]' : '[connect]'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Leagues Section */}
        <section>
          <h2
            className="text-2xl font-normal mb-8 pb-2 border-b border-gray-700"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [your leagues]
          </h2>
          {leagues.length === 0 ? (
            <div
              className="text-center text-gray-400 space-y-2"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <p>no leagues connected yet</p>
              <p className="text-sm">click the button above to get started</p>
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
