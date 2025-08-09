'use client';

import { useState, useEffect } from 'react';
import { Target, Users, TrendingUp, AlertTriangle, CheckCircle, Clock, Plus } from 'lucide-react';

interface DraftPick {
    pick: number;
    round: number;
    player: string;
    position: string;
    team: string;
    adp?: number;
}

interface TeamComposition {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    K: number;
    DEF: number;
}

interface DraftRecommendation {
    player: {
        name: string;
        team: string;
        position: string;
        ppr: number;
        byeWeek: number;
        tier: number;
    };
    value: number;
    reasoning: string[];
    tier: number;
    scarcity: 'high' | 'medium' | 'low';
}

interface DraftData {
    recommendations: DraftRecommendation[];
    teamComposition: TeamComposition;
    scarcityData: Record<string, { available: number; scarcity: 'high' | 'medium' | 'low' }>;
    analysis: {
        totalValue: number;
        bestPicks: any[];
        reaches: any[];
        grade: string;
    };
    nextPick: number;
    totalPicks: number;
    availablePlayers: number;
}

export default function DraftAssistant() {
    const [leagueSize, setLeagueSize] = useState(12);
    const [picks, setPicks] = useState<DraftPick[]>([]);
    const [userTeamPicks, setUserTeamPicks] = useState<number[]>([]);
    const [nextPick, setNextPick] = useState(1);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DraftData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newPickPlayer, setNewPickPlayer] = useState('');
    const [newPickPosition, setNewPickPosition] = useState('');
    const [newPickTeam, setNewPickTeam] = useState('');
    const [isUserPick, setIsUserPick] = useState(false);

    const fetchRecommendations = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/draft/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueSize,
                    picks,
                    userTeamPicks,
                    nextPick,
                    scoringType: 'ppr'
                })
            });

            const result = await response.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || 'Failed to get recommendations');
            }
        } catch (err) {
            setError('Failed to connect to draft service');
            console.error('Draft error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, [picks, userTeamPicks, nextPick, leagueSize]);

    const addPick = () => {
        if (!newPickPlayer.trim() || !newPickPosition.trim()) return;

        const round = Math.ceil(nextPick / leagueSize);
        const newPick: DraftPick = {
            pick: nextPick,
            round,
            player: newPickPlayer.trim(),
            position: newPickPosition.toUpperCase(),
            team: newPickTeam.trim() || 'FA'
        };

        setPicks([...picks, newPick]);

        if (isUserPick) {
            setUserTeamPicks([...userTeamPicks, nextPick]);
        }

        setNextPick(nextPick + 1);
        setNewPickPlayer('');
        setNewPickPosition('');
        setNewPickTeam('');
        setIsUserPick(false);
    };

    const undoLastPick = () => {
        if (picks.length === 0) return;

        const lastPick = picks[picks.length - 1];
        setPicks(picks.slice(0, -1));

        if (userTeamPicks.includes(lastPick.pick)) {
            setUserTeamPicks(userTeamPicks.filter(p => p !== lastPick.pick));
        }

        setNextPick(lastPick.pick);
    };

    const getScarcityColor = (scarcity: string) => {
        switch (scarcity) {
            case 'high': return 'text-red-400';
            case 'medium': return 'text-yellow-400';
            default: return 'text-green-400';
        }
    };

    const getTierColor = (tier: number) => {
        switch (tier) {
            case 1: return 'bg-purple-900 text-purple-200';
            case 2: return 'bg-blue-900 text-blue-200';
            case 3: return 'bg-green-900 text-green-200';
            case 4: return 'bg-yellow-900 text-yellow-200';
            default: return 'bg-gray-900 text-gray-200';
        }
    };

    const currentRound = Math.ceil(nextPick / leagueSize);
    const pickInRound = ((nextPick - 1) % leagueSize) + 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-6">
                <Target size={24} />
                <h2
                    className="text-2xl font-normal"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    [draft assistant]
                </h2>
            </div>

            {/* Draft Settings */}
            <div className="bg-black border border-white/20 rounded-none p-4">
                <h3
                    className="text-lg font-normal mb-4"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    [draft settings]
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label
                            className="block text-sm mb-2"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            league size
                        </label>
                        <select
                            value={leagueSize}
                            onChange={(e) => setLeagueSize(parseInt(e.target.value))}
                            className="w-full bg-black border border-white text-white px-3 py-2"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            <option value={8}>8 teams</option>
                            <option value={10}>10 teams</option>
                            <option value={12}>12 teams</option>
                            <option value={14}>14 teams</option>
                            <option value={16}>16 teams</option>
                        </select>
                    </div>
                    <div>
                        <div
                            className="text-sm text-gray-400"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            current pick
                        </div>
                        <div
                            className="text-2xl font-bold text-white"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            {nextPick} (R{currentRound}.{pickInRound})
                        </div>
                    </div>
                    <div>
                        <div
                            className="text-sm text-gray-400"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            picks made
                        </div>
                        <div
                            className="text-2xl font-bold text-white"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            {picks.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Pick */}
            <div className="bg-black border border-white/20 rounded-none p-4">
                <h3
                    className="text-lg font-normal mb-4"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    [record pick #{nextPick}]
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Player name"
                            value={newPickPlayer}
                            onChange={(e) => setNewPickPlayer(e.target.value)}
                            className="w-full bg-black border border-white text-white px-3 py-2 placeholder-gray-500"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        />
                    </div>
                    <div>
                        <select
                            value={newPickPosition}
                            onChange={(e) => setNewPickPosition(e.target.value)}
                            className="w-full bg-black border border-white text-white px-3 py-2"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            <option value="">Position</option>
                            <option value="QB">QB</option>
                            <option value="RB">RB</option>
                            <option value="WR">WR</option>
                            <option value="TE">TE</option>
                            <option value="K">K</option>
                            <option value="DEF">DEF</option>
                        </select>
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Team (optional)"
                            value={newPickTeam}
                            onChange={(e) => setNewPickTeam(e.target.value)}
                            className="w-full bg-black border border-white text-white px-3 py-2 placeholder-gray-500"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="userPick"
                            checked={isUserPick}
                            onChange={(e) => setIsUserPick(e.target.checked)}
                            className="rounded-none"
                        />
                        <label
                            htmlFor="userPick"
                            className="text-sm"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            your pick
                        </label>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={addPick}
                        disabled={!newPickPlayer.trim() || !newPickPosition.trim()}
                        className="px-4 py-2 bg-black border border-white text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        <Plus size={16} className="mr-2" />
                        add pick
                    </button>
                    <button
                        onClick={undoLastPick}
                        disabled={picks.length === 0}
                        className="px-4 py-2 bg-black border border-white text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        undo last
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
                    {/* Team Overview */}
                    {userTeamPicks.length > 0 && (
                        <div className="bg-black border border-white/20 rounded-none p-4">
                            <h3
                                className="text-lg font-normal mb-4"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [your team] - grade: {data.analysis.grade}
                            </h3>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                                {Object.entries(data.teamComposition).map(([pos, count]) => (
                                    <div key={pos} className="text-center">
                                        <div
                                            className="text-sm text-gray-400"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            {pos}
                                        </div>
                                        <div
                                            className="text-2xl font-bold text-white"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            {count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {data.analysis.bestPicks.length > 0 && (
                                <div className="text-sm">
                                    <span className="text-green-400">Value picks: </span>
                                    <span className="text-white">
                                        {data.analysis.bestPicks.map(p => p.player).join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Positional Scarcity */}
                    <div className="bg-black border border-white/20 rounded-none p-4">
                        <h3
                            className="text-lg font-normal mb-4"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            [positional scarcity]
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(data.scarcityData).map(([pos, info]) => (
                                <div key={pos} className="text-center">
                                    <div
                                        className="text-sm text-gray-400"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {pos}
                                    </div>
                                    <div
                                        className={`text-lg font-bold ${getScarcityColor(info.scarcity)}`}
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {info.scarcity}
                                    </div>
                                    <div
                                        className="text-xs text-gray-500"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {info.available} left
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div className="bg-black border border-white/20 rounded-none">
                        <div className="p-4 border-b border-white/20">
                            <h3
                                className="text-lg font-normal"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [pick recommendations] ({data.recommendations.length} shown)
                            </h3>
                        </div>

                        {loading ? (
                            <div className="p-6 text-center">
                                <Clock className="animate-spin mx-auto mb-2" size={20} />
                                <div
                                    className="text-gray-400"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    analyzing draft...
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {data.recommendations.slice(0, 10).map((rec, index) => (
                                    <div key={rec.player.name} className="p-4 hover:bg-gray-900 transition-colors">
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
                                                            {rec.player.name}
                                                        </div>
                                                        <div
                                                            className="text-sm text-gray-400"
                                                            style={{ fontFamily: 'Consolas, monospace' }}
                                                        >
                                                            {rec.player.position} - {rec.player.team} • ADP {rec.player.ppr.toFixed(1)} • Bye {rec.player.byeWeek}
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 text-xs rounded-none ${getTierColor(rec.tier)}`}>
                                                        Tier {rec.tier}
                                                    </span>
                                                </div>

                                                <div className="space-y-1">
                                                    {rec.reasoning.map((reason, reasonIndex) => (
                                                        <div
                                                            key={reasonIndex}
                                                            className="text-sm text-gray-300 flex items-center"
                                                            style={{ fontFamily: 'Consolas, monospace' }}
                                                        >
                                                            <CheckCircle size={12} className="mr-2 text-green-400" />
                                                            {reason}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div
                                                    className="text-2xl font-bold text-white"
                                                    style={{ fontFamily: 'Consolas, monospace' }}
                                                >
                                                    {rec.value}
                                                </div>
                                                <div
                                                    className="text-xs text-gray-500"
                                                    style={{ fontFamily: 'Consolas, monospace' }}
                                                >
                                                    value score
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Picks */}
                    {picks.length > 0 && (
                        <div className="bg-black border border-white/20 rounded-none">
                            <div className="p-4 border-b border-white/20">
                                <h3
                                    className="text-lg font-normal"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [recent picks]
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="space-y-2">
                                    {picks.slice(-5).reverse().map((pick) => (
                                        <div key={pick.pick} className="flex justify-between items-center text-sm">
                                            <span
                                                className="text-gray-400"
                                                style={{ fontFamily: 'Consolas, monospace' }}
                                            >
                                                {pick.pick}. {pick.player} ({pick.position})
                                            </span>
                                            {userTeamPicks.includes(pick.pick) && (
                                                <span className="text-green-400 text-xs">YOUR PICK</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
