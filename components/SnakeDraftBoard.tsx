'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X, Eye, UserPlus, UserMinus } from 'lucide-react';

interface DraftPick {
    pick: number;
    round: number;
    player?: string;
    position?: string;
    team?: string;
    sleeper_id?: string; // Add this line
}

interface Player {
    sleeper_id?: string;
    name: string;
    position: string;
    team: string;
    adp?: number;
    pprRank?: number;
    byeWeek?: number;
}

interface SnakeDraftBoardProps {
    leagueSize: number;
    rounds: number;
    picks: DraftPick[];
    userTeamPosition?: number | null; // Allow null
    onManualAssign?: (pickNumber: number, player: Player) => void;
    onRemovePlayer?: (pickNumber: number) => void;
    onViewPlayer?: (player: DraftPick) => void;
    onClaimTeam?: (teamNumber: number) => void;
    isDrafting?: boolean; // New prop to track if draft has started
    mode?: 'mock' | 'live'; // Add this line
    teamNames?: Record<number, string>; // Add this line
}

// Utility function for position-based colors
const getPositionColor = (position: string): string => {
    switch (position) {
        case 'QB':
            return 'text-red-400'; // Red for QBs
        case 'RB':
            return 'text-green-400'; // Green for RBs
        case 'WR':
            return 'text-blue-400'; // Blue for WRs
        case 'TE':
            return 'text-yellow-400'; // Yellow for TEs
        case 'K':
            return 'text-purple-400'; // Purple for Kickers
        case 'DST':
            return 'text-orange-400'; // Orange for Defense
        default:
            return 'text-white'; // Default white for unknown positions
    }
};

interface CellAction {
    pickNumber: number;
    round: number;
    teamPosition: number;
    hasPlayer: boolean;
    player?: DraftPick;
    position: { x: number; y: number };
}

// Calculate which pick number corresponds to a specific round and position
function getPickNumber(round: number, position: number, leagueSize: number): number {
    const isOddRound = round % 2 === 1;

    if (isOddRound) {
        // Odd rounds: left to right (1, 2, 3, ...)
        return (round - 1) * leagueSize + position;
    } else {
        // Even rounds: right to left (snake pattern)
        return (round - 1) * leagueSize + (leagueSize - position + 1);
    }
}

