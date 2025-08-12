'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, Minus, Check, X } from 'lucide-react';

// Update the Player interface to match the search API
interface Player {
    sleeper_id: string;
    name: string;
    position: string;
    team: string;
}

interface PlayerOnTeam extends Player {
    id: string; // We'll use sleeper_id as id
}

interface LeagueSettings {
    num_teams: number;
    roster_positions: string[];
    scoring_settings: { [key: string]: number };
    playoff_week_start: number;
}

interface TeamMember {
    id: string;
    name: string;
    owner: string;
}

const COMMON_SCORING_SETTINGS = {
    // Passing
    pass_yd: { label: 'Passing Yards (per yard)', default: 0.04, step: 0.01 },
    pass_td: { label: 'Passing Touchdowns', default: 4, step: 1 },
    pass_int: { label: 'Interceptions', default: -1, step: 1 },
    pass_2pt: { label: 'Passing 2-Point Conversions', default: 2, step: 1 },

    // Rushing
    rush_yd: { label: 'Rushing Yards (per yard)', default: 0.1, step: 0.01 },
    rush_td: { label: 'Rushing Touchdowns', default: 6, step: 1 },
    rush_2pt: { label: 'Rushing 2-Point Conversions', default: 2, step: 1 },

    // Receiving
    rec: { label: 'Receptions (PPR)', default: 1, step: 0.5 },
    rec_yd: { label: 'Receiving Yards (per yard)', default: 0.1, step: 0.01 },
    rec_td: { label: 'Receiving Touchdowns', default: 6, step: 1 },
    rec_2pt: { label: 'Receiving 2-Point Conversions', default: 2, step: 1 },

    // Kicking
    fgm: { label: 'Field Goals Made', default: 3, step: 1 },
    fgm_40_49: { label: 'Field Goals 40-49 yards', default: 4, step: 1 },
    fgm_50p: { label: 'Field Goals 50+ yards', default: 5, step: 1 },
    xpm: { label: 'Extra Points Made', default: 1, step: 1 },

    // Defense
    def_td: { label: 'Defensive Touchdowns', default: 6, step: 1 },
    def_int: { label: 'Defensive Interceptions', default: 2, step: 1 },
    def_fum_rec: { label: 'Fumbles Recovered', default: 2, step: 1 },
    def_sack: { label: 'Sacks', default: 1, step: 1 },
    def_safety: { label: 'Safeties', default: 2, step: 1 },
};

const ROSTER_POSITIONS = [
    { key: 'QB', label: 'Quarterback', default: 1 },
    { key: 'RB', label: 'Running Back', default: 2 },
    { key: 'WR', label: 'Wide Receiver', default: 2 },
    { key: 'TE', label: 'Tight End', default: 1 },
    { key: 'FLEX', label: 'Flex (RB/WR/TE)', default: 1 },
    { key: 'K', label: 'Kicker', default: 1 },
    { key: 'DEF', label: 'Defense/ST', default: 1 },
    { key: 'BN', label: 'Bench', default: 6 },
];

