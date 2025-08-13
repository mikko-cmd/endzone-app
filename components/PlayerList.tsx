'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';

interface Player {
    sleeper_id?: string;
    name: string;
    position: string;
    team: string;
    adp?: number;
    pprRank?: number;
    byeWeek?: number;
}

interface PlayerListProps {
    onSelectPlayer: (player: Player) => void;
    excludePlayerNames?: string[];
}

export default function PlayerList({ onSelectPlayer, excludePlayerNames = [] }: PlayerListProps) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPosition, setSelectedPosition] = useState<string>('ALL');

    // Load all ADP players on mount
    useEffect(() => {
        const loadADPPlayers = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/draft/players-adp?limit=400');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setAllPlayers(data.data || []);
                        setPlayers(data.data || []);
                    }
                }
            } catch (error: any) {
                console.error('Failed to load ADP players:', error);
            } finally {
                setLoading(false);
            }
        };

        loadADPPlayers();
    }, []);

    // Search players as user types
    useEffect(() => {
        if (searchQuery.length >= 2) {
            const searchLower = searchQuery.toLowerCase();
            const searchResults = allPlayers.filter(player =>
                player.name.toLowerCase().includes(searchLower) ||
                player.team.toLowerCase().includes(searchLower)
            );
            setPlayers(searchResults);
        } else {
            setPlayers(allPlayers);
        }
    }, [searchQuery, allPlayers]);

    // Enhanced filtering to handle name variations
    useEffect(() => {
        let filtered = players.filter(player => {
            // Check exact name match first
            if (excludePlayerNames.includes(player.name)) {
                return false;
            }

            // Check for partial matches to handle name variations
            // e.g., "Kenneth Walker III" vs "Kenneth Walker"
            const playerNameLower = player.name.toLowerCase();
            const isExcluded = excludePlayerNames.some(excludedName => {
                const excludedNameLower = excludedName.toLowerCase();

                // Check if names match when removing suffixes (Jr, Sr, III, etc.)
                const cleanPlayerName = playerNameLower.replace(/\s+(jr|sr|iii|ii|iv|v)\.?\s*$/i, '').trim();
                const cleanExcludedName = excludedNameLower.replace(/\s+(jr|sr|iii|ii|iv|v)\.?\s*$/i, '').trim();

                return cleanPlayerName === cleanExcludedName ||
                    playerNameLower.includes(excludedNameLower) ||
                    excludedNameLower.includes(playerNameLower);
            });

            return !isExcluded;
        });

        if (selectedPosition !== 'ALL') {
            filtered = filtered.filter(player => player.position === selectedPosition);
        }

        setFilteredPlayers(filtered);
    }, [players, selectedPosition, excludePlayerNames]);

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    const getTierColor = (adp: number) => {
        if (adp <= 12) return 'text-purple-400'; // Tier 1
        if (adp <= 36) return 'text-blue-400';   // Tier 2  
        if (adp <= 72) return 'text-green-400';  // Tier 3
        if (adp <= 120) return 'text-yellow-400'; // Tier 4
        return 'text-gray-400'; // Tier 5+
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/20">
                <h3 className="font-mono text-lg text-white mb-4">[player selection]</h3>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search players..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-white/20 text-white pl-10 pr-3 py-2 font-mono text-sm"
                    />
                </div>

                {/* Position Filter */}
                <div className="flex gap-1 overflow-x-auto">
                    {positions.map(pos => (
                        <button
                            key={pos}
                            onClick={() => setSelectedPosition(pos)}
                            className={`px-3 py-1 font-mono text-xs border border-white/20 whitespace-nowrap ${selectedPosition === pos
                                ? 'bg-white text-black'
                                : 'bg-black text-white hover:bg-gray-900'
                                }`}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-4 text-center text-gray-400 font-mono text-sm">
                        Loading players...
                    </div>
                ) : (
                    <div className="divide-y divide-white/10">
                        {filteredPlayers.map((player, index) => (
                            <div key={`${player.name}-${player.team}`} className="p-3 hover:bg-gray-900 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {/* ADP Rank */}
                                            <span className={`font-mono text-xs w-8 text-right ${getTierColor(player.adp || 999)}`}>
                                                {player.pprRank || index + 1}
                                            </span>

                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-sm text-white truncate">
                                                    {player.name}
                                                </div>
                                                <div className="font-mono text-xs text-gray-400">
                                                    {player.position} • {player.team}
                                                    {player.byeWeek && ` • Bye ${player.byeWeek}`}
                                                </div>
                                                {player.adp && (
                                                    <div className="font-mono text-xs text-gray-500">
                                                        ADP {player.adp.toFixed(1)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onSelectPlayer(player)}
                                        className="ml-3 p-1 bg-green-600 hover:bg-green-700 border border-green-500 transition-colors"
                                        title="Draft this player"
                                    >
                                        <Plus size={14} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredPlayers.length === 0 && !loading && (
                            <div className="p-4 text-center text-gray-400 font-mono text-sm">
                                No players found
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-white/20 bg-gray-950">
                <div className="font-mono text-xs text-gray-400 text-center">
                    Showing {filteredPlayers.length} players
                    {selectedPosition !== 'ALL' && ` (${selectedPosition})`}
                </div>
            </div>
        </div>
    );
}