export default function SnakeDraftBoard({
    leagueSize,
    rounds,
    picks,
    userTeamPosition,
    onManualAssign,
    onRemovePlayer,
    onViewPlayer,
    onClaimTeam,
    isDrafting = false,
    mode = 'mock',
    teamNames = {} // Add this line
}: SnakeDraftBoardProps) {
    const [hoveredCell, setHoveredCell] = useState<string | null>(null);
    const [activeCell, setActiveCell] = useState<CellAction | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Create a map of pick numbers to pick data for easy lookup
    const pickMap = useMemo(() => {
        const map: Record<number, DraftPick> = {};
        picks.forEach(pick => {
            map[pick.pick] = pick;
        });
        return map;
    }, [picks]);

    // Generate the grid data
    const gridData = useMemo(() => {
        const grid = [];

        for (let round = 1; round <= rounds; round++) {
            const roundData = [];

            for (let teamPos = 1; teamPos <= leagueSize; teamPos++) {
                const pickNumber = getPickNumber(round, teamPos, leagueSize);
                const pick = pickMap[pickNumber];

                roundData.push({
                    round,
                    teamPosition: teamPos,
                    pickNumber,
                    pick: pick || null
                });
            }

            grid.push(roundData);
        }

        return grid;
    }, [leagueSize, rounds, pickMap]);

    const nextPick = useMemo(() => {
        return picks.length + 1;
    }, [picks]);

    // Handle cell click
    const handleCellClick = (
        pickNumber: number,
        round: number,
        teamPosition: number,
        player: DraftPick | null,
        event: React.MouseEvent
    ) => {
        const rect = event.currentTarget.getBoundingClientRect();

        setActiveCell({
            pickNumber,
            round,
            teamPosition,
            hasPlayer: !!player,
            player: player || undefined,
            position: {
                x: rect.left,
                y: rect.bottom + window.scrollY + 8
            }
        });
        setSearchQuery('');
        setSearchResults([]);
    };

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setActiveCell(null);
            }
        };

        if (activeCell) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeCell]);

    // Search for players
    useEffect(() => {
        if (searchQuery.length >= 2) {
            const searchPlayers = async () => {
                setLoadingSearch(true);
                try {
                    const response = await fetch(
                        `/api/draft/players-adp?search=${encodeURIComponent(searchQuery)}&limit=10`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        setSearchResults(data.success ? data.data : []);
                    }
                } catch (error: any) {
                    console.error('Search failed:', error);
                } finally {
                    setLoadingSearch(false);
                }
            };

            const timeoutId = setTimeout(searchPlayers, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleManualAssign = (player: Player) => {
        if (activeCell && onManualAssign) {
            onManualAssign(activeCell.pickNumber, player);
            setActiveCell(null);
        }
    };

    const handleRemovePlayer = () => {
        if (activeCell && onRemovePlayer) {
            onRemovePlayer(activeCell.pickNumber);
            setActiveCell(null);
        }
    };

    const handleViewPlayer = () => {
        if (activeCell?.player && onViewPlayer) {
            onViewPlayer(activeCell.player);
            setActiveCell(null);
        }
    };

    return (
        <div className="w-full relative pb-96">
            {/* Claim Buttons - Hidden when drafting or in live mode */}
            {!isDrafting && mode === 'mock' && (
                <div className="grid mb-1"
                    style={{ gridTemplateColumns: `repeat(${leagueSize}, minmax(120px, 1fr))`, gap: '1px' }}>
                    {Array.from({ length: leagueSize }, (_, i) => {
                        const teamNumber = i + 1;
                        const isUserTeam = userTeamPosition === teamNumber;
                        return (
                            <div key={i} className="flex justify-center">
                                {!isUserTeam && onClaimTeam && (
                                    <button
                                        onClick={() => onClaimTeam(teamNumber)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-mono border border-blue-500"
                                    >
                                        CLAIM
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Team Headers */}
            <div className="grid border-b border-white/20 mb-2"
                style={{ gridTemplateColumns: `repeat(${leagueSize}, minmax(120px, 1fr))`, gap: '1px' }}>
                {Array.from({ length: leagueSize }, (_, i) => {
                    const teamNumber = i + 1;
                    const isUserTeam = userTeamPosition === teamNumber;

                    // Determine team display name based on mode and available data
                    let teamDisplayName: string;

                    if (mode === 'live') {
                        // In live mode: use Sleeper team name if available, otherwise "Team X"
                        if (teamNames[teamNumber]) {
                            teamDisplayName = teamNames[teamNumber];
                        } else {
                            teamDisplayName = `Team ${teamNumber}`;
                        }
                        // Only show "ME" indicator if we know which team is the user's
                        if (isUserTeam && userTeamPosition !== null) {
                            teamDisplayName = `${teamDisplayName} (ME)`;
                        }
                    } else {
                        // In mock mode: use "ME" for user team, "Team X" for others
                        teamDisplayName = isUserTeam ? 'ME' : `Team ${teamNumber}`;
                    }

                    return (
                        <div key={i} className={`p-2 text-center bg-black border ${isUserTeam ? 'border-white' : 'border-white/10'}`}>
                            <span className={`font-mono text-sm ${isUserTeam ? 'text-white font-bold' : 'text-gray-300'}`}>
                                {teamDisplayName}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Draft Grid */}
            <div className="space-y-1 pb-64">
                {gridData.map((roundData, roundIndex) => (
                    <div key={roundIndex}>
                        {/* Round Label */}
                        <div className="flex items-center mb-1">
                            <span className="font-mono text-xs text-gray-500 w-16">R{roundIndex + 1}</span>
                        </div>

                        {/* Round Row */}
                        <div className="grid"
                            style={{ gridTemplateColumns: `repeat(${leagueSize}, minmax(120px, 1fr))`, gap: '1px' }}>
                            {roundData.map((cellData) => {
                                const { pickNumber, pick, teamPosition } = cellData;
                                const isCurrentPick = pickNumber === nextPick;
                                const cellKey = `${roundIndex}-${teamPosition}`;
                                const isHovered = hoveredCell === cellKey;
                                const isActive = activeCell?.pickNumber === pickNumber;
                                const isUserTeamCell = userTeamPosition === teamPosition;

                                return (
                                    <div
                                        key={cellKey}
                                        className={`
                      relative p-2 min-h-[60px] 
                      transition-all duration-200 cursor-pointer
                      ${isUserTeamCell ? 'border-2 border-white' : 'border border-white/15'}
                      ${isCurrentPick ? 'ring-2 ring-blue-400 bg-blue-950/20' : ''}
                      ${isActive ? 'ring-2 ring-yellow-400 bg-yellow-950/20' : ''}
                      ${isHovered && !isActive ? 'bg-gray-800/50' : 'bg-black'}
                      hover:bg-gray-800/50
                    `}
                                        onMouseEnter={() => setHoveredCell(cellKey)}
                                        onMouseLeave={() => setHoveredCell(null)}
                                        onClick={(e) => handleCellClick(pickNumber, roundIndex + 1, teamPosition, pick, e)}
                                    >
                                        {/* Pick Number (small, top-left) */}
                                        <div className="absolute top-1 left-1 font-mono text-[10px] text-gray-500">
                                            {pickNumber}
                                        </div>

                                        {/* Player Info */}
                                        <div className="mt-3">
                                            {pick?.player ? (
                                                <div>
                                                    <div className={`font-mono text-sm truncate ${getPositionColor(pick.position || '')}`}>
                                                        {pick.player}
                                                    </div>
                                                    <div className={`font-mono text-xs ${getPositionColor(pick.position || '')}`}>
                                                        {pick.position} • {pick.team}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <span className="font-mono text-xs text-gray-600">
                                                        {isCurrentPick ? 'ON CLOCK' : '—'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {activeCell && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 bg-black border border-white/20 shadow-xl p-3 min-w-[280px]"
                    style={{
                        left: `${activeCell.position.x}px`,
                        top: `${activeCell.position.y}px`,
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                        <div>
                            <div className="font-mono text-sm text-white">
                                Pick #{activeCell.pickNumber}
                            </div>
                            <div className="font-mono text-xs text-gray-400">
                                Round {activeCell.round} • Team {activeCell.teamPosition}
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveCell(null)}
                            className="text-gray-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        {/* Manually Assign Player */}
                        <div>
                            <button
                                className="w-full flex items-center gap-2 p-2 text-left font-mono text-sm text-white hover:bg-gray-800 border border-white/10"
                                onClick={() => { }} // This will expand the search
                            >
                                <UserPlus size={16} />
                                Manually Assign Player
                            </button>

                            {/* Player Search */}
                            <div className="mt-2 space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-black border border-white/20 text-white pl-8 pr-3 py-1 font-mono text-xs"
                                        autoFocus
                                    />
                                </div>

                                {/* Search Results */}
                                {searchQuery.length >= 2 && (
                                    <div className="max-h-32 overflow-y-auto border border-white/10 bg-gray-950">
                                        {loadingSearch ? (
                                            <div className="p-2 text-center text-gray-400 font-mono text-xs">
                                                Searching...
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            <div className="divide-y divide-white/10">
                                                {searchResults.map((player) => (
                                                    <button
                                                        key={`${player.name}-${player.team}`}
                                                        onClick={() => handleManualAssign(player)}
                                                        className="w-full p-2 text-left hover:bg-gray-800 transition-colors"
                                                    >
                                                        <div className={`font-mono text-xs ${getPositionColor(player.position)}`}>
                                                            {player.name}
                                                        </div>
                                                        <div className={`font-mono text-xs ${getPositionColor(player.position)}`}>
                                                            {player.position} • {player.team}
                                                            {player.adp && ` • ADP ${player.adp.toFixed(1)}`}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-2 text-center text-gray-400 font-mono text-xs">
                                                No players found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Remove Player */}
                        {activeCell.hasPlayer && (
                            <button
                                onClick={handleRemovePlayer}
                                className="w-full flex items-center gap-2 p-2 text-left font-mono text-sm text-red-400 hover:bg-red-950/20 border border-red-500/20"
                            >
                                <UserMinus size={16} />
                                Remove Player
                            </button>
                        )}

                        {/* View Player */}
                        {activeCell.hasPlayer && (
                            <button
                                onClick={handleViewPlayer}
                                className="w-full flex items-center gap-2 p-2 text-left font-mono text-sm text-blue-400 hover:bg-blue-950/20 border border-blue-500/20"
                            >
                                <Eye size={16} />
                                View Player Details
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
