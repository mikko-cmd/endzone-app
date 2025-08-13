'use client';

import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import Link from 'next/link';
import PlayerCardModal from '@/components/PlayerCardModal';

interface Player {
    name: string;
    position: string;
    team: string;
    sleeper_id: string;
}

export default function PlayerSearchPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    // Load all players on mount
    useEffect(() => {
        const loadAllPlayers = async () => {
            setLoading(true);
            try {
                // Try different approaches to get all players
                console.log('🔍 Attempting to load all players...');

                // First, try with a common search term to get a good sample
                const response = await fetch('/api/players/search?q=a');
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Players API response:', data);
                    console.log('✅ Sample player:', data.players?.[0]);

                    if (data.players && data.players.length > 0) {
                        setAllPlayers(data.players);
                        setPlayers(data.players);
                    } else {
                        console.warn('⚠️ No players returned from search API');
                        // Fallback to ADP API but we'll need to handle the missing sleeper_id
                        const adpResponse = await fetch('/api/draft/players-adp?limit=300');
                        if (adpResponse.ok) {
                            const adpData = await adpResponse.json();
                            console.log('📊 Fallback to ADP data:', adpData.data?.[0]);
                            setAllPlayers(adpData.data || []);
                            setPlayers(adpData.data || []);
                        }
                    }
                } else {
                    console.error('❌ Players search API failed:', response.status);
                }
            } catch (error: any) {
                console.error('❌ Failed to load players:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAllPlayers();
    }, []);

    // Enhanced search with real-time API calls
    useEffect(() => {
        const searchPlayers = async () => {
            if (searchQuery.length >= 2) {
                try {
                    const response = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`);
                    if (response.ok) {
                        const data = await response.json();
                        setPlayers(data.players || []);
                    }
                } catch (error: any) {
                    console.error('Search failed:', error);
                }
            } else {
                // Apply position filter to all players
                let filtered = allPlayers;
                if (selectedPosition !== 'ALL') {
                    filtered = filtered.filter(player => player.position === selectedPosition);
                }
                setPlayers(filtered);
            }
        };

        const timeoutId = setTimeout(searchPlayers, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedPosition, allPlayers]);

    const getPositionColor = (position: string) => {
        switch (position) {
            case 'QB': return 'text-red-400';
            case 'RB': return 'text-green-400';
            case 'WR': return 'text-blue-400';
            case 'TE': return 'text-yellow-400';
            case 'K': return 'text-purple-400';
            case 'DEF': return 'text-gray-400';
            default: return 'text-white';
        }
    };

    const handlePlayerClick = (player: Player) => {
        console.log('🎯 Player clicked:', player);

        if (player.sleeper_id) {
            console.log('✅ Found sleeper_id:', player.sleeper_id);
            setSelectedPlayerId(player.sleeper_id);
        } else {
            console.warn('❌ No sleeper_id found. Player object:', player);
            // If no sleeper_id, try to search for the player by name to get the ID
            searchForPlayerId(player.name);
        }
    };

    const searchForPlayerId = async (playerName: string) => {
        try {
            console.log('🔍 Searching for player ID for:', playerName);
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(playerName)}`);
            if (response.ok) {
                const data = await response.json();
                const foundPlayer = data.players?.find((p: Player) =>
                    p.name.toLowerCase() === playerName.toLowerCase()
                );
                if (foundPlayer?.sleeper_id) {
                    console.log('✅ Found sleeper_id via search:', foundPlayer.sleeper_id);
                    setSelectedPlayerId(foundPlayer.sleeper_id);
                } else {
                    console.warn('❌ Could not find sleeper_id for:', playerName);
                    alert(`Sorry, player card not available for ${playerName}`);
                }
            }
        } catch (error: any) {
            console.error('❌ Search for player ID failed:', error);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="w-full max-w-6xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <Link
                        href="/research/players"
                        className="inline-block text-white hover:text-gray-300 mb-4 transition-colors"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        ← [back to player research]
                    </Link>

                    <h1
                        className="text-3xl sm:text-4xl font-normal mb-4"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [player search]
                    </h1>
                    <p
                        className="text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        Search and explore detailed player information
                    </p>
                </header>

                {/* Search and Filters */}
                <div className="bg-black border border-white/20 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search players (type at least 2 characters)..."
                                className="w-full pl-10 pr-4 py-3 bg-black border border-white text-white placeholder-gray-400 focus:ring-1 focus:ring-white focus:border-white"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            />
                        </div>

                        {/* Position Filter */}
                        <div className="relative">
                            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <select
                                value={selectedPosition}
                                onChange={(e) => setSelectedPosition(e.target.value)}
                                className="pl-10 pr-8 py-3 bg-black border border-white text-white focus:ring-1 focus:ring-white focus:border-white"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                {positions.map(position => (
                                    <option key={position} value={position}>
                                        {position === 'ALL' ? 'All Positions' : position}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Results Summary */}
                    <div className="mt-4 text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                        {loading ? 'Loading players...' : `Showing ${players.length} players`}
                        {searchQuery && ` matching "${searchQuery}"`}
                        {selectedPosition !== 'ALL' && ` at ${selectedPosition}`}
                    </div>
                </div>

                {/* Player List */}
                <div className="bg-black border border-white/20">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/20 text-sm font-semibold text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-3">Position</div>
                        <div className="col-span-3">Team</div>
                    </div>

                    {/* Player Rows */}
                    <div className="max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                Loading players...
                            </div>
                        ) : players.length === 0 ? (
                            <div className="p-8 text-center text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                {searchQuery.length < 2 ?
                                    'Type at least 2 characters to search for players' :
                                    'No players found matching your criteria'
                                }
                            </div>
                        ) : (
                            players.slice(0, 100).map((player, index) => (
                                <div
                                    key={player.sleeper_id || player.name}
                                    onClick={() => handlePlayerClick(player)}
                                    className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-900 border-b border-white/10 cursor-pointer transition-colors"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    <div className="col-span-1">
                                        <span className="text-sm text-gray-400">
                                            {index + 1}
                                        </span>
                                    </div>

                                    <div className="col-span-5">
                                        <div className="font-medium text-white hover:text-gray-300 transition-colors">
                                            {player.name}
                                            {!player.sleeper_id && (
                                                <span className="text-xs text-yellow-400 ml-2">*</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-3">
                                        <span className={`font-medium ${getPositionColor(player.position)}`}>
                                            {player.position}
                                        </span>
                                    </div>

                                    <div className="col-span-3 text-gray-300">
                                        {player.team}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 p-4 bg-black border border-white/20">
                    <p className="text-sm text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                        💡 Click on any player name to view their detailed player card
                    </p>
                    <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'Consolas, monospace' }}>
                        * Players marked with * may require an additional search to load their card
                    </p>
                </div>
            </div>

            {/* Player Card Modal */}
            {selectedPlayerId && (
                <PlayerCardModal
                    playerId={selectedPlayerId}
                    onClose={() => setSelectedPlayerId(null)}
                />
            )}
        </div>
    );
}
