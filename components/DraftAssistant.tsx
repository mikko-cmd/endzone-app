'use client';

// Add this right after the 'use client' directive
const DEBUG = false; // Set to true only when debugging
const log = DEBUG ? console.log : () => { };
const warn = DEBUG ? console.warn : () => { };
const error = console.error; // Always keep errors

// Add this flag to temporarily disable problematic effects
const DISABLE_LIVE_SYNC = true; // Set to false once we fix the loops

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Clock, ChevronUp, ChevronDown, Search, Plus, User, Pause, Square } from 'lucide-react';
import SnakeDraftBoard from './SnakeDraftBoard';
import PlayerCardModal from './PlayerCardModal'; // Add this line
import { useSleeperDraftMonitor } from '@/hooks/useSleeperDraftMonitor';
import { getPlayerById } from '@/lib/sleeper/fetchAllPlayers';

// Types
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
    projectedPoints?: number;
    lastSeasonStats?: {
        receiving?: { receptions?: number; yards?: number; touchdowns?: number };
        rushing?: { attempts?: number; yards?: number; touchdowns?: number };
        passing?: { attempts?: number; yards?: number; touchdowns?: number };
    };
}

interface Suggestion {
    playerId: string;
    reason?: string;
    value?: { adp?: number; reach?: number };
}

interface MyRoster {
    QB: Player[];
    RB: Player[];
    WR: Player[];
    TE: Player[];
    FLEX: Player[];
    BENCH: Player[];
}

