'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, Users } from 'lucide-react';
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
              {/* REMOVED: synced timestamp display */}
            </div>
            <Link href={`/league/${league.sleeper_league_id}/comparison`}>
              <button
                className="text-white border border-white hover:bg-white hover:text-black py-2 px-4 flex items-center transition-colors duration-200"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                <Users size={16} className="mr-2" />
                [player comparison]
              </button>
            </Link>
          </div>
        </header>

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
