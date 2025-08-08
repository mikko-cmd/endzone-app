import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Clock, ChevronRight } from 'lucide-react';

interface League {
  id: string;
  sleeper_league_id: string;
  league_name: string;
  sleeper_username: string | null;
  created_at: string;
  last_synced_at: string | null;
  rosters_json: any | null;
}

export default async function LeaguesPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch leagues:', error);
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="mb-8">
          <h1
            className="text-4xl font-normal mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [my leagues]
          </h1>
          <p
            className="text-lg text-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            manage your fantasy football leagues
          </p>
        </header>

        {(!leagues || leagues.length === 0) ? (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-gray-600 mb-4" />
            <h3
              className="text-xl font-normal mb-2"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [no leagues connected]
            </h3>
            <p
              className="text-gray-400 mb-6"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              connect your first sleeper league to get started
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [back to dashboard]
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league: League) => (
              <Link
                key={league.sleeper_league_id}
                href={`/league/${league.sleeper_league_id}`}
                className="group"
              >
                <div
                  className="bg-black border border-white/20 p-6 hover:border-white/40 hover:bg-gray-900 transition-all duration-200 cursor-pointer h-full"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-normal text-white mb-2 group-hover:text-gray-300 transition-colors">
                        [{league.league_name}]
                      </h3>
                      <p className="text-sm text-gray-400">
                        id: {league.sleeper_league_id}
                      </p>
                      {league.rosters_json?.username && (
                        <p className="text-sm text-gray-400">
                          team: {league.rosters_json.username}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />
                  </div>

                  <div className="flex items-center text-xs text-gray-500">
                    <Clock size={14} className="mr-1" />
                    {league.last_synced_at
                      ? `synced ${new Date(league.last_synced_at).toLocaleDateString()}`
                      : 'not synced'
                    }
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {leagues && leagues.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/leagues/connect"
              className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [connect another league]
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}



