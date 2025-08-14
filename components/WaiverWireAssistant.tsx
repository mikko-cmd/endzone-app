'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users, AlertTriangle, Filter, Loader2 } from 'lucide-react';
import { projectionService } from '@/lib/services/projectionService';

interface WaiverWirePlayer {
  player_id: string;
  name: string;
  position: string;
  team: string;
  adp_rank?: number;
  waiver_score: number;
  injury_status?: string;
  bye_week?: number;
  reasons: string[];
}

interface TeamNeeds {
  [position: string]: {
    priority: 'high' | 'medium' | 'low';
    count: number;
  };
}

interface WaiverWireData {
  players: WaiverWirePlayer[];
  teamNeeds: TeamNeeds;
  totalAvailable: number;
  analysis: {
    duration: number;
    rosteredCount: number;
    filterApplied: string;
  };
}

interface WaiverWireAssistantProps {
  leagueId: string;
}

export default function WaiverWireAssistant({ leagueId }: WaiverWireAssistantProps) {
  const [data, setData] = useState<WaiverWireData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [limit, setLimit] = useState(20);

  const fetchWaiverWire = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/league/${leagueId}/waiver-wire?position=${selectedPosition}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch waiver wire data');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Waiver wire fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaiverWire();
  }, [leagueId, selectedPosition, limit]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 200) return 'text-green-400';
    if (score >= 100) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <TrendingUp size={24} />
        <h2
          className="text-2xl font-normal"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [waiver wire assistant]
        </h2>
      </div>

      {/* Controls */}
      <div className="bg-black border border-white/20 rounded-none p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter size={16} />
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              position:
            </span>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="bg-black border border-white text-white px-3 py-1 rounded-none text-sm"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <option value="ALL">all</option>
              <option value="QB">qb</option>
              <option value="RB">rb</option>
              <option value="WR">wr</option>
              <option value="TE">te</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              limit:
            </span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-black border border-white text-white px-3 py-1 rounded-none text-sm"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>

          <button
            onClick={fetchWaiverWire}
            disabled={loading}
            className="bg-black border border-white hover:bg-gray-900 text-white px-4 py-1 rounded-none flex items-center text-sm transition-colors"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                analyzing...
              </>
            ) : (
              'refresh'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-600 rounded-none p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span
              className="text-red-300"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              {error}
            </span>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Team Needs */}
          <div className="bg-black border border-white/20 rounded-none p-4">
            <h3
              className="text-lg font-normal mb-3"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [team needs analysis]
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.team_needs && Object.entries(data.team_needs).map(([position, need]) => (
                <div key={position} className="text-center">
                  <div
                    className="text-sm text-gray-400"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    {position}
                  </div>
                  <div
                    className={`text-lg font-bold ${getPriorityColor(need.priority)}`}
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    {need.priority}
                  </div>
                  <div
                    className="text-xs text-gray-500"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  >
                    {need.count} rostered
                  </div>
                </div>
              ))}
              {!data.team_needs && (
                <div className="text-gray-400 text-center col-span-full">
                  Team needs analysis not available
                </div>
              )}
            </div>
          </div>

          {/* Available Players */}
          <div className="bg-black border border-white/20 rounded-none">
            <div className="p-4 border-b border-white/20">
              <h3
                className="text-lg font-normal"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [top recommendations] ({data.players?.length || 0}/{data.summary?.total_available || 0} available)
              </h3>
            </div>

            <div className="divide-y divide-white/10">
              {data.players.map((player, index) => (
                <div key={player.player_id} className="p-4 hover:bg-gray-900 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span
                          className="text-lg font-bold text-white"
                          style={{ fontFamily: 'Consolas, monospace' }}
                        >
                          #{index + 1}
                        </span>
                        <div>
                          <div
                            className="text-lg font-normal text-white"
                            style={{ fontFamily: 'Consolas, monospace' }}
                          >
                            {player.name}
                          </div>
                          <div
                            className="text-sm text-gray-400"
                            style={{ fontFamily: 'Consolas, monospace' }}
                          >
                            {player.position} - {player.team}
                            {player.adp_rank && ` • ADP ${player.adp_rank}`}
                            {player.bye_week && ` • Bye ${player.bye_week}`}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {player.reasons.map((reason, reasonIndex) => (
                          <div
                            key={reasonIndex}
                            className="text-sm text-gray-300 flex items-center"
                            style={{ fontFamily: 'Consolas, monospace' }}
                          >
                            <span className="w-1.5 h-1.5 bg-white rounded-full mr-2"></span>
                            {reason}
                          </div>
                        ))}
                      </div>

                      {player.injury_status && (
                        <div className="mt-2 flex items-center space-x-2">
                          <AlertTriangle size={14} className="text-yellow-400" />
                          <span
                            className="text-sm text-yellow-400"
                            style={{ fontFamily: 'Consolas, monospace' }}
                          >
                            {player.injury_status}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${getScoreColor(player.waiver_score)}`}
                        style={{ fontFamily: 'Consolas, monospace' }}
                      >
                        {player.waiver_score}
                      </div>
                      <div
                        className="text-xs text-gray-500"
                        style={{ fontFamily: 'Consolas, monospace' }}
                      >
                        waiver score
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis Summary */}
          <div
            className="text-xs text-gray-500 text-center"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            analysis completed • {data.summary?.total_available || 0} players analyzed
          </div>
        </>
      )}
    </div>
  );
}