// CPU Team roster tracking
interface CPUTeamRoster {
    [teamNumber: number]: {
        QB: string[];
        RB: string[];
        WR: string[];
        TE: string[];
        K: string[];
        DST: string[];
        BENCH: string[];
    };
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

// Smart position assignment function
const assignPlayerToRoster = (player: Player, currentRoster: MyRoster): MyRoster => {
    const updated = { ...currentRoster };
    const position = player.position;

    // Roster limits: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, rest BENCH
    switch (position) {
        case 'QB':
            if (updated.QB.length < 1) {
                updated.QB = [...updated.QB, player];
            } else {
                updated.BENCH = [...updated.BENCH, player];
            }
            break;

        case 'RB':
            if (updated.RB.length < 2) {
                updated.RB = [...updated.RB, player];
            } else if (updated.FLEX.length < 1) {
                updated.FLEX = [...updated.FLEX, player];
            } else {
                updated.BENCH = [...updated.BENCH, player];
            }
            break;

        case 'WR':
            if (updated.WR.length < 2) {
                updated.WR = [...updated.WR, player];
            } else if (updated.FLEX.length < 1) {
                updated.FLEX = [...updated.FLEX, player];
            } else {
                updated.BENCH = [...updated.BENCH, player];
            }
            break;

        case 'TE':
            if (updated.TE.length < 1) {
                updated.TE = [...updated.TE, player];
            } else if (updated.FLEX.length < 1) {
                updated.FLEX = [...updated.FLEX, player];
            } else {
                updated.BENCH = [...updated.BENCH, player];
            }
            break;

        default:
            // K, DST, or unknown positions go straight to bench
            updated.BENCH = [...updated.BENCH, player];
            break;
    }

    return updated;
};

export default function DraftAssistant() {
    // Mode and basic settings
    const [mode, setMode] = useState<'live' | 'mock'>('mock');
    const [leagueSize, setLeagueSize] = useState(12);
    const [rounds, setRounds] = useState(16);
    const [picks, setPicks] = useState<DraftPick[]>([]);

    // Mock-only settings
    const [pickTimer, setPickTimer] = useState(30);
    const [userTeamPosition, setUserTeamPosition] = useState<number | null>(mode === 'mock' ? 1 : null);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentTeamOnClock, setCurrentTeamOnClock] = useState(1);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isPicking, setIsPicking] = useState(false); // NEW: Add picking state for UI reactivity

    // Live draft settings - ADD THESE
    const [sleeperUrl, setSleeperUrl] = useState('');

    // Use refs to track timers and prevent multiple simultaneous picks
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pickingRef = useRef<boolean>(false);

    // Add a ref to track current team without state delays
    const currentTeamRef = useRef(1);
    const draftActiveRef = useRef(false);
    const currentPickRef = useRef(1);
    const pausedRef = useRef(false);

    // CPU team rosters tracking
    const [cpuRosters, setCpuRosters] = useState<CPUTeamRoster>({});

    // Bottom panel
    const [panelVisible, setPanelVisible] = useState(true);
    const [activeTab, setActiveTab] = useState<'queue' | 'roster'>('queue');

    // Player data - FIXED: Use single source of truth
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [queue, setQueue] = useState<Player[]>([]);
    const [myRoster, setMyRoster] = useState<MyRoster>({
        QB: [], RB: [], WR: [], TE: [], FLEX: [], BENCH: []
    });

    // AI suggestions
    const [suggestions, setSuggestions] = useState<{
        primary?: Suggestion;
        alternates?: Suggestion[];
    } | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Calculate next pick
    const nextPick = useMemo(() => picks.length + 1, [picks]);

    // Update pick ref when picks change
    useEffect(() => {
        if (mode === 'live') return; // Temporarily disable all effects in live mode
        currentPickRef.current = picks.length + 1;
        log(`📊 Updated currentPickRef to: ${currentPickRef.current} (total picks: ${picks.length})`);
    }, [picks]);

    // CRITICAL FIX: Calculate available players with better debugging
    const availablePlayers = useMemo(() => {
        // Safety check: ensure allPlayers is an array
        if (!Array.isArray(allPlayers)) {
            if (DEBUG) warn('⚠️ allPlayers is not an array:', allPlayers);
            return [];
        }

        const draftedPlayerNames = new Set(picks.map(pick => pick.player).filter(Boolean));
        // Only log this in debug mode and less frequently
        if (DEBUG && picks.length % 5 === 0) { // Only log every 5 picks
            log(`📊 Total players: ${allPlayers.length}, Picks made: ${picks.length}`);
        }

        return allPlayers.filter(player => !draftedPlayerNames.has(player.name));
    }, [allPlayers, picks]);

    // FIXED: Filter available players based on search and position with safety check
    const filteredPlayers = useMemo(() => {
        // Safety check: ensure availablePlayers is an array
        if (!Array.isArray(availablePlayers)) {
            warn('⚠️ availablePlayers is not an array:', availablePlayers);
            return [];
        }

        let filtered = availablePlayers;

        if (searchQuery) {
            filtered = filtered.filter(player =>
                player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                player.team.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (selectedPosition !== 'ALL') {
            if (selectedPosition === 'FLEX') {
                filtered = filtered.filter(player => ['RB', 'WR', 'TE'].includes(player.position));
            } else {
                filtered = filtered.filter(player => player.position === selectedPosition);
            }
        }

        return filtered;
    }, [availablePlayers, searchQuery, selectedPosition]);

    // Get team from pick number (snake order)
    const getTeamFromPick = useCallback((pickNumber: number) => {
        const round = Math.ceil(pickNumber / leagueSize);
        const positionInRound = ((pickNumber - 1) % leagueSize) + 1;

        // Snake draft: odd rounds go 1->12, even rounds go 12->1
        if (round % 2 === 1) {
            return positionInRound;
        } else {
            return leagueSize - positionInRound + 1;
        }
    }, [leagueSize]);

    // Initialize CPU team rosters
    useEffect(() => {
        if (mode === 'live') return; // Temporarily disable all effects in live mode

        const initCpuRosters = () => {
            const rosters: CPUTeamRoster = {};
            for (let i = 1; i <= leagueSize; i++) {
                if (i !== userTeamPosition) {
                    rosters[i] = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [], BENCH: [] };
                }
            }
            log('🤖 Initialized CPU team rosters:', rosters);
            setCpuRosters(rosters);
        };

        // Only initialize if we have a valid league size and user position
        if (leagueSize > 0 && userTeamPosition) {
            initCpuRosters();
        }
    }, [leagueSize, userTeamPosition, mode]);

    // Update CPU roster helper
    const updateCPURoster = useCallback((teamNum: number, player: Player) => {
        setCpuRosters(prev => {
            const updated = { ...prev };
            if (updated[teamNum]) {
                // Map player position to valid roster position
                const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;
                type ValidPosition = typeof validPositions[number] | 'BENCH';
                const position: ValidPosition = validPositions.includes(player.position as any) ?
                    player.position as ValidPosition : 'BENCH';

                updated[teamNum] = {
                    ...updated[teamNum],
                    [position]: [...(updated[teamNum][position] || []), player.name]
                };
                log(`📊 Updated CPU Team ${teamNum} roster:`, updated[teamNum]);
            }
            return updated;
        });
    }, []);

    // WORKFLOW STEP 1: CPU Team Analysis
    const analyzeCPUTeamNeeds = useCallback((teamNumber: number): string[] => {
        const roster = cpuRosters[teamNumber];
        if (!roster) return ['RB', 'WR']; // Default needs

        const round = Math.ceil(currentPickRef.current / leagueSize);
        const needs: string[] = [];

        // Early rounds: focus on RB/WR
        if (round <= 3) {
            if (roster.RB.length === 0) needs.push('RB');
            if (roster.WR.length <= 1) needs.push('WR');
        }
        // Mid rounds: fill starters
        else if (round <= 8) {
            if (roster.QB.length === 0) needs.push('QB');
            if (roster.RB.length <= 1) needs.push('RB');
            if (roster.WR.length <= 2) needs.push('WR');
            if (roster.TE.length === 0) needs.push('TE');
        }
        // Late rounds: depth and sleepers
        else {
            if (roster.QB.length === 0) needs.push('QB');
            if (roster.TE.length === 0) needs.push('TE');
            needs.push('RB', 'WR'); // Always consider RB/WR depth
        }

        log(`🎯 CPU Team ${teamNumber} needs (Round ${round}):`, needs);
        return needs;
    }, [cpuRosters, leagueSize]);

    // WORKFLOW STEP 2: CPU Pick Logic - FIXED to use current data
    const executeCPUPick = useCallback((teamNumber: number) => {
        const currentPick = currentPickRef.current;
        log(`🤖 CPU Team ${teamNumber} executing pick ${currentPick}...`);

        // CRITICAL: Use refs to get CURRENT state, not stale closure
        const currentPicks = picksRef.current;
        const currentAllPlayers = allPlayersRef.current;

        // Check available players using current data
        const draftedPlayerNames = new Set(currentPicks.map(pick => pick.player).filter(Boolean));
        const availablePlayers = currentAllPlayers.filter(player => !draftedPlayerNames.has(player.name));

        log(`📊 CPU sees: ${availablePlayers.length} available (total: ${currentAllPlayers.length}, drafted: ${draftedPlayerNames.size})`);
        log(`🔍 Drafted players: [${Array.from(draftedPlayerNames).join(', ')}]`);

        if (availablePlayers.length === 0) {
            log('❌ CPU: No available players left');
            return null;
        }

        // Get team needs and filter players
        const needs = analyzeCPUTeamNeeds(teamNumber);
        const topAvailable = availablePlayers
            .filter(p => p.adp && p.adp < 200)
            .sort((a, b) => (a.adp || 999) - (b.adp || 999))
            .slice(0, 5);

        log(`🎲 CPU top 5:`, topAvailable.map(p => `${p.name} (${p.position}, ADP: ${p.adp})`));

        // Pick based on positional needs if possible
        let selectedPlayer = topAvailable.find(p => needs.includes(p.position));

        // If no positional needs met, take best available
        if (!selectedPlayer) {
            selectedPlayer = topAvailable[0];
        }

        if (selectedPlayer) {
            log(`✅ CPU Team ${teamNumber} selects: ${selectedPlayer.name}`);
            return selectedPlayer;
        } else {
            log('❌ CPU: No suitable players found');
            return null;
        }
    }, [analyzeCPUTeamNeeds]);

    // WORKFLOW STEP 3: Core Draft Function - handles all picks
    const draftPlayer = useCallback((player: Player) => {
        log(`🎨 Draft attempt: ${player.name} for Team ${currentTeamRef.current}`);

        if (pickingRef.current) {
            log('⚠️ Pick already in progress, ignoring...');
            return;
        }

        const teamMakingPick = currentTeamRef.current;
        const currentPickNumber = currentPickRef.current;

        // Check if this player has already been drafted
        const alreadyDrafted = picks.some(pick => pick.player === player.name);
        if (alreadyDrafted) {
            log(`❌ ${player.name} has already been drafted, ignoring...`);
            return;
        }

        // Validate we have a valid team and pick number
        if (!teamMakingPick || !currentPickNumber) {
            log('❌ Invalid draft state, ignoring pick');
            return;
        }

        // Set picking flag
        pickingRef.current = true;
        setIsPicking(true);

        log(`🏈 DRAFTING: ${player.name} → Team ${teamMakingPick} (Pick ${currentPickNumber})`);

        // Create the new pick
        const newPick: DraftPick = {
            pick: currentPickNumber,
            round: Math.ceil(currentPickNumber / leagueSize),
            player: player.name,
            position: player.position,
            team: teamMakingPick.toString(),
            sleeper_id: player.sleeper_id // Add this line!
        };

        // Update picks array
        setPicks(prev => {
            const existingPickAtSlot = prev.find(p => p.pick === currentPickNumber);
            const existingPlayerPick = prev.find(p => p.player === player.name);

            if (existingPickAtSlot || existingPlayerPick) {
                log(`⚠️ Duplicate detected, ignoring...`);
                pickingRef.current = false;
                setIsPicking(false);
                return prev;
            }

            const newPicks = [...prev, newPick];
            log(`📋 BOARD UPDATED: Pick ${currentPickNumber} → ${player.name} (Total: ${newPicks.length})`);
            return newPicks;
        });

        // Update rosters
        if (teamMakingPick === userTeamPosition) {
            setMyRoster(prev => assignPlayerToRoster(player, prev));
            setQueue(prev => prev.filter(p => p.name !== player.name));
            log(`👤 USER ROSTER: Added ${player.name}`);
        } else {
            updateCPURoster(teamMakingPick, player);
            log(`🤖 CPU ROSTER: Team ${teamMakingPick} added ${player.name}`);
        }

        // Clear timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // WORKFLOW STEP 4: Advance to next pick
        const newNextPick = currentPickNumber + 1;
        const newTeam = getTeamFromPick(newNextPick);

        log(`➡️ ADVANCING: Pick ${currentPickNumber} → Pick ${newNextPick} (Team ${newTeam})`);

        // Update refs and state
        currentTeamRef.current = newTeam;
        currentPickRef.current = newNextPick;
        pickingRef.current = false;
        setIsPicking(false);

        // Set timer BEFORE setting currentTeamOnClock to prevent race condition
        if (newTeam === userTeamPosition) {
            setTimeRemaining(pickTimer);
        } else {
            setTimeRemaining(0);
        }

        setCurrentTeamOnClock(newTeam);

        // WORKFLOW STEP 5: Continue draft flow
        setTimeout(() => {
            if (!draftActiveRef.current || pausedRef.current) {  // ← Use ref instead of state
                log('🛑 Draft stopped or paused');
                return;
            }

            // Check if draft is complete
            if (newNextPick > leagueSize * rounds) {
                log('🎉 Draft complete!');
                setIsDrafting(false);
                draftActiveRef.current = false;
                return;
            }

            // WORKFLOW STEP 6: Determine next picker
            if (newTeam === userTeamPosition) {
                log(`👤 USER TURN: Team ${userTeamPosition} is on the clock`);
                setTimeout(() => fetchUserSuggestions(), 100);
            } else {
                log(`🤖 CPU TURN: Team ${newTeam} is on the clock`);
                setSuggestions(null);
                // WORKFLOW STEP 7: Trigger next CPU pick
                setTimeout(() => {
                    if (!pausedRef.current && draftActiveRef.current) {
                        processCPUTurn(newTeam);
                    } else {
                        log(`❌ CPU pick timeout cancelled: paused=${pausedRef.current}, active=${draftActiveRef.current}`);
                    }
                }, 1000);
            }
        }, 300);

    }, [userTeamPosition, leagueSize, isPaused, pickTimer, getTeamFromPick, updateCPURoster, rounds, picks]);

    // WORKFLOW STEP 7: Process CPU Turn
    const processCPUTurn = useCallback((teamNumber: number) => {
        log(`🎬 PROCESSING CPU TURN: Team ${teamNumber}`);

        // Enhanced validation checks
        if (!draftActiveRef.current) {
            log(`❌ CPU turn cancelled: draft not active`);
            return;
        }

        if (pausedRef.current) {
            log(`❌ CPU turn cancelled: draft is paused`);
            return;
        }

        if (pickingRef.current) {
            log(`❌ CPU turn cancelled: pick already in progress`);
            return;
        }

        if (currentTeamRef.current !== teamNumber) {
            log(`❌ CPU turn cancelled: wrong team (expected ${teamNumber}, current ${currentTeamRef.current})`);
            return;
        }

        try {
            // Execute CPU pick logic
            const selectedPlayer = executeCPUPick(teamNumber);

            if (selectedPlayer) {
                log(`✅ CPU SELECTION: Team ${teamNumber} → ${selectedPlayer.name}`);
                draftPlayer(selectedPlayer);
            } else {
                log(`❌ CPU FAILED: Team ${teamNumber} couldn't select a player`);
            }
        } catch (err) {
            error(`❌ CPU ERROR: Team ${teamNumber}:`, err);
        }
    }, [executeCPUPick, draftPlayer]);

    // Force CPU pick (used for draft start)
    const forceCPUPick = useCallback(async (teamNumber: number) => {
        log(`🔥 FORCE CPU PICK: Team ${teamNumber}`);

        if (pickingRef.current) {
            log('⚠️ Pick already in progress, skipping force pick');
            return;
        }

        // Force draft to be active
        if (!draftActiveRef.current) {
            log('⚠️ Forcing draft active');
            draftActiveRef.current = true;
            setIsDrafting(true);
        }

        // Use the same CPU processing logic
        processCPUTurn(teamNumber);
    }, [processCPUTurn]);

    // Complete reset function
    const resetEverything = useCallback(() => {
        log('🔄 Resetting everything...');

        // Clear timers
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // Reset all state
        setPicks([]);
        setIsDrafting(false);
        setIsPaused(false);
        setCurrentTeamOnClock(1);
        setTimeRemaining(0);
        setMyRoster({ QB: [], RB: [], WR: [], TE: [], FLEX: [], BENCH: [] });
        setQueue([]);
        setSuggestions(null);
        setCpuRosters({});
        pickingRef.current = false;
        draftActiveRef.current = false; // Reset the ref
        currentPickRef.current = 1; // Reset pick ref
        setIsPicking(false); // Reset state too

        log('✅ Reset complete');
    }, []);

    // Reset board when switching modes
    const switchMode = (newMode: 'live' | 'mock') => {
        log(`🔄 Switching from ${mode} to ${newMode} mode`);
        resetEverything();
        setMode(newMode);
    };

    // Handle new Sleeper pick with proper player name resolution
    const [processingPicks, setProcessingPicks] = useState<Set<number>>(new Set());

    async function handleSleeperPick(sleeperPick: any) {
        const pickNumber = sleeperPick.pick_no;

        // Prevent duplicate processing
        if (processingPicks.has(pickNumber)) {
            log(`⚠️ Pick ${pickNumber} already being processed, skipping...`);
            return;
        }

        // Check if pick already exists
        const existingPick = picks.find(p => p.pick === pickNumber);
        if (existingPick) {
            log(`⚠️ Pick ${pickNumber} already exists, skipping...`);
            return;
        }

        // Mark as processing
        setProcessingPicks(prev => {
            const newSet = new Set(prev);
            newSet.add(pickNumber);
            return newSet;
        });

        log('📥 New Sleeper pick:', sleeperPick);

        try {
            // Get player name from Sleeper API
            const sleeperPlayer = await getPlayerById(sleeperPick.player_id);
            const playerName = sleeperPlayer?.full_name ||
                (sleeperPlayer ? `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` :
                    sleeperPick.metadata?.player_name ||
                    `Player ${sleeperPick.player_id}`);

            const newPick: DraftPick = {
                pick: sleeperPick.pick_no,
                round: Math.ceil(sleeperPick.pick_no / leagueSize),
                player: playerName,
                position: sleeperPlayer?.position || sleeperPick.metadata?.position,
                team: sleeperPlayer?.team || sleeperPick.metadata?.team,
                sleeper_id: sleeperPick.player_id // Add this line
            };

            log('✅ Resolved Sleeper pick:', newPick);
            setPicks(prev => {
                // Double-check that the pick doesn't already exist
                const exists = prev.find(p => p.pick === newPick.pick);
                if (exists) {
                    log(`⚠️ Pick ${newPick.pick} already exists in state, skipping...`);
                    return prev;
                }
                return [...prev, newPick].sort((a, b) => a.pick - b.pick);
            });
        } catch (error: any) {
            console.error('❌ Error resolving Sleeper pick:', error);
            // Fallback with player ID
            const newPick: DraftPick = {
                pick: sleeperPick.pick_no,
                round: Math.ceil(sleeperPick.pick_no / leagueSize),
                player: `Player ${sleeperPick.player_id}`,
                position: sleeperPick.metadata?.position,
                team: sleeperPick.metadata?.team,
                sleeper_id: sleeperPick.player_id // Add this line
            };
            setPicks(prev => {
                const exists = prev.find(p => p.pick === newPick.pick);
                if (exists) return prev;
                return [...prev, newPick].sort((a, b) => a.pick - b.pick);
            });
        } finally {
            // Remove from processing set
            setProcessingPicks(prev => {
                const newSet = new Set(prev);
                newSet.delete(pickNumber);
                return newSet;
            });
        }
    }

    // Load players data - FIX: Extract data.data instead of data
    useEffect(() => {
        if (mode === 'live') return; // Temporarily disable all effects in live mode

        const loadPlayers = async () => {
            try {
                log('📊 Loading players from API...');
                const response = await fetch('/api/draft/players-adp');

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                log('🔍 API response structure:', result);

                // FIX: Extract the actual data array from the response
                const data = result.data || result; // Handle both {data: [...]} and [...] formats
                log(`📊 Loaded ${data?.length || 0} players with ADP data`);

                // Safety check: ensure data is an array
                if (Array.isArray(data)) {
                    setAllPlayers(data);
                    log('✅ Successfully set players data');
                } else {
                    error('❌ API returned non-array data:', result);
                    setAllPlayers([]); // Fallback to empty array
                }

                setLoadingPlayers(false);
            } catch (error: any) {
                error('Failed to load players:', error);
                // Fallback with mock data
                const mockPlayers: Player[] = [
                    { name: "Ja'Marr Chase", position: "WR", team: "CIN", adp: 1.02 },
                    { name: "Saquon Barkley", position: "RB", team: "PHI", adp: 1.02 },
                    { name: "Bijan Robinson", position: "RB", team: "ATL", adp: 1.04 },
                    { name: "Justin Jefferson", position: "WR", team: "MIN", adp: 1.01 },
                    { name: "Breece Hall", position: "RB", team: "NYJ", adp: 1.05 }
                ];
                setAllPlayers(mockPlayers);
                setLoadingPlayers(false);
            }
        };

        loadPlayers();
    }, [mode]);

    // Mock draft timer - FIXED with proper dependencies
    useEffect(() => {
        if (mode === 'live') return; // Temporarily disable all effects in live mode

        log('⏰ Timer effect:', { isDrafting, isPaused, currentTeamOnClock, userTeamPosition, timeRemaining });

        if (isDrafting && currentTeamOnClock === userTeamPosition && timeRemaining > 0 && !isPaused) {
            log('🕐 Starting timer countdown...');
            timerRef.current = setTimeout(() => {
                setTimeRemaining(prev => {
                    log(`⏱️ Timer tick: ${prev - 1}`);
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            };
        } else if (timeRemaining === 0 && isDrafting && !isPaused && currentTeamOnClock === userTeamPosition && !pickingRef.current) {
            log('⏰ Timer expired - auto picking...', {
                timeRemaining,
                isDrafting,
                isPaused,
                currentTeamOnClock,
                userTeamPosition,
                pickingInProgress: pickingRef.current
            });
            autoPickForUser();
        } else if (timeRemaining === 0) {
            log('⏰ Timer at 0 but conditions not met:', {
                timeRemaining,
                isDrafting,
                isPaused,
                currentTeamOnClock,
                userTeamPosition,
                pickingInProgress: pickingRef.current
            });
        }
    }, [timeRemaining, isDrafting, isPaused, currentTeamOnClock, userTeamPosition]);

    // Auto-pick for user when timer expires
    const autoPickForUser = useCallback(() => {
        log('⏰ Auto-pick check:', {
            pickingInProgress: pickingRef.current,
            availablePlayersCount: availablePlayers.length,
            filteredPlayersCount: filteredPlayers.length,
            searchQuery,
            selectedPosition
        });

        if (pickingRef.current) {
            log('❌ Auto-pick blocked: picking already in progress');
            // Force reset if picking has been stuck for too long
            setTimeout(() => {
                if (pickingRef.current) {
                    log('⚠️ Force resetting stuck picking state');
                    pickingRef.current = false;
                    setIsPicking(false);
                }
            }, 2000);
            return;
        }

        if (!availablePlayers.length) {
            log('❌ Auto-pick blocked: no available players');
            return;
        }

        // Use availablePlayers instead of filteredPlayers for auto-pick
        // This ensures we always have players available even if filters are applied
        const topPlayer = availablePlayers[0];
        log('⏰ Auto-picking for user:', topPlayer.name);
        draftPlayer(topPlayer);
    }, [availablePlayers, filteredPlayers, draftPlayer, searchQuery, selectedPosition]);

    // Mock draft functions
    const startMockDraft = useCallback(() => {
        log('🚀 STARTING MOCK DRAFT WORKFLOW');

        // Clear timers
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // Reset everything
        resetEverything();

        // Set up draft state
        setIsDrafting(true);
        setIsPaused(false);
        pausedRef.current = false;  // ← Set ref immediately
        setCurrentTeamOnClock(1);
        setTimeRemaining(0);

        // Update refs
        draftActiveRef.current = true;
        currentTeamRef.current = 1;
        currentPickRef.current = 1;
        pickingRef.current = false;

        // Initialize CPU rosters
        const rosters: CPUTeamRoster = {};
        for (let i = 1; i <= leagueSize; i++) {
            if (i !== userTeamPosition) {
                rosters[i] = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [], BENCH: [] };
            }
        }
        setCpuRosters(rosters);

        log(`👤 USER TEAM: ${userTeamPosition}`);
        log(`🤖 CPU TEAMS: ${Object.keys(rosters).join(', ')}`);

        // Start the draft workflow - SET TIMER FIRST to prevent race condition
        if (userTeamPosition === 1) {
            log(`👤 USER STARTS: Team ${userTeamPosition} has first pick`);
            setTimeRemaining(pickTimer); // Set timer BEFORE activating draft
            setTimeout(() => fetchUserSuggestions(), 100);
        } else {
            // Use ref instead of state for immediate check
            setTimeout(() => {
                log(`📊 DRAFT WORKFLOW: Starting with Team 1`);
                log(`🔍 Draft state check: paused=${pausedRef.current}, active=${draftActiveRef.current}`);

                if (!pausedRef.current && draftActiveRef.current) {  // ← Use refs instead of state
                    log(`🤖 CPU STARTS: Team 1 has first pick (user is team ${userTeamPosition})`);
                    forceCPUPick(1);
                } else {
                    log(`❌ CPU start cancelled: paused=${pausedRef.current}, active=${draftActiveRef.current}`);
                }
            }, 100);
        }
    }, [userTeamPosition, leagueSize, pickTimer, forceCPUPick]);

    const pauseDraft = () => {
        log('⏸️ Pausing draft...');
        setIsPaused(true);
        pausedRef.current = true;
        setTimeRemaining(0);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const resumeDraft = () => {
        log('▶️ Resuming draft...');
        setIsPaused(false);
        pausedRef.current = false;

        // Force the draft to be active
        draftActiveRef.current = true;

        if (currentTeamRef.current === userTeamPosition) {
            log(`👤 Resuming USER turn: Team ${userTeamPosition}`);
            setTimeRemaining(pickTimer);
            fetchUserSuggestions();
        } else {
            log(`🤖 Resuming CPU turn: Team ${currentTeamRef.current}`);
            // Continue CPU workflow immediately
            setTimeout(() => {
                if (!pausedRef.current && draftActiveRef.current) {
                    log(`🔥 Continuing CPU workflow for team ${currentTeamRef.current}`);
                    processCPUTurn(currentTeamRef.current);
                }
            }, 100);
        }
    };

    const endDraft = () => {
        log('🛑 Ending draft...');
        draftActiveRef.current = false;
        resetEverything();
    };

    // Add a state for picking status (for UI reactivity)
    // const [isPicking, setIsPicking] = useState(false); // This state is now managed by the useMemo hook

    // Core draft function - FIXED to prevent duplicate picks and state corruption
    const addToRoster = (player: Player) => {
        log(`➕ Adding ${player.name} to user roster`);
        setMyRoster(prev => {
            const updated = { ...prev };

            if (player.position === 'QB' && updated.QB.length === 0) {
                updated.QB.push(player);
            } else if (player.position === 'RB' && updated.RB.length < 2) {
                updated.RB.push(player);
            } else if (player.position === 'WR' && updated.WR.length < 2) {
                updated.WR.push(player);
            } else if (player.position === 'TE' && updated.TE.length === 0) {
                updated.TE.push(player);
            } else if ((player.position === 'RB' || player.position === 'WR' || player.position === 'TE') && updated.FLEX.length === 0) {
                updated.FLEX.push(player);
            } else {
                updated.BENCH.push(player);
            }

            return updated;
        });
    };

    const fetchUserSuggestions = async () => {
        if (!isDrafting || isPaused) return;

        setLoadingSuggestions(true);
        try {
            const response = await fetch('/api/draft/assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    league: {
                        size: leagueSize,
                        format: 'PPR',
                        roster: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1, FLEX: 1, BENCH: 7 }
                    },
                    draft: {
                        pickOverall: nextPick,
                        round: Math.ceil(nextPick / leagueSize),
                        board: picks.map(p => ({ pick: p.pick, playerId: p.player || '' }))
                    },
                    myTeam: {
                        roster: Object.values(myRoster).flat().map(p => ({ playerId: p.name, position: p.position })),
                        needs: ['RB', 'WR']
                    },
                    constraints: { maxReach: 12 }
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.suggestions || null);
            }
        } catch (error: any) {
            error('Failed to fetch suggestions:', error);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const addToQueue = (player: Player) => {
        setQueue(prev => prev.find(p => p.name === player.name) ? prev : [...prev, player]);
    };

    const removeFromQueue = (playerName: string) => {
        setQueue(prev => prev.filter(p => p.name !== playerName));
    };

    const getTierColor = (adp: number) => {
        if (adp <= 12) return 'text-purple-400';
        if (adp <= 36) return 'text-blue-400';
        if (adp <= 72) return 'text-green-400';
        if (adp <= 120) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'];

    // Sleeper draft integration - FIX: Add missing isMonitoring
    const {
        sleeperDraftUrl: monitoredUrl,
        sleeperDraftId,
        isMonitoring,
        lastPickCount,
        draftInfo,
        error: sleeperError, // This is correct
        handleUrlChange,
        toggleMonitoring
    } = useSleeperDraftMonitor({
        onNewPick: handleSleeperPick,
        pollInterval: 5000 // Increase from 3000ms to 5000ms (5 seconds)
    });

    // Add refs to store current values for CPU functions
    const picksRef = useRef<DraftPick[]>([]);
    const allPlayersRef = useRef<Player[]>([]);

    // Update refs when state changes
    useEffect(() => {
        picksRef.current = picks;
    }, [picks]);

    useEffect(() => {
        allPlayersRef.current = allPlayers;
    }, [allPlayers]);

    // Create a player name to sleeper_id mapping for faster lookups
    const playerNameMap = useMemo(() => {
        const map = new Map();
        allPlayers.forEach(player => {
            if (player.sleeper_id) {
                // Store multiple variations of the name
                const normalizeStr = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();

                map.set(player.name.toLowerCase(), player.sleeper_id);
                map.set(normalizeStr(player.name), player.sleeper_id);

                // Also try without middle initials, etc.
                const nameParts = player.name.split(' ');
                if (nameParts.length >= 2) {
                    const firstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`.toLowerCase();
                    map.set(firstLast, player.sleeper_id);
                }
            }
        });
        return map;
    }, [allPlayers]);

    const [teamNames, setTeamNames] = useState<Record<number, string>>({});

    useEffect(() => {
        if (DISABLE_LIVE_SYNC) return; // Temporary disable

        const fetchTeamNamesAndUserPosition = async () => {
            if (mode === 'live' && draftInfo?.league_id) {
                try {
                    const { getDraftSlotToTeamNameMap } = await import('@/lib/sleeper/draftUtils');
                    const nameMap = await getDraftSlotToTeamNameMap(draftInfo.league_id);
                    setTeamNames(nameMap);

                    // TODO: Implement user team detection
                    // This would require knowing the current user's Sleeper user_id
                    // and matching it to a roster in the league
                    // For now, user will need to manually identify their team in live mode

                } catch (error: any) {
                    error('Failed to fetch team names:', error);
                }
            } else {
                setTeamNames({});
                if (mode === 'live') {
                    setUserTeamPosition(null);
                }
            }
        };

        fetchTeamNamesAndUserPosition();
    }, [mode, draftInfo?.league_id]);

    useEffect(() => {
        if (DISABLE_LIVE_SYNC) return; // Temporary disable

        if (mode === 'live' && draftInfo) {
            // Auto-sync league settings from Sleeper
            if (draftInfo.settings) {
                // Only update if values are different to prevent infinite loops
                if (draftInfo.settings.teams !== leagueSize) {
                    setLeagueSize(draftInfo.settings.teams);
                }
                if (draftInfo.settings.rounds !== rounds) {
                    setRounds(draftInfo.settings.rounds);
                }
            }
        }
    }, [mode, draftInfo, leagueSize, rounds]); // Add current values to dependencies

    const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<string | null>(null);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Settings Panel - Compact Header Row */}
            <div className="px-4 py-2 border-b border-white/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <h3 className="text-sm font-normal" style={{ fontFamily: 'Consolas, monospace' }}>
                            [draft settings]
                        </h3>

                        <div className="flex space-x-2">
                            <button
                                onClick={() => switchMode('live')}
                                className={`px-3 py-1 border text-sm ${mode === 'live' ? 'bg-white text-black' : 'bg-black text-white border-white'}`}
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                track live draft
                            </button>
                            <button
                                onClick={() => switchMode('mock')}
                                className={`px-3 py-1 border text-sm ${mode === 'mock' ? 'bg-white text-black' : 'bg-black text-white border-white'}`}
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                mock draft
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <div>
                            <label className="block text-xs mb-1" style={{ fontFamily: 'Consolas, monospace' }}>league size</label>
                            <select
                                value={leagueSize}
                                onChange={(e) => setLeagueSize(parseInt(e.target.value))}
                                className="bg-black border border-white text-white px-2 py-1 text-sm"
                                style={{ fontFamily: 'Consolas, monospace' }}
                                disabled={isDrafting || isMonitoring || (mode === 'live' && !!draftInfo?.settings)}
                            >
                                <option value={8}>8</option>
                                <option value={10}>10</option>
                                <option value={12}>12</option>
                                <option value={14}>14</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs mb-1" style={{ fontFamily: 'Consolas, monospace' }}>rounds</label>
                            <select
                                value={rounds}
                                onChange={(e) => setRounds(parseInt(e.target.value))}
                                className="bg-black border border-white text-white px-2 py-1 text-sm"
                                style={{ fontFamily: 'Consolas, monospace' }}
                                disabled={isDrafting || isMonitoring || (mode === 'live' && !!draftInfo?.settings)}
                            >
                                <option value={13}>13</option>
                                <option value={14}>14</option>
                                <option value={15}>15</option>
                                <option value={16}>16</option>
                                <option value={17}>17</option>
                            </select>
                        </div>

                        {mode === 'mock' && (
                            <div>
                                <label className="block text-xs mb-1" style={{ fontFamily: 'Consolas, monospace' }}>pick timer</label>
                                <select
                                    value={pickTimer}
                                    onChange={(e) => setPickTimer(parseInt(e.target.value))}
                                    className="bg-black border border-white text-white px-2 py-1 text-sm"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                    disabled={isDrafting}
                                >
                                    <option value={15}>15s</option>
                                    <option value={30}>30s</option>
                                    <option value={60}>1m</option>
                                    <option value={120}>2m</option>
                                </select>
                            </div>
                        )}

                        {mode === 'live' && draftInfo?.settings && (
                            <div>
                                <label className="block text-xs mb-1" style={{ fontFamily: 'Consolas, monospace' }}>pick timer</label>
                                <div className="bg-black border border-white text-green-400 px-2 py-1 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                                    {draftInfo.settings.pick_timer}s
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Live Draft URL Input - Second Row for Live Mode */}
                {mode === 'live' && (
                    <div className="mt-2 flex items-center gap-4">
                        <label className="text-xs" style={{ fontFamily: 'Consolas, monospace' }}>
                            sleeper draft url:
                        </label>
                        <div className="flex gap-2 flex-1">
                            <input
                                type="text"
                                placeholder="https://sleeper.app/draft/nfl/..."
                                value={monitoredUrl}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                className="flex-1 bg-black border border-white text-white px-2 py-1 text-sm"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            />
                            <button
                                onClick={toggleMonitoring}
                                disabled={!sleeperDraftId}
                                className={`px-3 py-1 border text-sm ${isMonitoring
                                    ? 'bg-red-600 text-white border-red-500'
                                    : 'bg-green-600 text-white border-green-500'
                                    } disabled:bg-gray-600 disabled:border-gray-500`}
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                {isMonitoring ? 'stop' : 'start'}
                            </button>
                        </div>
                        {draftInfo && (
                            <div className="text-green-400 text-xs" style={{ fontFamily: 'Consolas, monospace' }}>
                                connected: {draftInfo.settings?.teams} teams
                            </div>
                        )}
                    </div>
                )}

                {/* Draft Controls - Second Row for Mock Mode */}
                {mode === 'mock' && (
                    <div className="mt-2 flex items-center justify-between">
                        {!isDrafting ? (
                            <button
                                onClick={startMockDraft}
                                className="bg-green-600 text-white px-4 py-2 border border-green-500 hover:bg-green-700 text-sm"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                start mock draft
                            </button>
                        ) : (
                            <>
                                <div className="flex items-center space-x-4">
                                    <div className="text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                                        Team {currentTeamOnClock} on the clock
                                        {isPaused && <span className="text-yellow-400 ml-2">[paused]</span>}
                                    </div>
                                    {isDrafting && currentTeamOnClock === userTeamPosition && timeRemaining > 0 && !isPaused && (
                                        <div className="flex items-center space-x-2">
                                            <Clock size={16} className="text-yellow-400" />
                                            <div className="text-lg font-bold text-yellow-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {!isPaused ? (
                                        <button
                                            onClick={pauseDraft}
                                            className="bg-yellow-600 text-white px-3 py-1 border border-yellow-500 hover:bg-yellow-700 flex items-center gap-1 text-sm"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            <Pause size={14} />
                                            pause
                                        </button>
                                    ) : (
                                        <button
                                            onClick={resumeDraft}
                                            className="bg-green-600 text-white px-3 py-1 border border-green-500 hover:bg-green-700 text-sm"
                                            style={{ fontFamily: 'Consolas, monospace' }}
                                        >
                                            resume
                                        </button>
                                    )}
                                    <button
                                        onClick={endDraft}
                                        className="bg-red-600 text-white px-3 py-1 border border-red-500 hover:bg-red-700 flex items-center gap-1 text-sm"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        <Square size={14} />
                                        end
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {sleeperError && (
                    <div className="mt-2 text-red-400 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                        Error: {sleeperError}
                    </div>
                )}
            </div>

            {/* Draft Board - Full Width, takes remaining space */}
            <div
                className="p-4"
                style={{
                    paddingBottom: panelVisible ? '0' : '4rem',
                    height: panelVisible ? 'calc(100vh - 300px - 50vh)' : 'calc(100vh - 300px)'
                }}
            >
                <div className="bg-black border border-white/20 p-4 h-full">
                    <h3 className="text-lg font-normal mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
                        [draft board]
                    </h3>

                    <SnakeDraftBoard
                        leagueSize={leagueSize}
                        rounds={rounds}
                        picks={picks}
                        userTeamPosition={userTeamPosition}
                        isDrafting={isDrafting}
                        mode={mode}
                        teamNames={teamNames}
                        onManualAssign={(pickNumber, player) => {
                            const newPick: DraftPick = {
                                pick: pickNumber,
                                round: Math.ceil(pickNumber / leagueSize),
                                player: player.name,
                                position: player.position,
                                team: player.team,
                                sleeper_id: player.sleeper_id // Add this line!
                            };
                            setPicks(prev => [...prev.filter(p => p.pick !== pickNumber), newPick]);
                        }}
                        onRemovePlayer={(pickNumber) => {
                            setPicks(prev => prev.filter(p => p.pick !== pickNumber));
                        }}
                        onClaimTeam={(teamNumber) => {
                            setUserTeamPosition(teamNumber);
                        }}
                        onViewPlayer={async (player) => {
                            console.log('View player:', player);

                            if (player.sleeper_id) {
                                setSelectedPlayerForModal(player.sleeper_id);
                                return;
                            }

                            // Fallback: Search Sleeper's player database by name
                            try {
                                const { getPlayerByName } = await import('@/lib/sleeper/fetchAllPlayers');

                                // Try to find the player by name in Sleeper's database
                                const sleeperPlayer = await getPlayerByName(player.player || '');

                                if (sleeperPlayer?.player_id) {
                                    console.log('✅ Found sleeper player:', sleeperPlayer);
                                    setSelectedPlayerForModal(sleeperPlayer.player_id);
                                } else {
                                    console.warn('❌ Player not found in Sleeper database:', player.player);
                                    alert(`Player "${player.player}" not found in Sleeper database. The name might be formatted differently or the player might not be in Sleeper's database.`);
                                }
                            } catch (error: any) {
                                console.error('Error looking up player:', error);
                                alert(`Error looking up player "${player.player}"`);
                            }
                        }}
                    />
                </div>
            </div>

            {/* Console-themed Bottom Panel */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-black border-t border-white/20 transition-transform duration-300 ${panelVisible ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{ height: '50vh' }}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setPanelVisible(!panelVisible)}
                    className="absolute -top-8 right-4 bg-black border border-white/20 border-b-0 p-2 hover:bg-gray-900 text-white"
                >
                    {panelVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>

                <div className="flex h-full">
                    {/* Left: Player List (console themed) */}
                    <div className="flex-1 flex flex-col">
                        {/* Search + Position Filters */}
                        <div className="p-3 border-b border-white/20 bg-black">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="find player ctrl + u"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-black border border-white/20 text-white pl-10 pr-3 py-2 text-sm placeholder-gray-500"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    />
                                </div>
                            </div>

                            {/* Position Buttons (console styled) */}
                            <div className="flex gap-1 items-center">
                                {positions.map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => setSelectedPosition(pos)}
                                        className={`px-3 py-1 text-sm border border-white/20 ${selectedPosition === pos
                                            ? 'bg-white text-black'
                                            : 'bg-black text-white hover:bg-gray-900'
                                            }`}
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        {pos}
                                    </button>
                                ))}
                                <button
                                    className="px-3 py-1 text-sm bg-black text-white hover:bg-gray-900 border border-white/20"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    watchlist
                                </button>
                                <button
                                    className="px-3 py-1 text-sm bg-black text-white hover:bg-gray-900 border border-white/20"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    show drafted
                                </button>
                                <button
                                    className="px-3 py-1 text-sm bg-black text-white hover:bg-gray-900 border border-white/20"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    rookies only
                                </button>

                                {/* Draft Timer - Inline with position buttons */}
                                {isDrafting && !isPaused && (
                                    <div className="ml-4 flex items-center space-x-2 px-3 py-1 bg-black">
                                        <Clock size={14} className="text-yellow-400" />
                                        <div className="text-sm font-bold text-yellow-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {currentTeamOnClock === userTeamPosition && timeRemaining > 0
                                                ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`
                                                : `Team ${currentTeamOnClock}`}
                                        </div>
                                        <div className="text-xs text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {currentTeamOnClock === userTeamPosition && timeRemaining > 0
                                                ? 'Your Turn'
                                                : isPaused
                                                    ? 'Paused'
                                                    : 'CPU Turn'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Player Table Header */}
                        <div className="bg-black border-b border-white/20 px-3 py-2">
                            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium" style={{ fontFamily: 'Consolas, monospace' }}>
                                <div className="col-span-1">+/rk</div>
                                <div className="col-span-4">player</div>
                                <div className="col-span-1">adp</div>
                                <div className="col-span-1">bye</div>
                                <div className="col-span-1">pts</div>
                                <div className="col-span-1">att</div>
                                <div className="col-span-1">yds</div>
                                <div className="col-span-1">td</div>
                                <div className="col-span-1"></div>
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingPlayers ? (
                                <div className="p-4 text-center text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                                    loading players...
                                </div>
                            ) : (
                                <div>
                                    {filteredPlayers.slice(0, 50).map((player, index) => (
                                        <div key={player.name} className="px-3 py-2 hover:bg-gray-900 border-b border-white/10">
                                            <div className="grid grid-cols-12 gap-2 items-center text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                                                <div className="col-span-1 flex items-center gap-1">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => addToQueue(player)}
                                                            className="w-6 h-6 bg-black border border-white/20 hover:bg-gray-900 text-white flex items-center justify-center"
                                                            title="Add to queue"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                        {mode === 'mock' && isDrafting && !isPaused && currentTeamOnClock === userTeamPosition && !isPicking && (
                                                            <button
                                                                onClick={() => {
                                                                    log('📊 Manual pick attempt:', {
                                                                        player: player.name,
                                                                        currentTeam: currentTeamOnClock,
                                                                        userTeam: userTeamPosition,
                                                                        isPicking,
                                                                        pickingRef: pickingRef.current
                                                                    });
                                                                    draftPlayer(player);
                                                                }}
                                                                className="w-6 h-6 bg-green-600 border border-green-500 hover:bg-green-700 text-white flex items-center justify-center"
                                                                title="Manual pick"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-right">
                                                        <span className={`text-xs ${getTierColor(player.adp || 999)}`}>
                                                            {player.pprRank || index + 1}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-span-4">
                                                    <div className={`font-medium ${getPositionColor(player.position)}`}>{player.name}</div>
                                                    <div className={`text-xs ${getPositionColor(player.position)}`}>
                                                        {player.position} • {player.team}
                                                    </div>
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.adp ? player.adp.toFixed(1) : '-'}
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.byeWeek || '-'}
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.projectedPoints?.toFixed(1) || '-'}
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.lastSeasonStats?.rushing?.attempts || player.lastSeasonStats?.receiving?.receptions || player.lastSeasonStats?.passing?.attempts || '-'}
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.lastSeasonStats?.rushing?.yards || player.lastSeasonStats?.receiving?.yards || player.lastSeasonStats?.passing?.yards || '-'}
                                                </div>

                                                <div className="col-span-1 text-xs text-gray-300">
                                                    {player.lastSeasonStats?.rushing?.touchdowns || player.lastSeasonStats?.receiving?.touchdowns || player.lastSeasonStats?.passing?.touchdowns || '-'}
                                                </div>

                                                <div className="col-span-1">
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Tabs (queue/roster only) */}
                    <div className="w-80 border-l border-white/20 flex flex-col">
                        {/* Tab Headers */}
                        <div className="flex border-b border-white/20">
                            {[
                                { id: 'queue', label: 'queue' },
                                { id: 'roster', label: 'roster' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-1 px-4 py-3 text-sm border-r border-white/20 last:border-r-0 ${activeTab === tab.id
                                        ? 'bg-white text-black'
                                        : 'bg-black text-white hover:bg-gray-900'
                                        }`}
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'queue' && (
                                <div className="p-4">
                                    {queue.length === 0 ? (
                                        <div className="text-center text-gray-400 mt-8">
                                            <User size={32} className="mx-auto mb-2 opacity-50" />
                                            <div className="text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                                                empty
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {queue.map(player => (
                                                <div key={player.name} className="flex items-center justify-between p-2 bg-black border border-white/20">
                                                    <div>
                                                        <div className={`text-sm ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                            {player.name}
                                                        </div>
                                                        <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                            {player.position} • {player.team}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromQueue(player.name)}
                                                        className="text-red-400 hover:text-red-300 text-xs"
                                                        style={{ fontFamily: 'Consolas, monospace' }}
                                                    >
                                                        remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'roster' && (
                                <div className="p-4">
                                    {/* QB - 1 slot */}
                                    <div className="mb-4">
                                        <div className={`text-sm font-medium mb-2 pb-1 border-b border-white/20 ${getPositionColor('QB')}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                            [quarterback]
                                        </div>
                                        {myRoster.QB.length > 0 ? (
                                            myRoster.QB.map(player => (
                                                <div key={player.name} className="text-sm mb-1 p-1">
                                                    <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.name}
                                                    </div>
                                                    <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.position} • {player.team}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                [empty]
                                            </div>
                                        )}
                                    </div>

                                    {/* RB - 2 slots */}
                                    <div className="mb-4">
                                        <div className={`text-sm font-medium mb-2 pb-1 border-b border-white/20 ${getPositionColor('RB')}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                            [running back]
                                        </div>
                                        {Array.from({ length: 2 }, (_, i) => {
                                            const player = myRoster.RB[i];
                                            return (
                                                <div key={i} className="text-sm mb-1 p-1">
                                                    {player ? (
                                                        <>
                                                            <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.name}
                                                            </div>
                                                            <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.position} • {player.team}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                            [empty]
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* WR - 2 slots */}
                                    <div className="mb-4">
                                        <div className={`text-sm font-medium mb-2 pb-1 border-b border-white/20 ${getPositionColor('WR')}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                            [wide receiver]
                                        </div>
                                        {Array.from({ length: 2 }, (_, i) => {
                                            const player = myRoster.WR[i];
                                            return (
                                                <div key={i} className="text-sm mb-1 p-1">
                                                    {player ? (
                                                        <>
                                                            <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.name}
                                                            </div>
                                                            <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.position} • {player.team}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                            [empty]
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* TE - 1 slot */}
                                    <div className="mb-4">
                                        <div className={`text-sm font-medium mb-2 pb-1 border-b border-white/20 ${getPositionColor('TE')}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                            [tight end]
                                        </div>
                                        {myRoster.TE.length > 0 ? (
                                            myRoster.TE.map(player => (
                                                <div key={player.name} className="text-sm mb-1 p-1">
                                                    <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.name}
                                                    </div>
                                                    <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.position} • {player.team}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                [empty]
                                            </div>
                                        )}
                                    </div>

                                    {/* FLEX - 1 slot */}
                                    <div className="mb-4">
                                        <div className="text-sm font-medium mb-2 pb-1 border-b border-white/20 text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                            [flex]
                                        </div>
                                        {myRoster.FLEX.length > 0 ? (
                                            myRoster.FLEX.map(player => (
                                                <div key={player.name} className="text-sm mb-1 p-1">
                                                    <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.name}
                                                    </div>
                                                    <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                        {player.position} • {player.team}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                [empty]
                                            </div>
                                        )}
                                    </div>

                                    {/* BENCH - 5 slots */}
                                    <div className="mb-4">
                                        <div className="text-sm font-medium mb-2 pb-1 border-b border-white/20 text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
                                            [bench]
                                        </div>
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const player = myRoster.BENCH[i];
                                            return (
                                                <div key={i} className="text-sm mb-1 p-1">
                                                    {player ? (
                                                        <>
                                                            <div className={`font-medium ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.name}
                                                            </div>
                                                            <div className={`text-xs ${getPositionColor(player.position)}`} style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {player.position} • {player.team}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-gray-500 italic" style={{ fontFamily: 'Consolas, monospace' }}>
                                                            [empty]
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Card Modal */}
            {selectedPlayerForModal && (
                <PlayerCardModal
                    playerId={selectedPlayerForModal}
                    onClose={() => setSelectedPlayerForModal(null)}
                />
            )}
        </div>
    );
}

