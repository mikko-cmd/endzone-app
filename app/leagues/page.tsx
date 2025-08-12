'use client';

import { createClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Users, Clock, ChevronRight, Trash2, AlertTriangle, X } from 'lucide-react';

interface League {
  id: string;
  sleeper_league_id: string;
  league_name: string;
  sleeper_username: string | null;
  created_at: string;
  last_synced_at: string | null;
  rosters_json: any | null;
  platform?: string;
  is_manual?: boolean;
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingLeague, setDeletingLeague] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null);
  const [removeMode, setRemoveMode] = useState(false); // New state for remove mode

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          redirect('/auth/login');
          return;
        }

        setUser(user);

        const { data: leagues, error } = await supabase
          .from('leagues')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch leagues:', error);
        } else {
          setLeagues(leagues || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleDeleteClick = (league: League, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    setLeagueToDelete(league);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!leagueToDelete) return;

    setDeletingLeague(leagueToDelete.sleeper_league_id);
    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('sleeper_league_id', leagueToDelete.sleeper_league_id)
        .eq('user_email', user.email);

      if (error) {
        throw error;
      }

      // Remove from local state
      setLeagues(prev => prev.filter(l => l.sleeper_league_id !== leagueToDelete.sleeper_league_id));
      setShowDeleteModal(false);
      setLeagueToDelete(null);

      // Exit remove mode if no leagues left
      if (leagues.length === 1) {
        setRemoveMode(false);
      }
    } catch (error: any) {
      console.error('Failed to delete league:', error);
      alert('Failed to delete league: ' + error.message);
    } finally {
      setDeletingLeague(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setLeagueToDelete(null);
  };

  const toggleRemoveMode = () => {
    setRemoveMode(!removeMode);
    // Cancel any pending deletion when exiting remove mode
    if (removeMode) {
      setShowDeleteModal(false);
      setLeagueToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-4 sm:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-400">Loading leagues...</div>
          </div>
        </div>
      </div>
    );
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

        {/* Remove mode banner */}
        {removeMode && (
          <div className="mb-6 p-4 bg-red-400/10 border border-red-400/20 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 size={16} className="text-red-400" />
                <span
                  className="text-red-400 font-medium"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [remove mode active]
                </span>
                <span
                  className="text-gray-400 text-sm"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  click on any league to remove it
                </span>
              </div>
              <button
                onClick={toggleRemoveMode}
                className="text-gray-400 hover:text-white transition-colors"
                title="Exit remove mode"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

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
              connect your first league to get started
            </p>
            <Link
              href="/leagues/connect"
              className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [connect league]
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league: League) => (
              <div
                key={league.sleeper_league_id}
                className={`bg-black border transition-all duration-200 h-full relative ${removeMode
                    ? 'border-red-400/40 hover:border-red-400 hover:bg-red-400/5 cursor-pointer'
                    : 'border-white/20 hover:border-white/40 hover:bg-gray-900'
                  }`}
                style={{ fontFamily: 'Consolas, monospace' }}
                onClick={removeMode ? (e) => handleDeleteClick(league, e) : undefined}
              >
                {/* Main content area */}
                <div className={removeMode ? 'pointer-events-none' : ''}>
                  <Link
                    href={`/league/${league.sleeper_league_id}`}
                    className="block p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className={`text-xl font-normal mb-2 transition-colors ${removeMode ? 'text-red-300' : 'text-white group-hover:text-gray-300'
                          }`}>
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
                        <p className="text-sm text-gray-400">
                          platform: {league.platform || 'Sleeper'}
                        </p>
                        {league.is_manual && (
                          <p className="text-xs text-yellow-400">manual entry</p>
                        )}
                      </div>
                      {removeMode ? (
                        <Trash2 size={20} className="text-red-400" />
                      ) : (
                        <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />
                      )}
                    </div>

                    <div className="flex items-center text-xs text-gray-500">
                      <Clock size={14} className="mr-1" />
                      {league.last_synced_at
                        ? `synced ${new Date(league.last_synced_at).toLocaleDateString()}`
                        : 'not synced'
                      }
                    </div>
                  </Link>
                </div>

                {/* Loading overlay when deleting */}
                {deletingLeague === league.sleeper_league_id && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="flex items-center text-red-400">
                      <div className="w-4 h-4 border border-red-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span style={{ fontFamily: 'Consolas, monospace' }}>
                        [removing...]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {leagues && leagues.length > 0 && (
          <div className="mt-8 text-center space-x-4">
            <Link
              href="/leagues/connect"
              className="inline-block px-6 py-3 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [connect another league]
            </Link>

            <button
              onClick={toggleRemoveMode}
              className={`px-6 py-3 border transition-colors duration-200 ${removeMode
                  ? 'border-red-400 text-red-400 hover:bg-red-400 hover:text-black'
                  : 'border-red-400/40 text-red-400/60 hover:border-red-400 hover:text-red-400'
                }`}
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              {removeMode ? '[exit remove mode]' : '[remove league]'}
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && leagueToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-400/40 p-8 w-full max-w-md">
              <div className="flex items-center mb-4">
                <AlertTriangle size={24} className="text-red-400 mr-3" />
                <h2
                  className="text-xl font-normal text-red-400"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [confirm deletion]
                </h2>
              </div>

              <p
                className="text-gray-300 mb-6"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                Are you sure you want to remove "{leagueToDelete.league_name}"?
                This action cannot be undone.
              </p>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleDeleteCancel}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [cancel]
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingLeague === leagueToDelete.sleeper_league_id}
                  className="px-6 py-2 text-red-400 border border-red-400 hover:bg-red-400 hover:text-black transition-colors duration-200 disabled:opacity-50"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  {deletingLeague === leagueToDelete.sleeper_league_id ? '[removing...]' : '[remove league]'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



