'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, X, Loader2, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';

interface Player {
    sleeper_id: string;
    name: string;
    position: string;
    team: string;
}

interface PlayerField {
    id: string;
    value: string;
    selectedPlayer: Player | null;
    showDropdown: boolean;
    suggestions: Player[];
}

interface PlayerRanking {
    playerId: string;
    playerName: string;
    score: number;
    rank: number;
    reasoning: string[];
}

interface DefensiveStats {
    teamAbbr: string;
    teamName: string;
    pointsAllowed: number;
    totalYardsAllowed: number;
    yardsPerPlayAllowed: number;
    passYardsAllowed: number;
    passTDsAllowed: number;
    netYardsPerAttemptAllowed: number;
    rushYardsAllowed: number;
    rushTDsAllowed: number;
    yardsPerRushAllowed: number;
    scorePct: number;
    turnoverPct: number;
    exp: number;
}

interface DefensiveMatchupDetail {
    player: string;
    team: string;
    opponent?: string;
    defenseRank?: number;
    home?: boolean;
    matchupScore?: number;
    defenseStats?: DefensiveStats;
}

interface ComparisonResult {
    players: any[];
    headToHead: any;
    rankings: {
        byCategory: Record<string, PlayerRanking[]>;
    };
    recommendation: {
        startPlayer: string;
        confidence: number;
        reasoning: string[];
        aiAnalysis: string;
    };
    defensiveMatchupDetails?: DefensiveMatchupDetail[];
}

