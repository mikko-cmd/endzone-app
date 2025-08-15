import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, TrendingUp, ChevronRight, Users } from 'lucide-react';

interface League {
  id: string;
  sleeper_league_id: string;
  league_name: string;
  sleeper_username: string | null;
  rosters_json: any | null;
}

export default async function WaiverWireToolPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user's leagues
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
        <Link
          href="/tools"
          className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          <ChevronLeft size={20} className="mr-2" />
          [back to ai tools]
        </Link>

        <header className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp size={32} />
            <h1
              className="text-3xl sm:text-4xl font-normal"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [waiver wire assistant]
            </h1>
          </div>
          <p
            className="text-lg text-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            ai-powered waiver wire recommendations for your leagues
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
              connect a league to get waiver wire recommendations
            </p>
            <Link
              href="/leagues"
              className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [connect leagues]
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2
                className="text-2xl font-normal mb-4"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [select a league]
              </h2>
              <p
                className="text-gray-400"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                choose a league to analyze waiver wire opportunities
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map((league: League) => (
                <Link
                  key={league.sleeper_league_id}
                  href={`/league/${league.sleeper_league_id}/waivers?from=ai-tools`}
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

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center space-x-2">
                        <TrendingUp size={16} className="text-green-400" />
                        <span className="text-sm text-green-400">
                          analyze waiver wire
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/leagues/connect"
                className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [connect another league]
              </Link>
            </div>
          </>
        )}

        {/* Feature Overview */}
        <div className="mt-12 pt-8 border-t border-white/20">
          <h3
            className="text-xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [waiver wire features]
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="bg-black border border-white/20 p-4"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <h4 className="text-lg font-normal text-white mb-2">[smart scoring]</h4>
              <p className="text-sm text-gray-400">
                ai-powered player scoring based on adp, team needs, and performance metrics
              </p>
            </div>

            <div
              className="bg-black border border-white/20 p-4"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <h4 className="text-lg font-normal text-white mb-2">[team analysis]</h4>
              <p className="text-sm text-gray-400">
                analyzes your roster to identify positional needs and depth requirements
              </p>
            </div>

            <div
              className="bg-black border border-white/20 p-4"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <h4 className="text-lg font-normal text-white mb-2">[real-time data]</h4>
              <p className="text-sm text-gray-400">
                live player availability based on current league rosters and injury status
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
