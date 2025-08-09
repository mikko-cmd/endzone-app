'use client';

import React, { useState } from 'react';
import SnakeDraftBoard from './SnakeDraftBoard';
import PlayerList from './PlayerList';
import PlayerCardModal from './PlayerCardModal';
import { getPlayerByName } from '@/lib/sleeper/fetchAllPlayers';

interface DraftPick {
    pick: number;
    round: number;
    player?: string;
    position?: string;
    team?: string;
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

export default function SimpleDraftRoom() {
    const [leagueSize, setLeagueSize] = useState(12);
    const [rounds, setRounds] = useState(16);
    const [picks, setPicks] = useState<DraftPick[]>([]);
    const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
    const [loadingPlayerId, setLoadingPlayerId] = useState(false);

    const handleSelectPlayer = (player: Player) => {
        // Add to the next available pick
        const nextPickNumber = picks.length + 1;
        const round = Math.ceil(nextPickNumber / leagueSize);

        const newPick: DraftPick = {
            pick: nextPickNumber,
            round,
            player: player.name,
            position: player.position,
            team: player.team
        };

        setPicks([...picks, newPick]);
    };

    const handleManualAssign = (pickNumber: number, player: Player) => {
        const round = Math.ceil(pickNumber / leagueSize);

        const newPick: DraftPick = {
            pick: pickNumber,
            round,
            player: player.name,
            position: player.position,
            team: player.team
        };

        // Remove any existing pick at this position and add the new one
        const updatedPicks = picks.filter(p => p.pick !== pickNumber);
        updatedPicks.push(newPick);
        updatedPicks.sort((a, b) => a.pick - b.pick);

        setPicks(updatedPicks);
    };

    const handleRemovePlayer = (pickNumber: number) => {
        setPicks(picks.filter(p => p.pick !== pickNumber));
    };

    const handleViewPlayer = async (player: DraftPick) => {
        if (!player.player) return;

        setLoadingPlayerId(true);
        try {
            // Get the Sleeper player ID using the player name
            const sleeperPlayer = await getPlayerByName(player.player);
            if (sleeperPlayer?.player_id) {
                setViewingPlayerId(sleeperPlayer.player_id);
            } else {
                console.warn(`Could not find Sleeper ID for player: ${player.player}`);
                // Fallback: show a simple error message or the basic modal
                alert(`Player details not available for ${player.player}`);
            }
        } catch (error) {
            console.error('Error fetching player details:', error);
            alert(`Error loading player details for ${player.player}`);
        } finally {
            setLoadingPlayerId(false);
        }
    };

    // Get list of drafted player names to exclude from player list
    const draftedPlayerNames = picks.map(pick => pick.player).filter(Boolean) as string[];

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Draft Board */}
            <div className="flex-1 p-4">
                {/* Settings */}
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="font-mono text-sm text-gray-400">League Size:</label>
                        <select
                            value={leagueSize}
                            onChange={(e) => setLeagueSize(parseInt(e.target.value))}
                            className="bg-black border border-white/20 text-white px-2 py-1 font-mono text-sm"
                        >
                            <option value={8}>8 Teams</option>
                            <option value={10}>10 Teams</option>
                            <option value={12}>12 Teams</option>
                            <option value={14}>14 Teams</option>
                            <option value={16}>16 Teams</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="font-mono text-sm text-gray-400">Rounds:</label>
                        <select
                            value={rounds}
                            onChange={(e) => setRounds(parseInt(e.target.value))}
                            className="bg-black border border-white/20 text-white px-2 py-1 font-mono text-sm"
                        >
                            <option value={12}>12 Rounds</option>
                            <option value={14}>14 Rounds</option>
                            <option value={16}>16 Rounds</option>
                            <option value={18}>18 Rounds</option>
                            <option value={20}>20 Rounds</option>
                        </select>
                    </div>
                </div>

                {/* Draft Board */}
                <SnakeDraftBoard
                    leagueSize={leagueSize}
                    rounds={rounds}
                    picks={picks}
                    onManualAssign={handleManualAssign}
                    onRemovePlayer={handleRemovePlayer}
                    onViewPlayer={handleViewPlayer}
                />

                {/* Loading indicator when fetching player details */}
                {loadingPlayerId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
                        <div className="bg-black border border-white/20 p-4 rounded">
                            <div className="font-mono text-white text-sm">Loading player details...</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel - Player Selection */}
            <div className="w-96 border-l border-white/20 bg-black">
                <PlayerList
                    onSelectPlayer={handleSelectPlayer}
                    excludePlayerNames={draftedPlayerNames}
                />
            </div>

            {/* Player Card Modal */}
            {viewingPlayerId && (
                <PlayerCardModal
                    playerId={viewingPlayerId}
                    onClose={() => setViewingPlayerId(null)}
                />
            )}
        </div>
    );
}
