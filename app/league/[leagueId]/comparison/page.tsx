'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, X } from 'lucide-react';

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

export default function PlayerComparisonPage({ params }: { params: { leagueId: string } }) {
    const [playerFields, setPlayerFields] = useState<PlayerField[]>([
        { id: '1', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] },
        { id: '2', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] }
    ]);
    const [showThirdPlayer, setShowThirdPlayer] = useState(false);
    const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const clickedInside = Object.values(dropdownRefs.current).some(ref =>
                ref && ref.contains(event.target as Node)
            );

            if (!clickedInside) {
                setPlayerFields(prev => prev.map(field => ({ ...field, showDropdown: false })));
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update the searchPlayers function with more detailed logging:
    const searchPlayers = async (query: string): Promise<Player[]> => {
        if (query.trim().length < 2) return [];

        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            return data.players || [];
        } catch (error) {
            console.error('Failed to search players:', error);
            return [];
        }
    };

    const handleInputChange = async (fieldId: string, value: string) => {
        setPlayerFields(prev => prev.map(field =>
            field.id === fieldId
                ? { ...field, value, selectedPlayer: null, showDropdown: true }
                : field
        ));

        if (value.trim().length >= 2) {
            const suggestions = await searchPlayers(value);

            setPlayerFields(prev => prev.map(field =>
                field.id === fieldId
                    ? { ...field, suggestions, showDropdown: suggestions.length > 0 }
                    : field
            ));
        } else {
            setPlayerFields(prev => prev.map(field =>
                field.id === fieldId
                    ? { ...field, suggestions: [], showDropdown: false }
                    : field
            ));
        }
    };

    const handlePlayerSelect = (fieldId: string, player: Player) => {
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
        if (!showThirdPlayer) {
            setShowThirdPlayer(true);
            setPlayerFields(prev => [
                ...prev,
                { id: '3', value: '', selectedPlayer: null, showDropdown: false, suggestions: [] }
            ]);
        }
    };

    const removeThirdPlayer = () => {
        setShowThirdPlayer(false);
        setPlayerFields(prev => prev.filter(field => field.id !== '3'));
    };

    const handleCompare = () => {
        const selectedPlayers = playerFields
            .filter(field => field.selectedPlayer)
            .map(field => field.selectedPlayer);

        if (selectedPlayers.length < 2) {
            alert('Please select at least 2 players to compare');
            return;
        }

        console.log('Comparing players:', selectedPlayers);
        // TODO: Call comparison API
    };

    const renderPlayerInput = (field: PlayerField, index: number) => {
        return (
            <div key={field.id} className="relative">
                <label
                    htmlFor={`player${field.id}`}
                    className="block text-sm font-medium text-gray-300 mb-2"
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
                        className="w-full bg-[#1a0033] border border-purple-800 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        autoComplete="off"
                    />

                    {/* Player Selected Indicator */}
                    {field.selectedPlayer && (
                        <div className="absolute right-2 top-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                            {field.selectedPlayer.position} - {field.selectedPlayer.team}
                        </div>
                    )}

                    {/* Dropdown */}
                    {field.showDropdown && field.suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-[#2c1a4d] border border-purple-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {field.suggestions.map((player) => (
                                <button
                                    key={player.sleeper_id}
                                    onClick={() => handlePlayerSelect(field.id, player)}
                                    className="w-full text-left px-4 py-3 hover:bg-purple-800 transition-colors border-b border-purple-800 last:border-b-0"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{player.name}</span>
                                        <span className="text-sm text-gray-400">
                                            {player.position} - {player.team}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const testDatabase = async () => {
        try {
            console.log('🧪 Testing database...');
            const response = await fetch('/api/players/debug');
            const data = await response.json();
            console.log('🧪 Database test results:', data);
            alert(`Database has ${data.totalCount} players. Check console for details.`);
        } catch (error) {
            console.error('❌ Database test failed:', error);
            alert('Database test failed');
        }
    };

    return (
        <div className="min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <Link
                    href={`/league/${params.leagueId}`}
                    className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6 transition-colors"
                >
                    <ChevronLeft size={20} className="mr-2" />
                    Back to Team Page
                </Link>

                <header className="mb-8 border-b border-purple-800 pb-4">
                    <h1 className="text-3xl sm:text-5xl font-bold mb-2">Player Comparison</h1>
                    <p className="text-lg text-gray-400">
                        Select 2-3 players to get an AI-powered start/sit recommendation.
                    </p>
                </header>

                <div className="mb-4">
                    <button
                        onClick={testDatabase}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mr-4"
                    >
                        🧪 Test Database
                    </button>
                </div>

                <div className="bg-[#2c1a4d] rounded-xl shadow-lg p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {playerFields.map((field, index) => renderPlayerInput(field, index))}

                        {/* Add Third Player Button or Remove Button */}
                        {!showThirdPlayer ? (
                            <div className="flex items-end">
                                <button
                                    onClick={addThirdPlayer}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
                                >
                                    <Plus size={16} className="mr-2" />
                                    Add Player
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-end">
                                <button
                                    onClick={removeThirdPlayer}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
                                >
                                    <X size={16} className="mr-2" />
                                    Remove Player
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleCompare}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg flex items-center transition-colors text-lg"
                        >
                            Compare Players
                        </button>
                    </div>
                </div>

                {/* Results will be displayed here */}
                <div className="mt-8">
                    {/* Placeholder for comparison results */}
                </div>
            </div>
        </div>
    );
} 