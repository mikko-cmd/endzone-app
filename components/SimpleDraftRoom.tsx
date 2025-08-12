'use client';

import React, { useState, useCallback, useEffect } from 'react';
import SnakeDraftBoard from './SnakeDraftBoard';
import PlayerList from './PlayerList';
import PlayerCardModal from './PlayerCardModal';
import { getPlayerByName, getPlayerById } from '@/lib/sleeper/fetchAllPlayers';
import { useSleeperDraftMonitor } from '@/hooks/useSleeperDraftMonitor';
import { SleeperPick, sleeperPickToBoardPosition } from '@/lib/sleeper/draftUtils';

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
        } catch (error: any) {
            console.error('Error fetching player details:', error);
            alert(`Error loading player details for ${player.player}`);
        } finally {
            setLoadingPlayerId(false);
        }
    };

    // Get list of drafted player names to exclude from player list
    const draftedPlayerNames = picks.map(pick => pick.player).filter(Boolean) as string[];

    // Debug: Log drafted player names
    useEffect(() => {
        if (draftedPlayerNames.length > 0) {
            console.log('🚫 Drafted players to exclude:', draftedPlayerNames);
        }
    }, [draftedPlayerNames]);

    // Handle new Sleeper picks - optimized for speed
    const handleSleeperPick = useCallback(async (sleeperPick: SleeperPick) => {
        console.log(`🎯 handleSleeperPick called: Pick ${sleeperPick.pick_no} [${new Date().toLocaleTimeString()}]`);

        try {
            // Get player details using Sleeper's player database
            const player = await getPlayerById(sleeperPick.player_id);

            if (player) {
                const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
                console.log(`✅ Found: ${playerName} (Pick ${sleeperPick.pick_no})`);

                // Create a new pick using our existing DraftPick format
                const newPick: DraftPick = {
                    pick: sleeperPick.pick_no,
                    round: sleeperPick.round,
                    player: playerName,
                    position: player.position || 'Unknown',
                    team: player.team || 'Unknown'
                };

                // Use functional state update to avoid stale state issues
                setPicks(currentPicks => {
                    const updatedPicks = currentPicks.filter(p => p.pick !== sleeperPick.pick_no);
                    updatedPicks.push(newPick);
                    updatedPicks.sort((a, b) => a.pick - b.pick);

                    console.log(`📈 Pick ${sleeperPick.pick_no} added. Total: ${updatedPicks.length}`);
                    return updatedPicks;
                });

            } else {
                console.warn(`⚠️ No player found for Sleeper ID: ${sleeperPick.player_id}`);
            }
        } catch (error: any) {
            console.error('❌ Error handling Sleeper pick:', error);
        }
    }, []);

    // Use the monitoring hook - use static pollInterval first
    const {
        sleeperDraftUrl,
        sleeperDraftId,
        isMonitoring,
        lastPickCount,
        draftInfo,
        error,
        handleUrlChange,
        toggleMonitoring,
    } = useSleeperDraftMonitor({
        onNewPick: handleSleeperPick,
        pollInterval: 1000 // 1 second for maximum responsiveness
    });

    // Add a function to force sync all existing picks
    const handleForceSyncAllPicks = async () => {
        if (!sleeperDraftId) return;

        try {
            console.log('🔄 Force syncing all existing picks...');
            const picks = await fetch(`https://api.sleeper.app/v1/draft/${sleeperDraftId}/picks`)
                .then(r => r.json());
            console.log(`📊 Processing ${picks.length} existing picks`);

            // Process all picks
            for (const pick of picks) {
                await handleSleeperPick(pick);
            }

            console.log('✅ Force sync complete');
        } catch (error: any) {
            console.error('❌ Error force syncing picks:', error);
        }
    };

    // Temporary debug logging
    useEffect(() => {
        console.log('🔍 Debug Info:');
        console.log('Total picks:', picks.length);
        console.log('Pick names:', picks.map(p => p.player));
        console.log('Excluded names:', draftedPlayerNames);
    }, [picks, draftedPlayerNames]);

    // Update the JSX to include a force sync button
    return (
        <div className="min-h-screen flex flex-col bg-black">
            {/* Sleeper Draft Integration Header */}
            <div className="p-4 bg-black border-b border-white/20">
                <div className="flex gap-4 items-center">
                    <input
                        type="text"
                        placeholder="Paste Sleeper draft URL here... (e.g., https://sleeper.com/draft/nfl/123456)"
                        value={sleeperDraftUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        className="flex-1 px-3 py-2 bg-black border border-white/20 text-white placeholder-gray-400 font-mono text-sm rounded focus:border-white/40 focus:outline-none"
                    />

                    <button
                        onClick={toggleMonitoring}
                        disabled={!sleeperDraftUrl}
                        className={`px-4 py-2 rounded font-mono text-sm transition-colors ${isMonitoring
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed'
                            }`}
                    >
                        {isMonitoring ? '🔴 Stop Monitoring' : '🟢 Start Monitoring'}
                    </button>

                    {/* Remove the Force Sync Button - automatic monitoring handles everything */}
                </div>

                {/* Status Display */}
                <div className="mt-2 flex items-center gap-4 text-sm font-mono">
                    {draftInfo && (
                        <div className="text-gray-300">
                            📊 Draft: {draftInfo.settings.teams} teams, {draftInfo.settings.rounds} rounds
                            {draftInfo.status === 'drafting' && <span className="text-green-400 ml-2">🟢 Live</span>}
                            {draftInfo.status === 'pre_draft' && <span className="text-yellow-400 ml-2">⏳ Pre-Draft</span>}
                            {draftInfo.status === 'complete' && <span className="text-gray-400 ml-2">✅ Complete</span>}
                        </div>
                    )}

                    {isMonitoring && (
                        <div className="text-green-400 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            📡 Live monitoring... ({lastPickCount} picks synced)
                        </div>
                    )}

                    {/* Draft Sync Disclaimer */}
                    {isMonitoring && (
                        <div className="text-gray-400 text-xs">
                            ⏱️ Draft sync may take up to 15 seconds
                        </div>
                    )}

                    {error && (
                        <div className="text-red-400">
                            ❌ {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Draft Content */}
            <div className="flex-1 flex">
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
                                disabled={isMonitoring} // Prevent changes during monitoring
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
                                disabled={isMonitoring} // Prevent changes during monitoring
                            >
                                <option value={12}>12 Rounds</option>
                                <option value={14}>14 Rounds</option>
                                <option value={16}>16 Rounds</option>
                                <option value={18}>18 Rounds</option>
                                <option value={20}>20 Rounds</option>
                            </select>
                        </div>

                        {isMonitoring && (
                            <div className="text-green-400 text-sm font-mono">
                                🔗 Synced with Sleeper
                            </div>
                        )}

                        {/* Show drafted players count */}
                        <div className="text-gray-400 text-sm font-mono">
                            🚫 {draftedPlayerNames.length} players drafted
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
