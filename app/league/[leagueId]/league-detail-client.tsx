'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, Users } from 'lucide-react'; // Import Users icon
import { timeAgo } from '@/lib/utils';
import { PlayerStatsRow } from '@/components/PlayerStatsRow';
import LoadingArc from '@/components/LoadingArc';
import PlayerCardModal from '@/components/PlayerCardModal';
import { useVirtualizer } from '@tanstack/react-virtual';

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
  >
    <RosterSection title="Starters" players={starters} onPlayerClick={onPlayerClick} />
    <RosterSection title="Bench" players={bench} onPlayerClick={onPlayerClick} />
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
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimate the height of each player row
    overscan: 10,
  });

  return (
    <section className="bg-[#2c1a4d] rounded-xl shadow-lg mb-8">
      <h2 className="text-2xl font-bold p-4 border-b border-purple-800">
        {title}
      </h2>
      <div ref={parentRef} className="h-[600px] overflow-y-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualItem => {
            const player = players[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <PlayerStatsRow player={player} onPlayerClick={onPlayerClick} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default function LeagueDetailClient({ league }: { league: League }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!league.rosters_json) {
    return <LoadingArc />;
  }

  const { starters, roster } = league.rosters_json;
  const starterIds = new Set(starters.map(p => p.id));
  const bench = roster.filter(p => !starterIds.has(p.id));

  return (
    <div className="min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6 transition-colors"
        >
          <ChevronLeft size={20} className="mr-2" />
          Back to Dashboard
        </Link>

        <header className="mb-8 border-b border-purple-800 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold mb-2">{league.league_name}</h1>
              <p className="text-lg text-gray-400">
                Full Roster for {league.rosters_json?.username || 'Your Team'}
              </p>
              {isMounted && league.last_synced_at && (
                <p className="text-sm text-gray-500 mt-2">
                  Last Synced: {timeAgo(league.last_synced_at)}
                </p>
              )}
            </div>
            <Link href={`/league/${league.sleeper_league_id}/comparison`}>
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors">
                <Users size={20} className="mr-2" />
                Player Comparison
              </button>
            </Link>
          </div>
        </header>
        {isMounted ? (
          <RosterView
            starters={starters}
            bench={bench}
            onPlayerClick={setSelectedPlayerId}
          />
        ) : (
          <LoadingArc />
        )}
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
