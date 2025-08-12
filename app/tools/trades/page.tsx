'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Users, TrendingUp, AlertCircle, Loader2, Target } from 'lucide-react';

interface League {
  id: string;
  sleeper_league_id: string;
  league_name: string;
  sleeper_username: string | null;
  rosters_json: any | null;
}

interface TradeProposal {
  trade_id: string;
  team_a: {
    owner_id: string;
    team_name: string;
    giving: PlayerValue[];
    receiving: PlayerValue[];
    net_value: number;
  };
  team_b: {
    owner_id: string;
    team_name: string;
    giving: PlayerValue[];
    receiving: PlayerValue[];
    net_value: number;
  };
  fairness_score: number;
  mutual_benefit: number;
  reasoning: string[];
}

interface PlayerValue {
  player_id: string;
  name: string;
  position: string;
  team: string;
  current_owner: string;
  trade_value: number;
  weekly_projection: number;
  season_projection: number;
  adp_rank?: number;
  reasons: string[];
}

interface TradeSettings {
  min_fairness: number;
  max_results: number;
  focus_team?: string;
}

export default function TradeFinderPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [settings, setSettings] = useState<TradeSettings>({
    min_fairness: 0.3, // Start with most permissive setting
    max_results: 10,
    focus_team: undefined
  });
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<TradeProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Load user and leagues
  useEffect(() => {
    async function loadData() {
      try {
        // First get the current user
        const authResponse = await fetch('/api/auth/user');
        if (authResponse.ok) {
          const userData = await authResponse.json();
          setUser(userData.user);

          // Then fetch leagues using user email
          if (userData.user?.email) {
            const leaguesResponse = await fetch(`/api/leagues/get?user_email=${encodeURIComponent(userData.user.email)}`);
            if (leaguesResponse.ok) {
              const leaguesData = await leaguesResponse.json();
              if (leaguesData.success) {
                setLeagues(leaguesData.data || []);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load leagues. Please try refreshing the page.');
      }
    }
    loadData();
  }, []);

  const handleFindTrades = async () => {
    if (!selectedLeague) return;

    setLoading(true);
    setError(null);
    setTrades([]);

    try {
      const params = new URLSearchParams({
        min_fairness: settings.min_fairness.toString(),
        max_results: settings.max_results.toString(),
      });

      if (settings.focus_team) {
        params.append('focus_team', settings.focus_team);
      }

      console.log(`Fetching trades with params:`, params.toString());

      const response = await fetch(`/api/league/${selectedLeague}/trade-suggestions?${params}`);
      const data = await response.json();

      console.log('API Response:', data);

      if (data.success) {
        // Handle both response formats
        const proposals = data.data?.trade_proposals || data.trade_proposals || [];
        console.log('Found proposals:', proposals.length);

        setTrades(proposals);

        if (proposals.length === 0) {
          setError(`No viable trades found with ${Math.round(settings.min_fairness * 100)}% fairness threshold. Analysis: ${data.data?.total_players_analyzed || 0} players, ${data.data?.team_analyses?.length || 0} teams. Try lowering threshold to 20%.`);
        }
      } else {
        setError(data.error || 'Failed to generate trade suggestions');
      }
    } catch (err) {
      setError('Failed to connect to trade analysis service');
      console.error('Trade finder error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
  };

  const getFairnessColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

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
            <Users size={32} />
            <h1
              className="text-3xl sm:text-4xl font-normal"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [trade finder]
            </h1>
          </div>
          <p
            className="text-gray-400 text-lg"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            ai-powered trade analysis using sleeper projections
          </p>
        </header>

        {/* Settings Panel - Now Always Visible */}
        <div className="bg-white/5 border border-white/20 p-6 mb-6">
          <h3
            className="text-xl mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [trade settings]
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                className="block text-sm mb-2"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                fairness threshold
              </label>
              <select
                value={settings.min_fairness}
                onChange={(e) => setSettings({ ...settings, min_fairness: parseFloat(e.target.value) })}
                className="w-full bg-black border border-white/20 px-3 py-2 text-white"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                <option value={0.2}>very loose (20%)</option>
                <option value={0.3}>loose (30%)</option>
                <option value={0.4}>relaxed (40%)</option>
                <option value={0.5}>balanced (50%)</option>
                <option value={0.6}>fair (60%)</option>
                <option value={0.7}>strict (70%)</option>
                <option value={0.8}>very strict (80%)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">lower = more trade options</p>
            </div>

            <div>
              <label
                className="block text-sm mb-2"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                max results
              </label>
              <select
                value={settings.max_results}
                onChange={(e) => setSettings({ ...settings, max_results: parseInt(e.target.value) })}
                className="w-full bg-black border border-white/20 px-3 py-2 text-white"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                <option value={5}>5 trades</option>
                <option value={10}>10 trades</option>
                <option value={15}>15 trades</option>
                <option value={20}>20 trades</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm mb-2"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                focus team (optional)
              </label>
              <select
                value={settings.focus_team || ''}
                onChange={(e) => setSettings({ ...settings, focus_team: e.target.value || undefined })}
                className="w-full bg-black border border-white/20 px-3 py-2 text-white"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                <option value="">all teams</option>
                {/* Will populate with team names once league is selected */}
              </select>
              <p className="text-xs text-gray-400 mt-1">trades involving this team</p>
            </div>
          </div>
        </div>

        {/* League Selection */}
        <div className="bg-white/5 border border-white/20 p-6 mb-6">
          <h3
            className="text-xl mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [select league]
          </h3>

          {leagues.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400 mb-4">No leagues found</p>
              <Link
                href="/leagues"
                className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                add a league
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <button
                  key={league.sleeper_league_id}
                  onClick={() => setSelectedLeague(league.sleeper_league_id)}
                  className={`p-4 border transition-all text-left ${selectedLeague === league.sleeper_league_id
                    ? 'border-white bg-white/10'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  <div className="font-medium">
                    {league.league_name || league.sleeper_league_id}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    @{league.sleeper_username || 'unknown'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedLeague && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <button
                onClick={handleFindTrades}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-white text-black hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Target size={20} />
                )}
                <span>
                  {loading ? 'analyzing trades...' : 'find trade opportunities'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle size={20} className="text-red-400" />
              <p
                className="text-red-400"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Debug Info (temporary) */}
        {trades.length === 0 && !loading && selectedLeague && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 mb-6">
            <h4 className="text-yellow-400 mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
              [debug info]
            </h4>
            <div className="text-sm space-y-1">
              <p>Selected League: {selectedLeague}</p>
              <p>Fairness Threshold: {Math.round(settings.min_fairness * 100)}%</p>
              <p>Max Results: {settings.max_results}</p>
              <p>Check browser console for detailed API response</p>
            </div>
          </div>
        )}

        {/* Trade Results */}
        {trades.length > 0 && (
          <div className="space-y-6">
            <h3
              className="text-2xl"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [trade opportunities: {trades.length}]
            </h3>

            {trades.map((trade, index) => (
              <div key={trade.trade_id} className="bg-white/5 border border-white/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4
                    className="text-lg"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    trade #{index + 1}
                  </h4>
                  <div className="flex items-center space-x-4">
                    <span
                      className={`${getFairnessColor(trade.fairness_score)}`}
                      style={{ fontFamily: 'Consolas, monospace' }}
                    >
                      {Math.round(trade.fairness_score * 100)}% fair
                    </span>
                    <span
                      className="text-blue-400"
                      style={{ fontFamily: 'Consolas, monospace' }}
                    >
                      {Math.round(trade.mutual_benefit * 100)}% benefit
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Team A */}
                  <div className="space-y-3">
                    <h5
                      className="font-medium text-blue-400"
                      style={{ fontFamily: 'Consolas, monospace' }}
                    >
                      {trade.team_a.team_name}
                    </h5>

                    <div>
                      <p className="text-sm text-gray-400 mb-2">giving:</p>
                      {trade.team_a.giving.map(player => (
                        <div key={player.player_id} className="flex justify-between items-center py-1">
                          <span>{player.name} ({player.position})</span>
                          <span className="text-green-400">${player.trade_value}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-2">receiving:</p>
                      {trade.team_a.receiving.map(player => (
                        <div key={player.player_id} className="flex justify-between items-center py-1">
                          <span>{player.name} ({player.position})</span>
                          <span className="text-green-400">${player.trade_value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/20">
                      <span
                        className={`font-medium ${trade.team_a.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        net: {formatCurrency(trade.team_a.net_value)}
                      </span>
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="space-y-3">
                    <h5
                      className="font-medium text-purple-400"
                      style={{ fontFamily: 'Consolas, monospace' }}
                    >
                      {trade.team_b.team_name}
                    </h5>

                    <div>
                      <p className="text-sm text-gray-400 mb-2">giving:</p>
                      {trade.team_b.giving.map(player => (
                        <div key={player.player_id} className="flex justify-between items-center py-1">
                          <span>{player.name} ({player.position})</span>
                          <span className="text-green-400">${player.trade_value}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-2">receiving:</p>
                      {trade.team_b.receiving.map(player => (
                        <div key={player.player_id} className="flex justify-between items-center py-1">
                          <span>{player.name} ({player.position})</span>
                          <span className="text-green-400">${player.trade_value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/20">
                      <span
                        className={`font-medium ${trade.team_b.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        net: {formatCurrency(trade.team_b.net_value)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-sm text-gray-400 mb-2">analysis:</p>
                  <ul className="text-sm space-y-1">
                    {trade.reasoning.map((reason, idx) => (
                      <li key={idx} className="text-gray-300">• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
