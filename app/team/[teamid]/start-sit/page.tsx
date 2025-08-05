// app/team/[teamId]/start-sit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Player {
    sleeper_id: string;
    name: string;
    position: string;
    team: string;
}

export default function StartSitPage() {
    const params = useParams();
    const teamId = params.teamId as string;

    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayer1, setSelectedPlayer1] = useState<string>('');
    const [selectedPlayer2, setSelectedPlayer2] = useState<string>('');
    const [selectedPlayer3, setSelectedPlayer3] = useState<string>('');
    const [showThirdPlayer, setShowThirdPlayer] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Fetch team players on mount
    useEffect(() => {
        fetchTeamPlayers();
    }, [teamId]);

    const fetchTeamPlayers = async () => {
        try {
            const response = await fetch(`/api/teams/${teamId}/players`);
            const data = await response.json();
            setPlayers(data.players || []);
        } catch (error) {
            console.error('Failed to fetch team players:', error);
        }
    };

    const runComparison = async () => {
        if (!selectedPlayer1 || !selectedPlayer2) return;

        setLoading(true);
        try {
            let url = `/api/player-comparison?player1=${selectedPlayer1}&player2=${selectedPlayer2}`;
            if (showThirdPlayer && selectedPlayer3) {
                url += `&player3=${selectedPlayer3}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            setComparisonResult(data);
        } catch (error) {
            console.error('Comparison failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8">Who Should I Start?</h1>

            {/* Player Selection */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Select Players to Compare</h2>

                <div className="flex items-center gap-4 flex-wrap">
                    <PlayerDropdown
                        players={players}
                        selected={selectedPlayer1}
                        onChange={setSelectedPlayer1}
                        placeholder="Select Player 1"
                    />

                    <span className="text-2xl font-bold text-gray-400">VS</span>

                    <PlayerDropdown
                        players={players}
                        selected={selectedPlayer2}
                        onChange={setSelectedPlayer2}
                        placeholder="Select Player 2"
                    />

                    {showThirdPlayer && (
                        <>
                            <span className="text-2xl font-bold text-gray-400">VS</span>
                            <PlayerDropdown
                                players={players}
                                selected={selectedPlayer3}
                                onChange={setSelectedPlayer3}
                                placeholder="Select Player 3"
                            />
                        </>
                    )}

                    {!showThirdPlayer && (
                        <button
                            onClick={() => setShowThirdPlayer(true)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            + Add 3rd Player
                        </button>
                    )}
                </div>

                <button
                    onClick={runComparison}
                    disabled={!selectedPlayer1 || !selectedPlayer2 || loading}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {loading ? 'Analyzing...' : 'Compare Players'}
                </button>
            </div>

            {/* Results */}
            {comparisonResult && (
                <ComparisonResults data={comparisonResult} />
            )}
        </div>
    );
}

// Player Dropdown Component
function PlayerDropdown({ players, selected, onChange, placeholder }: {
    players: Player[];
    selected: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <select
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
            <option value="">{placeholder}</option>
            {players.map((player) => (
                <option key={player.sleeper_id} value={player.sleeper_id}>
                    {player.name} ({player.position}, {player.team})
                </option>
            ))}
        </select>
    );
}
