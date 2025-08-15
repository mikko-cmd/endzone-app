'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { PlusCircle, Users, Brain, Search, Newspaper } from 'lucide-react';
import ActivityFeed from '@/components/ActivityFeed';

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
  initialLeagues: League[];
  isAuthenticated: boolean;
  userEmail: string | null;
}

export default function DashboardClient({
  initialLeagues,
  isAuthenticated,
  userEmail
}: DashboardClientProps) {
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [leagueId, setLeagueId] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [syncingLeague, setSyncingLeague] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Remove the problematic user debug lines (lines 104-109) and replace with:
  const userDisplayName = isAuthenticated
    ? (userEmail?.split('@')[0] || 'User')
    : 'Guest';

  // Update the sync league function to use userEmail instead of user.email:
  const handleSyncLeague = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check if user is authenticated
    if (!isAuthenticated) {
      alert('Please sign up or log in to connect a league');
      router.push('/auth/signup');
      return;
    }

    if (!leagueId || !sleeperUsername) {
      return;
    }
    setSyncingLeague(true);

    try {
      const response = await fetch('/api/sync-league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueId,
          sleeperUsername,
          userEmail, // Use the prop instead of user.email
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.data) {
        throw new Error(result.error || 'Failed to connect league.');
      }

      const newLeague = result.data as League;

      setLeagues(prevLeagues => {
        const existingIndex = prevLeagues.findIndex(l => l.id === newLeague.id);
        if (existingIndex > -1) {
          const updated = [...prevLeagues];
          updated[existingIndex] = newLeague;
          return updated;
        }
        return [...prevLeagues, newLeague];
      });

      // setIsModalOpen(false); // This line was removed from the original file
      setLeagueId('');
      setSleeperUsername('');
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncError('Failed to sync league. Please try again.');
    } finally {
      setSyncingLeague(false);
    }
  };

  // Add a banner for guest users
  const renderGuestBanner = () => {
    if (isAuthenticated) return null;

    return (
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg mb-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
            Welcome to Endzone Fantasy Football
          </h2>
          <p className="text-blue-100 mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
            Get AI-powered trade suggestions, player analysis, and league insights
          </p>
          <div className="space-x-4">
            <Link
              href="/auth/signup"
              className="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              Sign Up Free
            </Link>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 border border-white text-white rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Update the activity feed section
  const renderActivitySection = () => {
    if (!isAuthenticated) {
      return (
        <div className="bg-black border border-white/20 p-6" style={{ fontFamily: 'Consolas, monospace' }}>
          <h3 className="text-xl font-normal text-white mb-4">
            [Recent Activity]
          </h3>
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              Sign up or log in to view your league's activity
            </p>
            <div className="space-x-4">
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2 text-white hover:text-blue-400 transition-colors border border-gray-600 rounded-md hover:border-blue-400"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [login]
              </Link>
              <Link
                href="/auth/signup"
                className="inline-block px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [signup]
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Show normal ActivityFeed for authenticated users
    return <ActivityFeed />;
  };

  // Update leagues section
  const renderLeaguesSection = () => {
    const noLeaguesMessage = isAuthenticated
      ? "No leagues connected. Connect your first league above!"
      : "Sign up or log in to connect and manage your leagues";

    if (leagues.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
            {noLeaguesMessage}
          </p>
          {!isAuthenticated && (
            <div className="space-x-4">
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2 text-white hover:text-blue-400 transition-colors border border-gray-600 rounded-md hover:border-blue-400"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [login]
              </Link>
              <Link
                href="/auth/signup"
                className="inline-block px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [signup]
              </Link>
            </div>
          )}
        </div>
      );
    }

    // Show leagues for authenticated users
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </div>
    );
  };

  // Add to the Quick Access Links section
  const handleConnectLeagueClick = () => {
    if (!isAuthenticated) {
      alert('Please sign up or log in to connect a league');
      router.push('/auth/signup');
      return;
    }
    router.push('/leagues');
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
            welcome back, {userDisplayName}
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
            <div
              onClick={handleConnectLeagueClick}
              className="bg-black border border-white/20 p-6 h-full transition-all duration-200 hover:border-white/40 hover:bg-gray-900 cursor-pointer"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Users size={20} className="text-white" />
                  <h3 className="text-lg font-normal text-white">[My Leagues]</h3>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                {isAuthenticated
                  ? "View and manage your fantasy leagues"
                  : "Connect your fantasy leagues (Login Required)"
                }
              </p>
            </div>
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

        {/* Leagues Section */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2
              className="text-2xl font-normal"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [your leagues]
            </h2>
            <button
              onClick={() => setIsManualMode(true)} // Changed to setIsManualMode
              className="px-4 py-2 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 flex items-center"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <PlusCircle className="mr-2" size={16} />
              [connect league]
            </button>
          </div>

          {renderLeaguesSection()}
        </section>

        {/* Recent Activity */}
        <section className="mb-12">
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [recent activity]
          </h2>
          {renderActivitySection()}
        </section>

        {/* Modal */}
        {isManualMode && ( // Changed to isManualMode
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
                    onClick={() => setIsManualMode(false)} // Changed to setIsManualMode
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
