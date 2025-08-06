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

interface ComparisonResult {
    players: any[];
    headToHead: any;
    rankings: {
        overall: PlayerRanking[];
        byCategory: {
            matchup: PlayerRanking[];
            form: PlayerRanking[];
            weather: PlayerRanking[];
            ceiling: PlayerRanking[];
            floor: PlayerRanking[];
        };
    };
    recommendation: {
        startPlayer: string;
        confidence: number;
        reasoning: string[];
        aiAnalysis: string;
    };
}

export default function PlayerComparisonPage({ params }: { params: { leagueId: string } }) {
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
                    Player {field.id}
                </label>
                <div className="relative" ref={el => dropdownRefs.current[field.id] = el}>
                    <input
                        type="text"
                        id={`player${field.id}`}
                        value={field.value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={index === 0 ? "e.g., Justin Jefferson" : index === 1 ? "e.g., CeeDee Lamb" : "e.g., A.J. Brown"}
                        className="w-full bg-black border border-white rounded-lg p-2 focus:ring-2 focus:ring-white focus:outline-none text-white placeholder-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    />

                    {field.showDropdown && field.suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-black border border-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {field.suggestions.map((player) => (
                                <div
                                    key={player.sleeper_id}
                                    onClick={() => handleSelectPlayer(field.id, player)}
                                    className="p-2 hover:bg-gray-900 cursor-pointer text-white border-b border-gray-800 last:border-b-0"
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

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'matchup': return <Shield size={16} className="text-white" />;
            case 'form': return <TrendingUp size={16} className="text-white" />;
            case 'ceiling': return <Zap size={16} className="text-white" />;
            case 'floor': return <BarChart3 size={16} className="text-white" />;
            default: return null;
        }
    };

    const renderComparisonResults = () => {
        if (!comparisonResult) return null;

        const { rankings, recommendation } = comparisonResult;

        return (
            <div className="mt-8 space-y-6">
                {/* Recommendation Card */}
                <div className="bg-black border border-white rounded-xl p-6">
                    <div className="flex items-center mb-4">
                        <div className="bg-white rounded-full p-2 mr-3">
                            <TrendingUp size={20} className="text-black" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                Recommendation
                            </h3>
                            <p className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                Start {recommendation.startPlayer}
                            </p>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                {recommendation.confidence}%
                            </div>
                            <div className="text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                Confidence
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                            AI Analysis
                        </h4>
                        <p className="text-white leading-relaxed" style={{ fontFamily: 'Consolas, monospace' }}>
                            {recommendation.aiAnalysis}
                        </p>
                    </div>

                    {/* Key Reasoning */}
                    <div>
                        <h4 className="font-semibold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                            Key Factors
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

                {/* Overall Rankings */}
                <div className="bg-black border border-white rounded-xl p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                        <BarChart3 size={20} className="mr-2" />
                        Overall Rankings
                    </h3>
                    <div className="space-y-3">
                        {rankings.overall.map((player, index) => (
                            <div key={player.playerId} className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? 'bg-gray-900 border-white' : 'bg-gray-800 border-gray-600'}`}>
                                <div className="flex items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold ${index === 0 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                        {player.rank}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {player.playerName}
                                        </div>
                                        <div className="text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {player.reasoning.slice(0, 2).join(' • ')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                        {player.score.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                        Score
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-black border border-white rounded-xl p-6">
                    <h3 className="text-xl font-bold mb-4 text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                        Category Breakdown
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(rankings.byCategory).map(([category, categoryRankings]) => (
                            <div key={category} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                                <div className="flex items-center mb-3">
                                    {getCategoryIcon(category)}
                                    <h4 className="font-semibold text-white ml-2 capitalize" style={{ fontFamily: 'Consolas, monospace' }}>
                                        {category}
                                    </h4>
                                </div>
                                <div className="space-y-2">
                                    {categoryRankings.map((player, index) => (
                                        <div key={player.playerId} className="flex justify-between items-center">
                                            <span className={`text-sm ${index === 0 ? 'text-white font-semibold' : 'text-gray-400'}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                {index + 1}. {player.playerName}
                                            </span>
                                            <span className="text-xs text-gray-500" style={{ fontFamily: 'Consolas, monospace' }}>
                                                {player.score.toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'Consolas, monospace' }}>
            <div className="container mx-auto px-4 py-8">
                <Link
                    href={`/league/${params.leagueId}`}
                    className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    <ChevronLeft size={20} className="mr-2" />
                    Back to Team Page
                </Link>

                <header className="mb-8 border-b border-white pb-4">
                    <h1 className="text-3xl sm:text-5xl font-bold mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
                        Player Comparison
                    </h1>
                    <p className="text-lg text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                        Select 2-3 players to get an AI-powered start/sit recommendation.
                    </p>
                </header>

                <div className="bg-black border border-white rounded-xl shadow-lg p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {playerFields.map((field, index) => renderPlayerInput(field, index))}

                        {/* Add Third Player Button or Remove Button */}
                        {!showThirdPlayer ? (
                            <div className="flex items-end">
                                <button
                                    onClick={addThirdPlayer}
                                    className="bg-black border border-white hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <Plus size={16} className="mr-2" />
                                    Add Player
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-end">
                                <button
                                    onClick={removeThirdPlayer}
                                    className="bg-red-600 border border-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <X size={16} className="mr-2" />
                                    Remove Player
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-300">
                            <span style={{ fontFamily: 'Consolas, monospace' }}>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-center">
                        <button
                            onClick={handleCompare}
                            disabled={isLoading}
                            className="bg-black border border-white hover:bg-gray-900 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg flex items-center transition-colors text-lg"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    Analyzing Players...
                                </>
                            ) : (
                                'Compare Players'
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