export default function WhoDoIStartPage() {
    const [playerFields, setPlayerFields] = useState<PlayerField[]>([
        { id: '1', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] },
        { id: '2', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] }
    ]);
    const [showThirdPlayer, setShowThirdPlayer] = useState(false);
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
    const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Debounced search function
    const searchPlayers = async (query: string, fieldId: string) => {
        if (query.length < 2) {
            setPlayerFields(prev => prev.map(field =>
                field.id === fieldId
                    ? { ...field, suggestions: [], showDropdown: false }
                    : field
            ));
            return;
        }

        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                setPlayerFields(prev => prev.map(field =>
                    field.id === fieldId
                        ? { ...field, suggestions: data.players || [], showDropdown: true }
                        : field
                ));
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    const handleInputChange = (fieldId: string, value: string) => {
        setPlayerFields(prev => prev.map(field =>
            field.id === fieldId
                ? { ...field, value, selectedPlayer: null }
                : field
        ));

        // Debounced search
        const timeoutId = setTimeout(() => {
            searchPlayers(value, fieldId);
        }, 300);

        return () => clearTimeout(timeoutId);
    };

    const handleSelectPlayer = (fieldId: string, player: Player) => {
        setPlayerFields(prev => prev.map(field =>
            field.id === fieldId
                ? {
                    ...field,
                    value: player.name,
                    selectedPlayer: player,
                    showDropdown: false,
                    suggestions: []
                }
                : field
        ));
    };

    const addThirdPlayer = () => {
        setShowThirdPlayer(true);
        setPlayerFields(prev => [
            ...prev,
            { id: '3', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] }
        ]);
    };

    const removeThirdPlayer = () => {
        setShowThirdPlayer(false);
        setPlayerFields(prev => prev.filter(field => field.id !== '3'));
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            Object.entries(dropdownRefs.current).forEach(([fieldId, ref]) => {
                if (ref && !ref.contains(event.target as Node)) {
                    setPlayerFields(prev => prev.map(field =>
                        field.id === fieldId
                            ? { ...field, showDropdown: false }
                            : field
                    ));
                }
            });
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCompare = async () => {
        const selectedPlayers = playerFields
            .filter(field => field.selectedPlayer)
            .map(field => field.selectedPlayer!);

        if (selectedPlayers.length < 2) {
            setError('Please select at least 2 players to compare.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setComparisonResult(null);

        try {
            const queryParams = new URLSearchParams({
                player1: selectedPlayers[0]!.sleeper_id,
                player2: selectedPlayers[1]!.sleeper_id,
                week: '1' // Default to Week 1
            });

            if (selectedPlayers[2]) {
                queryParams.append('player3', selectedPlayers[2].sleeper_id);
            }

            const response = await fetch(`/api/player-comparison?${queryParams}`);

            if (!response.ok) {
                throw new Error('Failed to compare players');
            }

            const result = await response.json();
            setComparisonResult(result);
        } catch (error) {
            console.error('Comparison failed:', error);
            setError('Failed to compare players. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderPlayerInput = (field: PlayerField, index: number) => {
        return (
            <div key={field.id} className="relative">
                <label
                    htmlFor={`player${field.id}`}
                    className="block text-sm font-medium text-white mb-2"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    [player {field.id}]
                </label>
                <div
                    className="relative"
                    ref={(el: HTMLDivElement | null) => {
                        dropdownRefs.current[field.id] = el;
                    }}
                >
                    <input
                        type="text"
                        id={`player${field.id}`}
                        value={field.value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={index === 0 ? "e.g., Justin Jefferson" : index === 1 ? "e.g., CeeDee Lamb" : "e.g., A.J. Brown"}
                        className="w-full bg-black border border-white rounded-none p-3 focus:ring-1 focus:ring-white focus:outline-none text-white placeholder-gray-500"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    />

                    {field.showDropdown && field.suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-black border border-white shadow-lg max-h-60 overflow-y-auto">
                            {field.suggestions.map((player) => (
                                <div
                                    key={player.sleeper_id}
                                    onClick={() => handleSelectPlayer(field.id, player)}
                                    className="p-3 hover:bg-gray-900 cursor-pointer text-white border-b border-gray-800 last:border-b-0"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <div className="font-medium">{player.name}</div>
                                    <div className="text-sm text-gray-400">{player.position} - {player.team}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderComparisonResults = () => {
        if (!comparisonResult) return null;

        const { rankings, recommendation, defensiveMatchupDetails } = comparisonResult;

        return (
            <div className="mt-8 space-y-6">
                {/* Recommendation Card */}
                <div className="bg-black border border-white rounded-none p-6">
                    <div className="flex items-center mb-4">
                        <div className="bg-white border border-white rounded-none p-2 mr-3">
                            <TrendingUp size={20} className="text-black" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                [recommendation]
                            </h3>
                            <p className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                start {recommendation.startPlayer}
                            </p>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                {recommendation.confidence}%
                            </div>
                            <div className="text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                start score
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-black border border-white/20 rounded-none p-4 mb-4">
                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                            [ai analysis]
                        </h4>
                        <p className="text-white leading-relaxed" style={{ fontFamily: 'Consolas, monospace' }}>
                            {recommendation.aiAnalysis}
                        </p>
                    </div>

                    {/* Key Reasoning */}
                    <div>
                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                            [key factors]
                        </h4>
                        <ul className="space-y-1">
                            {recommendation.reasoning.map((reason, index) => (
                                <li key={index} className="text-sm text-gray-300 flex items-center" style={{ fontFamily: 'Consolas, monospace' }}>
                                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-2"></span>
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Defensive Matchup */}
                <div className="bg-black border border-white rounded-none p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                        <Shield size={20} className="mr-2" />
                        [defensive matchup]
                    </h3>
                    {(() => {
                        const posLookup: Record<string, string> = Object.fromEntries(
                            (comparisonResult.players || []).map(p => [p.name, p.position])
                        );
                        const positions = (defensiveMatchupDetails || []).map(d => posLookup[d.player] || 'WR');
                        const unique = Array.from(new Set(positions));
                        const isQB = unique.length === 1 && unique[0] === 'QB';
                        const isRB = unique.length === 1 && unique[0] === 'RB';

                        const details = defensiveMatchupDetails || [];
                        const headerCell = 'px-3 py-2 border border-gray-700 text-xs uppercase tracking-wide text-gray-400';
                        const cell = 'px-3 py-2 border border-gray-700 text-sm text-white';

                        const renderPassTable = () => (
                            <div className="overflow-x-auto mb-2">
                                <table className="w-full border-collapse text-left" style={{ fontFamily: 'Consolas, monospace' }}>
                                    <thead>
                                        <tr>
                                            <th className={headerCell}>player</th>
                                            <th className={headerCell}>opponent</th>
                                            <th className={headerCell}>completions allowed</th>
                                            <th className={headerCell}>pts allowed</th>
                                            <th className={headerCell}>pass yds allowed</th>
                                            <th className={headerCell}>pass td allowed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.map((d) => {
                                            const stats: any = d.defenseStats || {};
                                            const rowKey = `${d.player}-${d.opponent}-pass`;
                                            const cmp = stats.passCompletionsAllowed;
                                            const pts = stats.pointsAllowed;
                                            const pyd = stats.passYardsAllowed;
                                            const ptd = stats.passTDsAllowed;
                                            return (
                                                <tr key={rowKey}>
                                                    <td className={cell}>{d.player}</td>
                                                    <td className={cell}>rank {d.defenseRank ?? '—'} • {d.opponent} {d.home ? '(home)' : '(away)'}</td>
                                                    <td className={cell}>{typeof cmp === 'number' ? cmp.toFixed(1) : '—'}</td>
                                                    <td className={cell}>{typeof pts === 'number' ? pts.toFixed(1) : '—'}</td>
                                                    <td className={cell}>{typeof pyd === 'number' ? pyd.toFixed(0) : '—'}</td>
                                                    <td className={cell}>{typeof ptd === 'number' ? ptd.toFixed(2) : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="text-right text-xs text-gray-500 mt-1" style={{ fontFamily: 'Consolas, monospace' }}>per game averages</div>
                            </div>
                        );

                        const renderRushTable = () => (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left" style={{ fontFamily: 'Consolas, monospace' }}>
                                    <thead>
                                        <tr>
                                            <th className={headerCell}>player</th>
                                            <th className={headerCell}>opponent</th>
                                            <th className={headerCell}>rush att allowed</th>
                                            <th className={headerCell}>rush yds allowed</th>
                                            <th className={headerCell}>rush tds allowed</th>
                                            <th className={headerCell}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.map((d) => {
                                            const stats: any = d.defenseStats || {};
                                            const rowKey = `${d.player}-${d.opponent}-rush`;
                                            const ratt = stats.rushAttemptsFaced;
                                            const ryds = stats.rushYardsAllowed;
                                            const rtd = stats.rushTDsAllowed;
                                            return (
                                                <tr key={rowKey}>
                                                    <td className={cell}>{d.player}</td>
                                                    <td className={cell}>rank {d.defenseRank ?? '—'} • {d.opponent} {d.home ? '(home)' : '(away)'}</td>
                                                    <td className={cell}>{typeof ratt === 'number' ? ratt.toFixed(1) : '—'}</td>
                                                    <td className={cell}>{typeof ryds === 'number' ? ryds.toFixed(0) : '—'}</td>
                                                    <td className={cell}>{typeof rtd === 'number' ? rtd.toFixed(2) : '—'}</td>
                                                    <td className={cell}></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );

                        if (isQB) {
                            return (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>[passing stats]</h4>
                                        {renderPassTable()}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>[rushing stats]</h4>
                                        {renderRushTable()}
                                    </div>
                                </div>
                            );
                        }

                        if (isRB) {
                            return renderRushTable();
                        }

                        return renderPassTable();
                    })()}
                </div>

                {/* Category Breakdown */}
                <div className="bg-black border border-white rounded-none p-6">
                    <h3 className="text-xl font-bold mb-4 text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                        [category breakdown]
                    </h3>
                    {(() => {
                        const headerCell = 'px-3 py-2 border border-gray-700 text-xs uppercase tracking-wide text-gray-400';
                        const cell = 'px-3 py-2 border border-gray-700 text-sm text-white';

                        const players = (comparisonResult.players || []) as Array<{
                            name: string;
                            position: string;
                            scores: { defensiveMatchup: number };
                            redZoneTDs?: number | null;
                            weeklyOpponent?: any;
                            derived?: { redZoneEff?: string; positionRank?: string };
                        }>;

                        const grade = (score: number) => {
                            if (score >= 95) return 'A+';
                            if (score >= 90) return 'A';
                            if (score >= 80) return 'B';
                            if (score >= 60) return 'C';
                            if (score >= 20) return 'D';
                            return 'F';
                        };

                        const renderTable = (title: string, rows: Array<{ name: string; value: string }>) => (
                            <div className="overflow-x-auto mb-4 w-full">
                                <table className="w-full border-collapse text-left" style={{ fontFamily: 'Consolas, monospace' }}>
                                    <thead>
                                        <tr>
                                            <th className={headerCell}>{title}</th>
                                            <th className={headerCell}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={`${title}-${r.name}`}>
                                                <td className={cell}>{r.name}</td>
                                                <td className={cell}>{r.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );

                        const rzRows = players.map(p => ({
                            name: p.name,
                            value: p.derived?.redZoneEff ?? '—'
                        }));

                        const posRows = players.map(p => ({
                            name: p.name,
                            value: p.derived?.positionRank ?? '—'
                        }));

                        const defRows = players.map(p => ({
                            name: p.name,
                            value: grade(p.scores.defensiveMatchup)
                        }));

                        const projected = new Map<string, number>();
                        players.forEach(p => {
                            projected.set(p.name, projected.get(p.name) ?? (players.indexOf(p) === 0 ? 17 : 13));
                        });
                        const projRows = players.map(p => ({ name: p.name, value: String(projected.get(p.name) ?? 12) }));

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                                {renderTable('[red zone efficiency]', rzRows)}
                                {renderTable('[positional ranking]', posRows)}
                                {renderTable('[defensive matchup]', defRows)}
                                {renderTable('[projected points (ppr)]', projRows)}
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
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

                <header className="mb-8 border-b border-white/20 pb-4">
                    <h1 className="text-3xl sm:text-5xl font-bold mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                        [who do i start]
                    </h1>
                    <p className="text-lg text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                        select 2-3 players to get an ai-powered start/sit recommendation
                    </p>
                </header>

                <div className="bg-black border border-white rounded-none shadow-lg p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {playerFields.map((field, index) => renderPlayerInput(field, index))}

                        {/* Add Third Player Button or Remove Button */}
                        {!showThirdPlayer ? (
                            <div className="flex items-end">
                                <button
                                    onClick={addThirdPlayer}
                                    className="bg-black border border-white hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-none flex items-center transition-colors"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <Plus size={16} className="mr-2" />
                                    [add player]
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-end">
                                <button
                                    onClick={removeThirdPlayer}
                                    className="bg-black border border-red-500 hover:bg-red-900 text-white font-bold py-2 px-4 rounded-none flex items-center transition-colors"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <X size={16} className="mr-2" />
                                    [remove player]
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-600/20 border border-red-600 rounded-none text-red-300">
                            <span style={{ fontFamily: 'Consolas, monospace' }}>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-center">
                        <button
                            onClick={handleCompare}
                            disabled={isLoading}
                            className="bg-black border border-white hover:bg-gray-900 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-none flex items-center transition-colors text-lg"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    [analyzing players...]
                                </>
                            ) : (
                                '[compare players]'
                            )}
                        </button>
                    </div>
                </div>

                {/* Comparison Results */}
                {renderComparisonResults()}
            </div>
        </div>
    );
}