export default function ManualLeagueSetup({ params }: { params: { leagueId: string } }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [league, setLeague] = useState<any>(null);
    const router = useRouter();
    const supabase = createClient();

    // Step 1: League Settings
    const [numTeams, setNumTeams] = useState(12);
    const [playoffWeekStart, setPlayoffWeekStart] = useState(15);

    // Step 2: Roster Configuration
    const [rosterConfig, setRosterConfig] = useState<{ [key: string]: number }>(
        ROSTER_POSITIONS.reduce((acc, pos) => ({ ...acc, [pos.key]: pos.default }), {})
    );

    // Step 3: Scoring Settings
    const [scoringSettings, setScoringSettings] = useState<{ [key: string]: number }>(
        Object.entries(COMMON_SCORING_SETTINGS).reduce(
            (acc, [key, config]) => ({ ...acc, [key]: config.default }), {}
        )
    );

    // Step 4: Your Roster - Updated with player search
    const [myRoster, setMyRoster] = useState<PlayerOnTeam[]>([]);
    const [playerSearchValue, setPlayerSearchValue] = useState('');
    const [playerSuggestions, setPlayerSuggestions] = useState<Player[]>([]);
    const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
    const playerSearchRef = useRef<HTMLDivElement>(null);

    // Player search functionality (borrowed from comparison tool)
    const searchPlayers = async (query: string) => {
        if (query.length < 2) {
            setPlayerSuggestions([]);
            setShowPlayerDropdown(false);
            return;
        }

        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                setPlayerSuggestions(data.players || []);
                setShowPlayerDropdown(true);
            }
        } catch (error) {
            console.error('Player search failed:', error);
        }
    };

    const handlePlayerSearchChange = (value: string) => {
        setPlayerSearchValue(value);

        // Debounced search
        const timeoutId = setTimeout(() => {
            searchPlayers(value);
        }, 300);

        return () => clearTimeout(timeoutId);
    };

    const handleSelectPlayer = (player: Player) => {
        // Check if player is already on roster
        if (myRoster.some(p => p.sleeper_id === player.sleeper_id)) {
            alert('Player already on roster!');
            return;
        }

        const playerOnTeam: PlayerOnTeam = {
            id: player.sleeper_id,
            sleeper_id: player.sleeper_id,
            name: player.name,
            position: player.position,
            team: player.team
        };

        setMyRoster(prev => [...prev, playerOnTeam]);
        setPlayerSearchValue('');
        setPlayerSuggestions([]);
        setShowPlayerDropdown(false);
    };

    const removePlayer = (sleeperId: string) => {
        setMyRoster(prev => prev.filter(p => p.sleeper_id !== sleeperId));
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (playerSearchRef.current && !playerSearchRef.current.contains(event.target as Node)) {
                setShowPlayerDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchLeague();
    }, []);

    const fetchLeague = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: leagueData } = await supabase
                .from('leagues')
                .select('*')
                .eq('sleeper_league_id', params.leagueId)
                .eq('user_email', user.email)
                .single();

            if (leagueData) {
                setLeague(leagueData);
                // Remove these lines that incorrectly add team name as a player:
                // setMyRoster([
                //     { id: '1', name: leagueData.sleeper_username || 'My Team', owner: user.email!, position: 'QB', team: 'FA' }
                // ]);
            }
        } catch (error) {
            console.error('Failed to fetch league:', error);
        }
    };

    const updateRosterConfig = (position: string, value: number) => {
        setRosterConfig(prev => ({ ...prev, [position]: Math.max(0, value) }));
    };

    const updateScoringSettings = (setting: string, value: number) => {
        setScoringSettings(prev => ({ ...prev, [setting]: value }));
    };

    // **FIXED VERSION** - Replace the existing getRosterSummary function
    const getRosterSummary = () => {
        const positionCounts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
        myRoster.forEach(player => {
            if (positionCounts.hasOwnProperty(player.position)) {
                positionCounts[player.position as keyof typeof positionCounts]++;
            }
        });

        // Smart allocation: fill starting spots first, then FLEX, then bench
        const allocation = {
            starting: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 },
            flex: 0,
            bench: 0
        };

        // Fill required starting positions first
        allocation.starting.QB = Math.min(positionCounts.QB, rosterConfig.QB);
        allocation.starting.RB = Math.min(positionCounts.RB, rosterConfig.RB);
        allocation.starting.WR = Math.min(positionCounts.WR, rosterConfig.WR);
        allocation.starting.TE = Math.min(positionCounts.TE, rosterConfig.TE);
        allocation.starting.K = Math.min(positionCounts.K, rosterConfig.K || 0);
        allocation.starting.DEF = Math.min(positionCounts.DEF, rosterConfig.DEF || 0);

        // Calculate excess flex-eligible players (RB, WR, TE beyond their starting requirements)
        const excessFlexEligible =
            Math.max(0, positionCounts.RB - allocation.starting.RB) +
            Math.max(0, positionCounts.WR - allocation.starting.WR) +
            Math.max(0, positionCounts.TE - allocation.starting.TE);

        // Fill FLEX positions
        allocation.flex = Math.min(excessFlexEligible, rosterConfig.FLEX || 0);

        // Calculate bench (all remaining players)
        const totalUsedInStarting = Object.values(allocation.starting).reduce((sum, count) => sum + count, 0);
        allocation.bench = myRoster.length - totalUsedInStarting - allocation.flex;

        return {
            rawCounts: positionCounts,
            allocation,
            corePositionsFilled: allocation.starting.QB >= rosterConfig.QB &&
                allocation.starting.RB >= rosterConfig.RB &&
                allocation.starting.WR >= rosterConfig.WR &&
                allocation.starting.TE >= rosterConfig.TE
        };
    };

    // **FIXED VERSION** - Replace the existing validateRoster function
    const validateRoster = (): { isValid: boolean; errors: string[] } => {
        const errors: string[] = [];
        const summary = getRosterSummary();

        // Check if we have enough players for each starting position
        if (summary.allocation.starting.QB < rosterConfig.QB) {
            errors.push(`Need ${rosterConfig.QB} starting QB(s), can fill ${summary.allocation.starting.QB}`);
        }
        if (summary.allocation.starting.RB < rosterConfig.RB) {
            errors.push(`Need ${rosterConfig.RB} starting RB(s), can fill ${summary.allocation.starting.RB}`);
        }
        if (summary.allocation.starting.WR < rosterConfig.WR) {
            errors.push(`Need ${rosterConfig.WR} starting WR(s), can fill ${summary.allocation.starting.WR}`);
        }
        if (summary.allocation.starting.TE < rosterConfig.TE) {
            errors.push(`Need ${rosterConfig.TE} starting TE(s), can fill ${summary.allocation.starting.TE}`);
        }

        // Check FLEX requirement
        if (summary.allocation.flex < (rosterConfig.FLEX || 0)) {
            const needed = (rosterConfig.FLEX || 0) - summary.allocation.flex;
            errors.push(`Need ${needed} more FLEX player(s) (RB/WR/TE eligible)`);
        }

        // Check kicker/defense if required
        if ((rosterConfig.K || 0) > 0 && summary.allocation.starting.K < rosterConfig.K) {
            errors.push(`Need ${rosterConfig.K} Kicker(s), have ${summary.allocation.starting.K}`);
        }
        if ((rosterConfig.DEF || 0) > 0 && summary.allocation.starting.DEF < rosterConfig.DEF) {
            errors.push(`Need ${rosterConfig.DEF} Defense(s), have ${summary.allocation.starting.DEF}`);
        }

        // Check if we have excluded positions when we shouldn't
        if (rosterConfig.K === 0 && summary.rawCounts.K > 0) {
            errors.push(`League doesn't use Kickers, but you have ${summary.rawCounts.K}`);
        }
        if (rosterConfig.DEF === 0 && summary.rawCounts.DEF > 0) {
            errors.push(`League doesn't use Defense, but you have ${summary.rawCounts.DEF}`);
        }

        // Check total roster size
        const expectedTotal = Object.values(rosterConfig).reduce((sum, count) => sum + count, 0);
        if (myRoster.length !== expectedTotal) {
            errors.push(`Need exactly ${expectedTotal} total players, you have ${myRoster.length}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    // **FIXED VERSION** - Enhanced handleFinish with better error handling
    const handleFinish = async () => {
        console.log('🚀 Starting setup completion...');

        // First, validate the roster
        const validation = validateRoster();
        if (!validation.isValid) {
            console.log('❌ Validation failed:', validation.errors);
            alert(`Roster validation failed:\n\n${validation.errors.join('\n')}`);
            return;
        }

        console.log('✅ Roster validation passed');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            console.log('👤 User authenticated:', user.email);

            // Prepare roster positions array
            const rosterPositions: string[] = [];
            Object.entries(rosterConfig).forEach(([position, count]) => {
                for (let i = 0; i < count; i++) {
                    rosterPositions.push(position);
                }
            });

            console.log('📋 Roster positions:', rosterPositions);

            // Smart starter assignment using allocation logic
            const summary = getRosterSummary();
            const starters: PlayerOnTeam[] = [];
            const availablePlayers = [...myRoster];

            // Fill starting positions based on allocation
            ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].forEach(position => {
                const needed = summary.allocation.starting[position as keyof typeof summary.allocation.starting];
                for (let i = 0; i < needed; i++) {
                    const player = availablePlayers.find(p => p.position === position);
                    if (player) {
                        starters.push(player);
                        availablePlayers.splice(availablePlayers.indexOf(player), 1);
                    }
                }
            });

            // Fill FLEX positions
            for (let i = 0; i < summary.allocation.flex; i++) {
                const flexPlayer = availablePlayers.find(p => ['RB', 'WR', 'TE'].includes(p.position));
                if (flexPlayer) {
                    starters.push(flexPlayer);
                    availablePlayers.splice(availablePlayers.indexOf(flexPlayer), 1);
                }
            }

            console.log('🏈 Starters assigned:', starters.length);
            console.log('🪑 Bench players:', availablePlayers.length);

            // Prepare league data in Sleeper format
            const leagueSettings = {
                roster_positions: rosterPositions,
                scoring_settings: scoringSettings,
                num_teams: numTeams,
                playoff_week_start: playoffWeekStart
            };

            const rosters_json = {
                username: league?.sleeper_username || 'My Team',
                starters: starters,
                roster: myRoster
            };

            const teams_data = [{
                id: '1',
                name: league?.sleeper_username || 'My Team',
                owner: user.email!
            }];

            console.log('💾 Saving to database...');

            // Update league with settings
            const { error } = await supabase
                .from('leagues')
                .update({
                    rosters_json,
                    league_settings: leagueSettings,
                    teams_data,
                    setup_completed: true,
                    last_synced_at: new Date().toISOString()
                })
                .eq('sleeper_league_id', params.leagueId)
                .eq('user_email', user.email);

            if (error) {
                console.error('💥 Database error:', error);
                throw error;
            }

            console.log('✅ Successfully saved to database');
            console.log('🔄 Redirecting to league page...');

            // Redirect to league page
            router.push(`/league/${params.leagueId}`);
        } catch (error: any) {
            console.error('💥 Setup failed:', error);
            alert('Failed to save league setup: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Also update canProceed for step 4
    const canProceed = () => {
        switch (step) {
            case 1: return numTeams >= 2 && numTeams <= 20;
            case 2: return Object.values(rosterConfig).some(v => v > 0);
            case 3: return true;
            case 4: {
                // More sophisticated validation for step 4
                const validation = validateRoster();
                return validation.isValid;
            }
            default: return false;
        }
    };



    if (!league) {
        return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;
    }

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
                        [setup: {league.league_name}]
                    </h1>

                    {/* Progress indicator - Change to 4 steps */}
                    <div className="flex items-center space-x-2 mb-6">
                        {[1, 2, 3, 4].map((stepNum) => ( // Changed from [1,2,3,4,5] to [1,2,3,4]
                            <div
                                key={stepNum}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border ${stepNum < step
                                    ? 'bg-white text-black border-white'
                                    : stepNum === step
                                        ? 'border-white text-white'
                                        : 'border-gray-600 text-gray-600'
                                    }`}
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                {stepNum < step ? <Check size={16} /> : stepNum}
                            </div>
                        ))}
                    </div>

                    <p
                        className="text-lg text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        {step === 1 && 'step 1/4: league format'}
                        {step === 2 && 'step 2/4: roster positions'}
                        {step === 3 && 'step 3/4: scoring settings'}
                        {step === 4 && 'step 4/4: your roster'}
                    </p>
                </header>

                <div className="bg-black border border-white/20 p-8">
                    {/* Step 1: League Format */}
                    {step === 1 && (
                        <div>
                            <h2
                                className="text-2xl font-normal mb-6"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [league format]
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label
                                        className="block text-sm text-gray-400 mb-2"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        number of teams
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="20"
                                        value={numTeams}
                                        onChange={(e) => setNumTeams(parseInt(e.target.value) || 12)}
                                        className="w-full p-3 bg-black border border-white text-white rounded-none"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    />
                                </div>

                                <div>
                                    <label
                                        className="block text-sm text-gray-400 mb-2"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        playoff start week
                                    </label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="18"
                                        value={playoffWeekStart}
                                        onChange={(e) => setPlayoffWeekStart(parseInt(e.target.value) || 15)}
                                        className="w-full p-3 bg-black border border-white text-white rounded-none"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Roster Configuration */}
                    {step === 2 && (
                        <div>
                            <h2
                                className="text-2xl font-normal mb-6"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [roster positions]
                            </h2>

                            <div className="space-y-4">
                                {ROSTER_POSITIONS.map((position) => (
                                    <div key={position.key} className="flex items-center justify-between">
                                        <label
                                            className="text-gray-300"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            {position.label}
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => updateRosterConfig(position.key, rosterConfig[position.key] - 1)}
                                                className="w-8 h-8 border border-white text-white hover:bg-white hover:text-black transition-colors"
                                                style={{ fontFamily: 'Consolas, monospace' }}
                                            >
                                                <Minus size={16} className="mx-auto" />
                                            </button>
                                            <span
                                                className="w-12 text-center"
                                                style={{ fontFamily: 'Consolas, monospace' }}
                                            >
                                                {rosterConfig[position.key]}
                                            </span>
                                            <button
                                                onClick={() => updateRosterConfig(position.key, rosterConfig[position.key] + 1)}
                                                className="w-8 h-8 border border-white text-white hover:bg-white hover:text-black transition-colors"
                                                style={{ fontFamily: 'Consolas, monospace' }}
                                            >
                                                <Plus size={16} className="mx-auto" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Scoring Settings */}
                    {step === 3 && (
                        <div>
                            <h2
                                className="text-2xl font-normal mb-6"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [scoring settings]
                            </h2>

                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {Object.entries(COMMON_SCORING_SETTINGS).map(([key, config]) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <label
                                            className="text-gray-300 flex-1"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            {config.label}
                                        </label>
                                        <input
                                            type="number"
                                            step={config.step}
                                            value={scoringSettings[key]}
                                            onChange={(e) => updateScoringSettings(key, parseFloat(e.target.value) || 0)}
                                            className="w-20 p-2 bg-black border border-white text-white text-center rounded-none"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Your Roster */}
                    {step === 4 && (
                        <div>
                            <h2
                                className="text-2xl font-normal mb-6"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [your roster]
                            </h2>

                            {/* Player Search */}
                            <div className="mb-6 p-4 border border-gray-600">
                                <h3
                                    className="text-lg font-normal mb-4"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [search & add players]
                                </h3>

                                <div className="relative" ref={playerSearchRef}>
                                    <input
                                        type="text"
                                        value={playerSearchValue}
                                        onChange={(e) => handlePlayerSearchChange(e.target.value)}
                                        placeholder="Search for a player (e.g., AJ Brown)"
                                        className="w-full p-3 bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    />

                                    {/* Player Dropdown */}
                                    {showPlayerDropdown && playerSuggestions.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-black border border-white shadow-lg max-h-60 overflow-y-auto">
                                            {playerSuggestions.map((player) => (
                                                <button
                                                    key={player.sleeper_id}
                                                    onClick={() => handleSelectPlayer(player)}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-900 border-b border-gray-700 last:border-b-0 transition-colors"
                                                    style={{ fontFamily: 'Consolas, monospace' }}
                                                >
                                                    <div className="text-white">
                                                        {player.name}
                                                    </div>
                                                    <div className="text-sm text-gray-400">
                                                        {player.position} - {player.team}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-gray-500 mt-2">
                                    Start typing a player's name to search. Players will auto-populate with position and team info.
                                </p>
                            </div>

                            {/* Roster Requirements Summary */}
                            <div className="mb-6 p-4 border border-gray-600 bg-gray-900/50">
                                <h3
                                    className="text-lg font-normal mb-4"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [roster requirements]
                                </h3>

                                {(() => {
                                    const summary = getRosterSummary();
                                    const validation = validateRoster();

                                    return (
                                        <>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                {Object.entries(rosterConfig).map(([position, required]) => {
                                                    if (required === 0) return null;

                                                    let current: number;
                                                    let isComplete: boolean;

                                                    if (position === 'FLEX') {
                                                        current = summary.allocation.flex;
                                                        isComplete = current >= required;
                                                    } else if (position === 'BN') {
                                                        current = summary.allocation.bench;
                                                        isComplete = current >= required;
                                                    } else {
                                                        // Show only starting positions for each role
                                                        current = summary.allocation.starting[position as keyof typeof summary.allocation.starting] || 0;
                                                        isComplete = current >= required;
                                                    }

                                                    return (
                                                        <div key={position} className={`text-center ${isComplete ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            <div style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {position === 'BN' ? 'BENCH' : position}
                                                            </div>
                                                            <div style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {current}/{required}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Position breakdown for clarity */}
                                            <div className="mt-4 text-xs text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                                {(() => {
                                                    const breakdown = [];

                                                    Object.entries(summary.rawCounts).forEach(([pos, count]) => {
                                                        if (count > 0) {
                                                            const starting = summary.allocation.starting[pos as keyof typeof summary.allocation.starting] || 0;
                                                            const excess = count - starting;
                                                            if (excess > 0) {
                                                                breakdown.push(`${pos}: ${starting} starting + ${excess} excess`);
                                                            } else {
                                                                breakdown.push(`${pos}: ${count} starting`);
                                                            }
                                                        }
                                                    });

                                                    return breakdown.join(' | ');
                                                })()}
                                            </div>

                                            {/* Core positions status indicator */}
                                            {rosterConfig.FLEX > 0 && (
                                                <div className="mt-2 text-xs text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                                    {summary.corePositionsFilled
                                                        ? "✓ Core positions filled - excess RB/WR/TE count toward FLEX"
                                                        : "⚠ Fill all core positions (QB/RB/WR/TE) first"}
                                                </div>
                                            )}

                                            {/* Move the validation usage inside this IIFE */}
                                            <div className="mt-2 text-xs text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                                Total: {myRoster.length}/{Object.values(rosterConfig).reduce((sum, count) => sum + count, 0)} players
                                                {!validation.isValid && (
                                                    <div className="text-yellow-400 mt-1">
                                                        ⚠ {validation.errors[0]}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Current Roster */}
                            <div className="space-y-2">
                                <h3
                                    className="text-lg font-normal mb-4"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [current roster: {myRoster.length} players]
                                </h3>

                                {myRoster.length === 0 ? (
                                    <div
                                        className="text-center py-8 text-gray-400"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        no players added yet - search above to add your first player
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {myRoster.map((player) => (
                                            <div key={player.sleeper_id} className="flex items-center justify-between p-3 border border-gray-600 hover:border-gray-400 transition-colors">
                                                <div style={{ fontFamily: 'Consolas, monospace' }}>
                                                    <span className="text-white font-medium">{player.name}</span>
                                                    <span className="text-gray-400 ml-3">
                                                        {player.position} - {player.team}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removePlayer(player.sleeper_id)}
                                                    className="w-8 h-8 border border-red-400 text-red-400 hover:bg-red-400 hover:text-black transition-colors flex items-center justify-center"
                                                    style={{ fontFamily: 'Consolas, monospace' }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Navigation - Update step logic */}
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-600">
                        <button
                            onClick={() => setStep(step - 1)}
                            disabled={step === 1}
                            className="px-6 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            [back]
                        </button>

                        {step < 4 ? ( // Changed from step < 5 to step < 4
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={!canProceed()}
                                className="px-6 py-2 border border-white text-white hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                [next]
                            </button>
                        ) : (
                            <button
                                onClick={handleFinish}
                                disabled={!canProceed() || loading}
                                className="px-6 py-2 border border-white text-white hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                {loading ? '[saving...]' : '[finish setup]'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
