'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import type { User } from '@supabase/supabase-js';
import { PlusCircle, Users, Brain, Search, Newspaper } from 'lucide-react';

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
        className="cursor-pointer bg-black text-white border border-white/20 p-4 hover:bg-gray-900 hover:border-white/40 transition-all duration-200 ease-in-out"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        <h3 className="text-lg font-normal mb-1">[{league.league_name}]</h3>
        <p className="text-xs text-gray-400">id: {league.sleeper_league_id}</p>
        {league.rosters_json?.username && (
          <p className="text-xs text-gray-400">team: {league.rosters_json.username}</p>
        )}
      </div>
    </Link>
  );
};

interface HubTileProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const HubTile: React.FC<HubTileProps> = ({ title, description, href, icon }) => {
  return (
    <Link href={href}>
      <div
        className="cursor-pointer bg-black text-white border border-white/20 p-6 hover:bg-gray-900 hover:border-white/40 transition-all duration-200 ease-in-out h-full"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        <div className="flex items-center space-x-3 mb-3">
          {icon}
          <h3 className="text-xl font-normal">[{title}]</h3>
        </div>
        <p className="text-sm text-gray-400">{description}</p>
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

      setLeagues(prevLeagues => {
        const existingIndex = prevLeagues.findIndex(l => l.id === newLeague.id);
        if (existingIndex > -1) {
          const updated = [...prevLeagues];
          updated[existingIndex] = newLeague;
          return updated;
        }
        return [...prevLeagues, newLeague];
      });

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
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h1
            className="text-4xl sm:text-5xl font-normal mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [home]
          </h1>
          <p
            className="text-lg text-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            welcome back, {userEmail}
          </p>
        </header>

        {/* Hub Tiles */}
        <section className="mb-12">
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [quick access]
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <HubTile
              title="My Leagues"
              description="View and manage your fantasy leagues"
              href="/leagues"
              icon={<Users size={20} />}
            />
            <HubTile
              title="AI Tools"
              description="Player comparisons, waiver picks, trades"
              href="/tools"
              icon={<Brain size={20} />}
            />
            <HubTile
              title="Research"
              description="Player stats, ADP rankings, DFS tools"
              href="/research"
              icon={<Search size={20} />}
            />
            <HubTile
              title="News"
              description="Injury reports and league updates"
              href="/news"
              icon={<Newspaper size={20} />}
            />
          </div>
        </section>

        {/* Recent Activity Placeholder */}
        <section className="mb-12">
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [recent activity]
          </h2>
          <div
            className="bg-black border border-white/20 p-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <p className="text-gray-400">activity feed coming soon...</p>
          </div>
        </section>

        {/* Leagues Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2
              className="text-2xl font-normal"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [your leagues]
            </h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 flex items-center"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <PlusCircle className="mr-2" size={16} />
              [connect league]
            </button>
          </div>

          {leagues.length === 0 ? (
            <div
              className="text-center text-gray-400 space-y-2 py-8"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <p>no leagues connected yet</p>
              <p className="text-sm">click the button above to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map(league => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          )}
        </section>

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
      </div>
    </div>
  );
}
