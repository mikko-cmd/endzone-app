'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, Users, Brain, TrendingUp, UserCheck } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { PlayerStatsRow } from '@/components/PlayerStatsRow';
import LoadingArc from '@/components/LoadingArc';
import PlayerCardModal from '@/components/PlayerCardModal';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  points: number;
}

interface RosterData {
  username: string;
  starters: Player[];
  roster: Player[];
  isPreDraft?: boolean;
  rosterSettings?: Record<string, number>;
  totalRosterSpots?: number;
  leagueStatus?: string;
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
  matchups_json: any[] | null;
  last_synced_matchups_at: string | null;
}

const AIToolsTab = ({
  href,
  icon,
  children,
  isActive = false
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
}) => (
  <Link href={href}>
    <div
      className={`flex items-center space-x-2 px-4 py-2 border-r border-white/20 hover:bg-gray-900 transition-colors duration-200 ${isActive ? 'bg-gray-900' : ''
        }`}
      style={{ fontFamily: 'Consolas, monospace' }}
    >
      {icon}
      <span className="text-white hover:text-gray-300">{children}</span>
    </div>
  </Link>
);

const RosterView = ({
  starters,
  bench,
  onPlayerClick,
}: {
  starters: Player[];
  bench: Player[];
  onPlayerClick: (playerId: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
    className="space-y-8"
  >
    <RosterSection title="starters" players={starters} onPlayerClick={onPlayerClick} />
    <RosterSection title="bench" players={bench} onPlayerClick={onPlayerClick} />
  </motion.div>
);

const RosterSection = ({
  title,
  players,
  onPlayerClick,
}: {
  title: string;
  players: Player[];
  onPlayerClick: (playerId: string) => void;
}) => {
  return (
    <section className="bg-black border border-white">
      <h2
        className="text-xl font-normal p-4 border-b border-white"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        [{title}]
      </h2>
      <div>
        {players.map((player) => (
          <PlayerStatsRow
            key={player.id}
            player={player}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </div>
    </section>
  );
};

export default function LeagueDetailClient({ league }: { league: League }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isCheckingDraftStatus, setIsCheckingDraftStatus] = useState(false);
  const [autoSyncMessage, setAutoSyncMessage] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-detection for post-draft transition
  useEffect(() => {
    const checkDraftStatus = async () => {
      // Only check if league is currently marked as pre-draft
      if (!league.rosters_json?.isPreDraft) return;

      setIsCheckingDraftStatus(true);
      setAutoSyncMessage('Checking draft status...');

      try {
        // Check current league status from Sleeper API
        const response = await fetch(`https://api.sleeper.app/v1/league/${league.sleeper_league_id}`);
        if (!response.ok) throw new Error('Failed to fetch league status');

        const sleeperData = await response.json();
        console.log('League status check:', sleeperData.status);

        // If league is no longer pre_draft, trigger roster sync
        if (sleeperData.status !== 'pre_draft') {
          setAutoSyncMessage('Draft detected! Syncing roster...');

          // Trigger roster sync
          const syncResponse = await fetch('/api/rosters/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sleeper_league_id: league.sleeper_league_id,
              user_email: league.user_email,
              sleeper_username: league.sleeper_username,
            }),
          });

          if (syncResponse.ok) {
            setAutoSyncMessage('Roster synced! Refreshing page...');
            // Refresh the page to show the new roster data
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            setAutoSyncMessage('Failed to sync roster. Please try refreshing the page.');
          }
        } else {
          setAutoSyncMessage('');
        }
      } catch (error: any) {
        console.error('Failed to check draft status:', error);
        setAutoSyncMessage('');
      } finally {
        setIsCheckingDraftStatus(false);
      }
    };

    // Check immediately when component mounts
    if (isMounted && league.rosters_json?.isPreDraft) {
      checkDraftStatus();
    }

    // Set up periodic checking (every 30 seconds) for pre-draft leagues
    let intervalId: NodeJS.Timeout | null = null;
    if (isMounted && league.rosters_json?.isPreDraft) {
      intervalId = setInterval(checkDraftStatus, 30000); // Check every 30 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isMounted, league.sleeper_league_id, league.user_email, league.sleeper_username, league.rosters_json?.isPreDraft]);

  if (!league.rosters_json) {
    return <LoadingArc />;
  }

  const isPreDraftLeague = league.rosters_json.isPreDraft || false;
  const rosterSettings = league.rosters_json.rosterSettings || {};

  if (isPreDraftLeague) {
    return (
      <div className="min-h-screen bg-black text-white p-4 sm:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {/* Back Navigation */}
          <Link
            href="/dashboard"
            className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <ChevronLeft size={20} className="mr-2" />
            ← [back to dashboard]
          </Link>

          {/* Auto-sync status message */}
          {autoSyncMessage && (
            <div className="mb-6 bg-blue-900/20 border border-blue-400/40 p-4">
              <p className="text-blue-400" style={{ fontFamily: 'Consolas, monospace' }}>
                🔄 {autoSyncMessage}
              </p>
            </div>
          )}

          {/* Header */}
          <header className="mb-8 border-b border-white pb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1
                  className="text-3xl sm:text-4xl font-normal mb-2"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [{league.league_name}]
                </h1>
                <p className="text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                  Status: {league.rosters_json.leagueStatus || 'Pre-Draft'}
                </p>
                <p className="text-yellow-400 text-sm mt-2" style={{ fontFamily: 'Consolas, monospace' }}>
                  ⚠️ Draft has not started yet. Monitoring for draft completion...
                  {isCheckingDraftStatus && ' 🔄'}
                </p>
              </div>
            </div>
          </header>

          {/* Rest of pre-draft UI ... */}
          {/* Roster Configuration Display */}
          <section className="mb-8">
            <h2
              className="text-2xl font-normal mb-4"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [roster configuration]
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(rosterSettings).map(([position, count]) => (
                <div key={position} className="bg-gray-900 border border-white/20 p-4">
                  <div className="text-center">
                    <p className="text-lg font-normal text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                      {position}
                    </p>
                    <p className="text-2xl text-blue-400" style={{ fontFamily: 'Consolas, monospace' }}>
                      {count as number}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-white/20 p-6">
              <p className="text-gray-400 text-center" style={{ fontFamily: 'Consolas, monospace' }}>
                [no players assigned yet - waiting for draft]
              </p>
              <p className="text-gray-500 text-sm text-center mt-2" style={{ fontFamily: 'Consolas, monospace' }}>
                Total roster spots: {league.rosters_json.totalRosterSpots || 'Unknown'}
              </p>
            </div>
          </section>

          {/* Auto-monitoring notification */}
          <section className="mb-8">
            <div className="bg-green-900/20 border border-green-400/40 p-6">
              <p className="text-green-400" style={{ fontFamily: 'Consolas, monospace' }}>
                🤖 Auto-monitoring enabled
              </p>
              <p className="text-gray-300 mt-2" style={{ fontFamily: 'Consolas, monospace' }}>
                We're automatically checking every 30 seconds for draft completion.
                Your roster will sync automatically once the draft starts!
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Continue with existing logic for leagues with players
  const { starters, roster } = league.rosters_json;
  const starterIds = new Set(starters.map(p => p.id));
  const bench = roster.filter(p => !starterIds.has(p.id));

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          <ChevronLeft size={20} className="mr-2" />
          ← [back to dashboard]
        </Link>

        {/* Header */}
        <header className="mb-8 border-b border-white pb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1
                className="text-3xl sm:text-4xl font-normal mb-2"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [{league.league_name}]
              </h1>
              <p
                className="text-lg text-gray-400"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                {league.rosters_json?.username || 'your team'}
              </p>
            </div>
          </div>
        </header>

        {/* AI Tools Navigation */}
        <div className="mb-8">
          <div className="bg-black border border-white inline-flex rounded-none overflow-hidden">
            <AIToolsTab
              href={`/league/${league.sleeper_league_id}/comparison`}
              icon={<Brain size={16} />}
              isActive={true}
            >
              [who do i start]
            </AIToolsTab>
            <AIToolsTab
              href={`/league/${league.sleeper_league_id}/waivers`}
              icon={<TrendingUp size={16} />}
            >
              [waiver wire]
            </AIToolsTab>
            <AIToolsTab
              href={`/league/${league.sleeper_league_id}/trades`}
              icon={<UserCheck size={16} />}
            >
              [trade tools]
            </AIToolsTab>
          </div>
        </div>

        {/* Roster Content */}
        {isMounted ? (
          <RosterView
            starters={starters}
            bench={bench}
            onPlayerClick={setSelectedPlayerId}
          />
        ) : (
          <LoadingArc />
        )}

        {/* Player Modal */}
        {selectedPlayerId && (
          <PlayerCardModal
            playerId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
          />
        )}
      </div>
    </div>
  );
}
