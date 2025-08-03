import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPlayerById } from '../../../lib/sleeper/fetchAllPlayers';
import {
  getPlayerStatsByName,
  PlayerStats,
} from '../../../lib/rapidapi/fetchPlayerStats';

export default async function PlayerDetailPage({
  params,
}: {
  params: { playerId: string };
}) {
  const player = await getPlayerById(params.playerId);

  if (!player) {
    notFound();
  }

  let playerStats: PlayerStats | null = null;
  if (player) {
    const playerName =
      player.full_name || `${player.first_name} ${player.last_name}`;
    // Pass the environment variables from the page to the function
    playerStats = await getPlayerStatsByName(
      playerName,
      process.env.RAPIDAPI_KEY,
      process.env.RAPIDAPI_HOST,
    );
  }

  // Get the previous page's path to use in our back button
  const referer = headers().get('referer');

  return (
    <div className="min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
      <div className="w-full max-w-4xl mx-auto">
        {referer && (
          <Link
            href={referer}
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6 transition-colors"
          >
            <ChevronLeft size={20} className="mr-2" />
            Back
          </Link>
        )}

        <header className="mb-8 border-b border-purple-800 pb-4">
          <h1 className="text-4xl sm:text-6xl font-bold mb-2">
            {player.full_name || `${player.first_name} ${player.last_name}`}
          </h1>
          <div className="text-lg text-gray-400 flex items-center space-x-4">
            <span>Team: {player.team || 'N/A'}</span>
            <span>Position: {player.position || 'N/A'}</span>
            <span>Number: #{player.number || 'N/A'}</span>
          </div>
        </header>

        <section className="bg-[#2c1a4d] p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Performance Stats</h2>
          {playerStats && Object.keys(playerStats).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-center">
              {Object.entries(playerStats).map(([stat, value]) => (
                <div key={stat} className="bg-purple-900/50 p-3 rounded-lg">
                  <p className="text-sm text-purple-300 capitalize">
                    {stat.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xl font-bold">{String(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">
                No live stats available for this player at the moment.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

