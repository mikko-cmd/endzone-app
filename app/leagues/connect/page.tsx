'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ExternalLink, Users, Plus, AlertCircle } from 'lucide-react';

interface ConnectOption {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    difficulty: 'Easy' | 'Medium' | 'Manual';
    status: 'available' | 'coming_soon' | 'manual';
}

export default function ConnectLeaguePage() {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    // Sleeper connection state
    const [sleeperLeagueId, setSleeperLeagueId] = useState('');
    const [sleeperUsername, setSleeperUsername] = useState('');

    // Manual entry state
    const [manualLeagueName, setManualLeagueName] = useState('');
    const [manualPlatform, setManualPlatform] = useState('');
    const [manualTeamName, setManualTeamName] = useState('');

    const connectOptions: ConnectOption[] = [
        {
            id: 'sleeper',
            title: 'Sleeper League',
            description: 'Full integration with live data sync, rosters, and matchups',
            icon: <Users size={24} />,
            difficulty: 'Easy',
            status: 'available'
        },
        {
            id: 'yahoo',
            title: 'Yahoo Fantasy',
            description: 'Coming soon - OAuth integration for Yahoo leagues',
            icon: <ExternalLink size={24} />,
            difficulty: 'Medium',
            status: 'coming_soon'
        },
        {
            id: 'manual',
            title: 'Manual Entry',
            description: 'For ESPN, Yahoo, or other platforms - add basic league info',
            icon: <Plus size={24} />,
            difficulty: 'Manual',
            status: 'manual'
        }
    ];

    const handleSleeperConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sleeperLeagueId || !sleeperUsername) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const response = await fetch('/api/sync-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sleeper_league_id: sleeperLeagueId,
                    sleeper_username: sleeperUsername,
                    // Removed user_email - now handled by auth in API
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            router.push('/leagues');
        } catch (error: any) {
            console.error('Connection failed:', error);
            alert('Failed to connect league: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualLeagueName || !manualPlatform || !manualTeamName) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const uniqueLeagueId = `manual_${Date.now()}`;

            // Store manual league in database with platform info
            const { data: insertedLeague, error } = await supabase
                .from('leagues')
                .insert({
                    user_email: user.email,
                    league_name: manualLeagueName,
                    sleeper_username: manualTeamName,
                    sleeper_league_id: uniqueLeagueId, // Use the unique ID
                    platform: manualPlatform,
                    is_manual: true,
                    created_at: new Date().toISOString()
                })
                .select() // Add this to get the inserted record back
                .single(); // Get single record

            if (error) throw error;

            // Use the actual sleeper_league_id from the inserted record
            router.push(`/leagues/${uniqueLeagueId}/setup`);
        } catch (error: any) {
            console.error('Manual entry failed:', error);
            alert('Failed to add league: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Easy': return 'text-green-400';
            case 'Medium': return 'text-yellow-400';
            case 'Manual': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="w-full max-w-4xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <Link
                        href="/leagues"
                        className="inline-flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        <ArrowLeft size={16} className="mr-2" />
                        [back to leagues]
                    </Link>

                    <h1
                        className="text-4xl font-normal mb-4"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [connect league]
                    </h1>
                    <p
                        className="text-lg text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        choose your fantasy platform to get started
                    </p>
                </header>

                {!selectedOption ? (
                    /* Platform Selection */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {connectOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => option.status !== 'coming_soon' && setSelectedOption(option.id)}
                                disabled={option.status === 'coming_soon'}
                                className={`
                  p-6 border transition-all duration-200 text-left h-full
                  ${option.status === 'coming_soon'
                                        ? 'border-gray-600 bg-gray-900 opacity-50 cursor-not-allowed'
                                        : 'border-white/20 hover:border-white/40 hover:bg-gray-900 cursor-pointer'
                                    }
                `}
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                <div className="flex items-center mb-4">
                                    {option.icon}
                                    <h3 className="text-xl font-normal ml-3">[{option.title}]</h3>
                                </div>

                                <p className="text-gray-400 mb-4 text-sm">
                                    {option.description}
                                </p>

                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${getDifficultyColor(option.difficulty)}`}>
                                        {option.difficulty}
                                    </span>
                                    {option.status === 'coming_soon' && (
                                        <span className="text-xs text-gray-500">Coming Soon</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* Connection Forms */
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={() => setSelectedOption(null)}
                            className="text-gray-400 hover:text-white mb-6 transition-colors"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            ← [back to options]
                        </button>

                        {selectedOption === 'sleeper' && (
                            <div className="bg-black border border-white/20 p-8">
                                <h2
                                    className="text-2xl font-normal mb-6"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [connect sleeper league]
                                </h2>

                                <form onSubmit={handleSleeperConnect} className="space-y-6">
                                    <div>
                                        <label
                                            className="block text-sm text-gray-400 mb-2"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            sleeper league id
                                        </label>
                                        <input
                                            type="text"
                                            value={sleeperLeagueId}
                                            onChange={(e) => setSleeperLeagueId(e.target.value)}
                                            placeholder="123456789"
                                            className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                            disabled={loading}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Find this in your Sleeper app: League Settings → League ID
                                        </p>
                                    </div>

                                    <div>
                                        <label
                                            className="block text-sm text-gray-400 mb-2"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            your sleeper username
                                        </label>
                                        <input
                                            type="text"
                                            value={sleeperUsername}
                                            onChange={(e) => setSleeperUsername(e.target.value)}
                                            placeholder="username"
                                            className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                            disabled={loading}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full px-6 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {loading ? '[connecting...]' : '[connect league]'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {selectedOption === 'manual' && (
                            <div className="bg-black border border-white/20 p-8">
                                <h2
                                    className="text-2xl font-normal mb-4"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [manual league entry]
                                </h2>

                                <div className="flex items-start space-x-2 mb-6 p-4 bg-gray-900 border border-yellow-400/20">
                                    <AlertCircle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
                                        Manual entries won't sync live data. Perfect for ESPN/Yahoo leagues where you want basic tracking.
                                    </p>
                                </div>

                                <form onSubmit={handleManualEntry} className="space-y-6">
                                    <div>
                                        <label
                                            className="block text-sm text-gray-400 mb-2"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            league name
                                        </label>
                                        <input
                                            type="text"
                                            value={manualLeagueName}
                                            onChange={(e) => setManualLeagueName(e.target.value)}
                                            placeholder="My Fantasy League"
                                            className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                            disabled={loading}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label
                                            className="block text-sm text-gray-400 mb-2"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            platform
                                        </label>
                                        <select
                                            value={manualPlatform}
                                            onChange={(e) => setManualPlatform(e.target.value)}
                                            className="w-full p-3 bg-black border border-white text-white focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                            disabled={loading}
                                            required
                                        >
                                            <option value="">Select platform</option>
                                            <option value="ESPN">ESPN Fantasy</option>
                                            <option value="Yahoo">Yahoo Fantasy</option>
                                            <option value="NFL.com">NFL.com</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label
                                            className="block text-sm text-gray-400 mb-2"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            your team name
                                        </label>
                                        <input
                                            type="text"
                                            value={manualTeamName}
                                            onChange={(e) => setManualTeamName(e.target.value)}
                                            placeholder="Team Name"
                                            className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                            disabled={loading}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full px-6 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {loading ? '[adding league...]' : '[add league]'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
