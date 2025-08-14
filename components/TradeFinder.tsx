'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, ArrowLeftRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { projectionService } from '@/lib/services/projectionService';

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

interface TeamAnalysis {
  owner_id: string;
  team_name: string;
  strengths: string[];
  weaknesses: string[];
  surplus_positions: string[];
  needed_positions: string[];
  overall_score: number;
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
  fairness_tier: 'fleece' | 'somewhat_fair' | 'very_strict';
}

interface TradeFinderData {
  trade_proposals: TradeProposal[];
  team_analyses: TeamAnalysis[];
  total_players_analyzed: number;
  analysis: {
    duration: number;
    week_1_projections: number;
    week_2_projections: number;
    focus_team?: string;
    fairness_threshold: number;
  };
}

interface TradeFinderProps {
  leagueId: string;
}

export default function TradeFinder({ leagueId }: TradeFinderProps) {
  const [data, setData] = useState<TradeFinderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(10);

  const fetchTradeProposals = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/league/${leagueId}/trade-suggestions?max_results=${maxResults}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trade suggestions');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Trade finder fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradeProposals();
  }, [leagueId, maxResults]);

  const getFairnessColor = (score: number) => {
    if (score >= 0.9) return 'text-green-400';
    if (score >= 0.8) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getValueColor = (value: number) => {
    if (value > 20) return 'text-green-400';
    if (value > 0) return 'text-blue-400';
    if (value > -20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Users size={24} />
        <h2
          className="text-2xl font-normal"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [trade finder]
        </h2>
      </div>

      {/* Controls */}
      <div className="bg-black border border-white/20 rounded-none p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              className="block text-sm mb-2"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              max results
            </label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              className="w-full bg-black border border-white/20 px-3 py-2 text-white"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <option value={5}>5 trades</option>
              <option value={10}>10 trades</option>
              <option value={15}>15 trades</option>
              <option value={20}>20 trades</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">focus team (optional)</p>
          </div>

          <button
            onClick={fetchTradeProposals}
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
          {/* Analysis Summary */}
          <div className="bg-black border border-white/20 rounded-none p-4">
            <h3
              className="text-lg font-normal mb-3"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [analysis summary]
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Players Analyzed</div>
                <div className="text-white font-bold">{data.total_players_analyzed}</div>
              </div>
              <div>
                <div className="text-gray-400">Week 1 Projections</div>
                <div className="text-white font-bold">{data.analysis.week_1_projections}</div>
              </div>
              <div>
                <div className="text-gray-400">Week 2 Projections</div>
                <div className="text-white font-bold">{data.analysis.week_2_projections}</div>
              </div>
              <div>
                <div className="text-gray-400">Analysis Time</div>
                <div className="text-white font-bold">{data.analysis.duration}ms</div>
              </div>
            </div>
          </div>

          {/* Trade Proposals */}
          <div className="bg-black border border-white/20 rounded-none">
            <div className="p-4 border-b border-white/20">
              <h3
                className="text-lg font-normal"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [trade proposals] ({data.trade_proposals.length} found)
              </h3>
            </div>

            {data.trade_proposals.length === 0 ? (
              <div className="p-6 text-center">
                <div
                  className="text-gray-400"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  no trades meet your fairness criteria
                </div>
                <div
                  className="text-sm text-gray-500 mt-2"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  try lowering the fairness threshold or check back when more projections are available
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {data.trade_proposals.map((trade, index) => (
                  <div key={trade.trade_id} className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className="text-lg font-normal text-white"
                        style={{ fontFamily: 'Consolas, monospace' }}
                      >
                        #{index + 1} Trade Proposal
                      </div>
                      <div className="text-right">
                        <div
                          className={`