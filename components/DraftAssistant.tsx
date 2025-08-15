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
import { projectionService } from '@/lib/services/projectionService';

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

// Each CPU team gets slight tendencies
const teamPersonalities = {
    1: { riskTolerance: 0.8, rbHeavy: true },     // Conservative, RB-focused
    2: { riskTolerance: 1.2, wrHeavy: true },     // Aggressive, WR-focused
    // ...
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

    // USER TURN DETECTION - NEW
    const [aiSuggestions, setAiSuggestions] = useState<Player[]>([]);
    const [showSuggestionReasoning, setShowSuggestionReasoning] = useState(false);

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

        // Sort by pprRank (ascending), with fallback for missing ranks
        return filtered.sort((a, b) => {
            const rankA = a.pprRank || 999;
            const rankB = b.pprRank || 999;
            return rankA - rankB;
        });
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

    // Enhanced CPU Pick Logic
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

        // Get team needs and available players
        const needs = analyzeCPUTeamNeeds(teamNumber);

        // PREVENT DUPLICATE PREMIUM POSITIONS - Check current roster
        const currentRoster = cpuRosters[teamNumber];
        const hasQB = currentRoster?.QB.length > 0;
        const hasTE = currentRoster?.TE.length > 0;
        const hasMinRB = currentRoster?.RB.length >= 2; // Need at least 2 RBs
        const hasMinWR = currentRoster?.WR.length >= 2; // Need at least 2 WRs

        // EARLY ROUND PREMIUM POSITION RESTRICTIONS (Rounds 1-4)
        const currentRound = Math.ceil(currentPick / leagueSize);
        const isEarlyRound = currentRound <= 4;

        // Check what premium positions this team has already drafted in early rounds
        const earlyPicks = currentPicks.filter(pick =>
            pick.team === teamNumber.toString() &&
            Math.ceil(pick.pick / leagueSize) <= 4
        );
        const hasEarlyQB = earlyPicks.some(pick => pick.position === 'QB');
        const hasEarlyTE = earlyPicks.some(pick => pick.position === 'TE');

        // Filter out positions we shouldn't draft again until core is filled
        let topAvailable = availablePlayers
            .filter(p => p.adp && p.adp < 200)
            .filter(p => {
                // EARLY ROUND RESTRICTIONS
                if (isEarlyRound) {
                    // Rule 1: Don't draft second QB in early rounds
                    if (p.position === 'QB' && hasEarlyQB) {
                        log(`🚫 BLOCKED: ${p.name} (QB) - Team ${teamNumber} already has early QB`);
                        return false;
                    }

                    // Rule 2: Don't draft both TE and QB in early rounds
                    if (p.position === 'QB' && hasEarlyTE) {
                        log(`🚫 BLOCKED: ${p.name} (QB) - Team ${teamNumber} already has early TE`);
                        return false;
                    }
                    if (p.position === 'TE' && hasEarlyQB) {
                        log(`🚫 BLOCKED: ${p.name} (TE) - Team ${teamNumber} already has early QB`);
                        return false;
                    }

                    // Rule 3: Don't draft second TE in early rounds
                    if (p.position === 'TE' && hasEarlyTE) {
                        log(`🚫 BLOCKED: ${p.name} (TE) - Team ${teamNumber} already has early TE`);
                        return false;
                    }
                }

                // EXISTING LATE ROUND RESTRICTIONS (Round 5+)
                if (!isEarlyRound) {
                    // Don't draft second QB until very late
                    if (p.position === 'QB' && hasQB) {
                        return false;
                    }
                    // Don't draft second TE until very late  
                    if (p.position === 'TE' && hasTE) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => (a.adp || 999) - (b.adp || 999))
            .slice(0, 8);

        if (topAvailable.length === 0) return null;

        // Check for Brock Bowers
        const brockBowers = topAvailable.find(p => p.name.includes('Brock Bowers'));
        if (brockBowers) {
            let bowersChance = 0;
            if (currentPick === 14) bowersChance = 0.15;
            else if (currentPick >= 15 && currentPick <= 16) bowersChance = 0.30;
            else if (currentPick >= 17 && currentPick <= 18) bowersChance = 0.45;
            else if (currentPick >= 19 && currentPick <= 20) bowersChance = 0.60;
            else if (currentPick >= 21 && currentPick <= 22) bowersChance = 0.70;
            else if (currentPick >= 23 && currentPick <= 25) bowersChance = 0.80;
            else if (currentPick >= 26) bowersChance = 0.95;

            if (currentPick < 14) {
                // TOO EARLY - Remove Bowers from consideration
                topAvailable.splice(topAvailable.indexOf(brockBowers), 1);
                log(`�� BLOCKED: Brock Bowers too early at pick ${currentPick} (min pick 14)`);
            } else if (Math.random() < bowersChance) {
                log(`🎯 HARDCODED: Brock Bowers selected at pick ${currentPick} (${Math.round(bowersChance * 100)}% chance)`);
                return brockBowers;
            }
        }

        // Check for Trey McBride
        const treyMcbride = topAvailable.find(p => p.name.includes('Trey McBride'));
        if (treyMcbride) {
            let mcbrideChance = 0;
            if (currentPick === 23) mcbrideChance = 0.15;
            else if (currentPick >= 24 && currentPick <= 26) mcbrideChance = 0.25;
            else if (currentPick >= 27 && currentPick <= 29) mcbrideChance = 0.35;
            else if (currentPick >= 30 && currentPick <= 33) mcbrideChance = 0.45;
            else if (currentPick >= 34 && currentPick <= 37) mcbrideChance = 0.55;
            else if (currentPick >= 38 && currentPick <= 40) mcbrideChance = 0.75;
            else if (currentPick >= 41) mcbrideChance = 0.95;

            if (currentPick < 23) {
                // TOO EARLY - Remove McBride from consideration
                topAvailable.splice(topAvailable.indexOf(treyMcbride), 1);
                log(`🚫 BLOCKED: Trey McBride too early at pick ${currentPick} (min pick 23)`);
            } else if (Math.random() < mcbrideChance) {
                log(`🎯 HARDCODED: Trey McBride selected at pick ${currentPick} (${Math.round(mcbrideChance * 100)}% chance)`);
                return treyMcbride;
            }
        }

        // Check for George Kittle
        const georgeKittle = topAvailable.find(p => p.name.includes('George Kittle'));
        if (georgeKittle) {
            let kittleChance = 0;
            if (currentPick >= 31 && currentPick <= 33) kittleChance = 0.15;
            else if (currentPick >= 34 && currentPick <= 36) kittleChance = 0.25;
            else if (currentPick >= 37 && currentPick <= 39) kittleChance = 0.40;
            else if (currentPick >= 40 && currentPick <= 42) kittleChance = 0.66;
            else if (currentPick >= 43 && currentPick <= 45) kittleChance = 0.85;
            else if (currentPick >= 46) kittleChance = 0.95;

            if (currentPick < 31) {
                // TOO EARLY - Remove Kittle from consideration
                topAvailable.splice(topAvailable.indexOf(georgeKittle), 1);
                log(`🚫 BLOCKED: George Kittle too early at pick ${currentPick} (min pick 31)`);
            } else if (Math.random() < kittleChance) {
                log(`🎯 HARDCODED: George Kittle selected at pick ${currentPick} (${Math.round(kittleChance * 100)}% chance)`);
                return georgeKittle;
            }
        }

        // If no elite TE was selected, continue with normal logic
        // ... rest of existing candidate selection logic

        // Create weighted selection pools
        let finalCandidates = [];

        // 1. POSITIONAL NEED BONUS (if team has clear needs)
        const needCandidates = topAvailable.filter(p => needs.includes(p.position));

        // 2. VALUE OVERRIDE - Elite players can compete even if not a need
        const round = Math.ceil(currentPickRef.current / leagueSize);


        if (needCandidates.length > 0) {
            // Start with positional needs
            finalCandidates = needCandidates.slice(0, 3);

            // Add elite value players who might be falling
            const valueOverrides = topAvailable.filter(p => {
                const isEliteValue = p.adp && p.adp <= currentPick - 2; // Player falling 2+ picks
                const isNotNeed = !needs.includes(p.position);
                return isEliteValue && isNotNeed;
            });

            if (valueOverrides.length > 0) {
                finalCandidates.push(valueOverrides[0]); // Add best value override
                log(`💎 Value override candidate: ${valueOverrides[0].name} (ADP: ${valueOverrides[0].adp}, Current pick: ${currentPick})`);
            }

            // Fill remaining slots with best available
            const remaining = topAvailable.filter(p => !finalCandidates.includes(p)).slice(0, 1);
            finalCandidates.push(...remaining);
        } else {
            // No clear needs - best available with slight variance
            finalCandidates = topAvailable.slice(0, 5);
        }

        // Ensure we don't exceed 5 candidates
        finalCandidates = finalCandidates.slice(0, 5);

        // 2. CALCULATE DYNAMIC WEIGHTS based on ADP proximity
        const bestADP = finalCandidates[0].adp;
        const weights = finalCandidates.map((player, index) => {
            const adpGap = player.adp - bestADP;

            // Base weight starts high and decreases
            let weight = 100 - (index * 20); // 100, 80, 60, 40, 20

            // ADP proximity bonus (closer ADP = higher weight)
            if (adpGap <= 3) weight += 20;      // Very close tier
            else if (adpGap <= 6) weight += 10; // Close tier
            else if (adpGap <= 12) weight += 5; // Same round tier

            // Round-based variance (early picks more predictable)
            const round = Math.ceil(currentPickRef.current / leagueSize);
            if (round === 1) {
                // Round 1: VERY predictable, elite players shouldn't fall
                if (index === 0 && player.adp <= 6) {
                    weight *= 3.0; // Massive boost for top 6 ADP players in round 1
                } else {
                    weight *= 1.5; // Still boost first option significantly
                }
            } else if (round === 2) {
                weight *= 1.3; // Round 2 still quite predictable
            } else if (round <= 3) {
                weight *= 1.2; // Early rounds more consensus
            } else if (round >= 10) {
                weight *= 0.8; // Late rounds more chaos
            }

            return Math.max(weight, 10); // Minimum 10% chance
        });

        // 3. WEIGHTED RANDOM SELECTION
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const random = Math.random() * totalWeight;

        let runningWeight = 0;
        for (let i = 0; i < finalCandidates.length; i++) {
            runningWeight += weights[i];
            if (random <= runningWeight) {
                const selected = finalCandidates[i];
                log(`🎲 CPU Team ${teamNumber} weighted selection:`, {
                    player: selected.name,
                    position: selected.position,
                    adp: selected.adp,
                    weight: `${Math.round(weights[i] / totalWeight * 100)}%`,
                    candidates: finalCandidates.map(p => p.name)
                });
                return selected;
            }
        }

        // Fallback to first candidate
        return finalCandidates[0];
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

    // Calculate if it's the user's turn
    const isUserTurn = useMemo(() => {
        if (!isDrafting || !userTeamPosition || isPaused) return false;

        if (mode === 'mock') {
            return currentTeamOnClock === userTeamPosition;
        } else if (mode === 'live') {
            // For live drafts, check if current pick corresponds to user's position
            const nextPickNumber = picks.length + 1;
            const round = Math.ceil(nextPickNumber / leagueSize);
            const isSnakeDraft = true; // Assume snake draft

            let positionInRound;
            if (isSnakeDraft && round % 2 === 0) {
                // Even rounds reverse order
                positionInRound = leagueSize - userTeamPosition + 1;
            } else {
                // Odd rounds normal order
                positionInRound = userTeamPosition;
            }

            const expectedPickForUser = (round - 1) * leagueSize + positionInRound;
            return nextPickNumber === expectedPickForUser;
        }

        return false;
    }, [mode, isDrafting, userTeamPosition, currentTeamOnClock, picks.length, leagueSize, isPaused]);

    // Mode switching effect - update user position handling
    useEffect(() => {
        if (mode === 'mock') {
            setUserTeamPosition(1); // Default to position 1 for mock drafts
        } else {
            setUserTeamPosition(null); // Reset for live drafts - user needs to claim
        }

        // Reset other mode-specific state
        setIsDrafting(false);
        setPicks([]);
        setCurrentTeamOnClock(1);
    }, [mode]);

    // AI Suggestion Engine - Calculate which players to bracket
    const calculateAISuggestions = useCallback((): Player[] => {
        // Only show suggestions when it's the user's turn
        if (!isUserTurn || !userTeamPosition || isPaused || !isDrafting) {
            return [];
        }

        const currentRound = Math.ceil(nextPick / leagueSize);

        // Get available players (not drafted)
        const draftedPlayerNames = new Set(picks.map(pick => pick.player).filter(Boolean));
        const availablePlayers = allPlayers.filter(player => !draftedPlayerNames.has(player.name));

        if (availablePlayers.length === 0) return [];

        // 1. VALUE ANALYSIS - Players falling below their ADP
        const valuePickCandidates = availablePlayers.filter(player => {
            if (!player.adp) return false;
            return player.adp < nextPick; // Player is falling
        }).sort((a, b) => {
            const aGap = nextPick - (a.adp || 999);
            const bGap = nextPick - (b.adp || 999);
            return bGap - aGap; // Sort by biggest gap (most value)
        });

        // 2. TEAM STACKING CONFLICT DETECTION
        const myDraftedPlayers = Object.values(myRoster).flat();

        const candidatesWithConflictAnalysis = availablePlayers.map(player => {
            let conflictScore = 0;
            let conflictReasons: string[] = [];

            // Check for same NFL team conflicts
            const sameTeamPlayers = myDraftedPlayers.filter(rostered =>
                rostered.team === player.team
            );

            if (sameTeamPlayers.length > 0) {
                const samePositionConflicts = sameTeamPlayers.filter(rostered =>
                    rostered.position === player.position
                );

                if (samePositionConflicts.length > 0) {
                    // HIGH conflict: Same team + same position
                    conflictScore = 10;
                    conflictReasons.push(`Same team + position as ${samePositionConflicts[0].name}`);
                } else {
                    // MEDIUM conflict: Same team, different position
                    conflictScore = 5;
                    conflictReasons.push(`Same team as ${sameTeamPlayers[0].name}`);
                }
            }

            return {
                ...player,
                conflictScore,
                conflictReasons
            };
        });

        // 3. POSITIONAL BALANCE ANALYSIS
        const positionCounts = {
            QB: myRoster.QB.length,
            RB: myRoster.RB.length,
            WR: myRoster.WR.length,
            TE: myRoster.TE.length,
            FLEX: myRoster.FLEX.length
        };

        // EARLY ROUND STACKING PREVENTION - Check first 3 picks IN DRAFT ORDER
        let firstThreePickPositions: string[] = [];

        if (userTeamPosition) {
            // Get user's picks in draft order
            const userPicks = picks.filter(pick => {
                const round = Math.ceil(pick.pick / leagueSize);
                let userPickInRound;

                if (round % 2 === 0) {
                    // Even rounds reverse order  
                    userPickInRound = (round - 1) * leagueSize + (leagueSize - userTeamPosition + 1);
                } else {
                    // Odd rounds normal order
                    userPickInRound = (round - 1) * leagueSize + userTeamPosition;
                }

                return pick.pick === userPickInRound;
            });

            firstThreePickPositions = userPicks.slice(0, 3).map(pick => pick.position || '').filter(Boolean);
        }

        const hasThreeEarlyRBs = firstThreePickPositions.filter(pos => pos === 'RB').length === 3;
        const hasThreeEarlyWRs = firstThreePickPositions.filter(pos => pos === 'WR').length === 3;

        console.log('🎯 Early Round Analysis:', {
            round: currentRound,
            userTeamPosition,
            firstThreePicks: firstThreePickPositions,
            hasThreeEarlyRBs,
            hasThreeEarlyWRs,
            userPicksCount: firstThreePickPositions.length
        });

        // Define positional priorities by round
        const getPositionalPriority = (position: string, round: number): number => {
            // EARLY ROUND STACKING RULES (Rounds 1-3 stacking prevention)
            if (currentRound === 4 && firstThreePickPositions.length === 3) {
                if (hasThreeEarlyRBs) {
                    // 3 RBs in first 3 rounds - HEAVILY favor WRs
                    if (position === 'WR') return 15; // VERY HIGH priority
                    if (position === 'RB') return 1;  // VERY LOW priority
                    if (position === 'QB') return 2;  // LOW priority
                    if (position === 'TE') return 2;  // LOW priority
                    return 3; // Other positions low
                }

                if (hasThreeEarlyWRs) {
                    // 3 WRs in first 3 rounds - HEAVILY favor RBs
                    if (position === 'RB') return 15; // VERY HIGH priority
                    if (position === 'WR') return 1;  // VERY LOW priority
                    if (position === 'QB') return 2;  // LOW priority
                    if (position === 'TE') return 3;  // MEDIUM-LOW priority
                    return 4; // Other positions medium-low
                }
            }

            // Calculate roster completeness for normal logic
            const hasStartingQB = positionCounts.QB >= 1;
            const hasStartingRBs = positionCounts.RB >= 2;
            const hasStartingWRs = positionCounts.WR >= 2;
            const hasStartingTE = positionCounts.TE >= 1;

            const corePositionsFilled = hasStartingQB && hasStartingRBs && hasStartingWRs && hasStartingTE;
            const hasMinimumStarters = hasStartingRBs && hasStartingWRs;

            if (round <= 4) {
                // Early rounds: PRIORITIZE CORE STARTERS FIRST

                // HIGH PRIORITY: Missing core starters
                if (position === 'RB' && positionCounts.RB < 2) return 10;
                if (position === 'WR' && positionCounts.WR < 2) return 10;

                // CONTEXT-AWARE RB/WR decisions
                if (position === 'RB' && positionCounts.RB >= 3) {
                    if (!hasMinimumStarters) {
                        return 2; // Bad - still need other core positions
                    } else if (corePositionsFilled) {
                        return 7; // OK - depth after core is filled
                    } else {
                        return 4; // Neutral - some core filled but not all
                    }
                }

                if (position === 'WR' && positionCounts.WR >= 3) {
                    if (!hasMinimumStarters) {
                        return 3; // Better than 4th RB but still not ideal
                    } else if (corePositionsFilled) {
                        return 7; // Good depth
                    } else {
                        return 5; // Decent depth
                    }
                }

                // PREMIUM POSITIONS: Only after core or if elite value
                if (position === 'QB') {
                    if (positionCounts.QB >= 1) return 2; // Devalue second QB early
                    if (!hasMinimumStarters) return 4; // QB can wait if missing RB/WR
                    return 6; // Good time for QB
                }

                if (position === 'TE') {
                    if (positionCounts.TE >= 1) return 2; // Devalue second TE early
                    if (!hasMinimumStarters) return 5; // TE can wait
                    return 7; // Good time for TE
                }

                return 6; // Default

            } else if (round <= 8) {
                // Mid rounds: FILL OUT ROSTER, DEPTH OK

                // Missing core positions get priority
                if (position === 'QB' && positionCounts.QB === 0) return 9;
                if (position === 'TE' && positionCounts.TE === 0) return 8;
                if (position === 'RB' && positionCounts.RB < 2) return 8;
                if (position === 'WR' && positionCounts.WR < 2) return 8;

                // Depth is generally good now
                if (position === 'RB') return 7;
                if (position === 'WR') return 7;
                if (position === 'TE' && positionCounts.TE < 2) return 6;

                return 5;
            } else {
                // Late rounds: UPSIDE AND DEPTH
                return 5;
            }
        };

        // 4. CALCULATE FINAL SCORES
        const scoredCandidates = candidatesWithConflictAnalysis.map(player => {
            let score = 0;
            const reasons: string[] = [];

            // Value score (30% weight)
            const valueGap = nextPick - (player.adp || 999);
            if (valueGap > 0) {
                const valueScore = Math.min(valueGap * 2, 20); // Cap at 20 points
                score += valueScore * 0.3;
                if (valueGap >= 3) {
                    reasons.push(`Falling ${valueGap.toFixed(1)} picks`);
                }
            }

            // Positional priority (40% weight)
            const positionPriority = getPositionalPriority(player.position, currentRound);
            score += positionPriority * 0.4;

            // ADP ranking bonus (20% weight)
            if (player.adp && player.adp <= 100) {
                const adpBonus = (100 - player.adp) / 10;
                score += adpBonus * 0.2;
            }

            // Apply conflict penalty (subtract from total)
            score -= player.conflictScore;
            if (player.conflictReasons.length > 0) {
                reasons.push(...player.conflictReasons);
            }

            // Need-based bonus & penalties - CONTEXT AWARE
            if (currentRound <= 8) {
                const hasStartingRBs = positionCounts.RB >= 2;
                const hasStartingWRs = positionCounts.WR >= 2;
                const hasStartingTE = positionCounts.TE >= 1;
                const hasStartingQB = positionCounts.QB >= 1;
                const corePositionsFilled = hasStartingQB && hasStartingRBs && hasStartingWRs && hasStartingTE;

                // STRONG bonus for missing starters
                if (player.position === 'RB' && positionCounts.RB < 2) {
                    score += 7;
                    reasons.push('Need starting RB');
                }
                if (player.position === 'WR' && positionCounts.WR < 2) {
                    score += 7;
                    reasons.push('Need starting WR');
                }
                if (player.position === 'TE' && positionCounts.TE === 0 && currentRound >= 3) {
                    score += 6;
                    reasons.push('Need starting TE');
                }
                if (player.position === 'QB' && positionCounts.QB === 0 && currentRound >= 4) {
                    score += 5;
                    reasons.push('Need starting QB');
                }

                // CONTEXT-AWARE penalties for depth picks
                if (player.position === 'RB' && positionCounts.RB >= 3) {
                    if (!corePositionsFilled) {
                        score -= 6;
                        reasons.push(`4th+ RB before filling core positions`);
                    } else {
                        score += 2; // Actually bonus for good depth
                        reasons.push(`Good RB depth`);
                    }
                }

                if (player.position === 'WR' && positionCounts.WR >= 4) {
                    if (!corePositionsFilled) {
                        score -= 4;
                        reasons.push(`5th+ WR before filling core positions`);
                    } else {
                        score += 1;
                        reasons.push(`Good WR depth`);
                    }
                }

                // EARLY ROUND STACKING PENALTIES/BONUSES
                if (currentRound === 4 && firstThreePickPositions.length === 3) {
                    if (hasThreeEarlyRBs) {
                        if (player.position === 'WR') {
                            score += 12;
                            reasons.push('NEED WR - took 3 RBs early');
                        } else if (player.position === 'RB') {
                            score -= 10;
                            reasons.push('Avoid 4th RB - already took 3 early');
                        } else if (player.position === 'QB' || player.position === 'TE') {
                            score -= 6;
                            reasons.push('Focus on WR after 3 early RBs');
                        }
                    }

                    if (hasThreeEarlyWRs) {
                        if (player.position === 'RB') {
                            score += 12;
                            reasons.push('NEED RB - took 3 WRs early');
                        } else if (player.position === 'WR') {
                            score -= 10;
                            reasons.push('Avoid 4th WR - already took 3 early');
                        } else if (player.position === 'QB') {
                            score -= 4;
                            reasons.push('Focus on RB after 3 early WRs');
                        }
                    }
                }
            }

            // VALUE EXCEPTION: Override stacking rules for major value
            if (valueGap >= 15) { // Player falling 15+ spots (use existing valueGap from line 1554)
                if (currentRound === 4) {
                    if (hasThreeEarlyRBs && (player.position === 'QB' || player.position === 'TE')) {
                        score += 5; // Reduce penalty for significant value
                        reasons.push(`Significant value (${valueGap.toFixed(0)} spots)`);
                    }
                    if (hasThreeEarlyWRs && player.position === 'QB') {
                        score += 5;
                        reasons.push(`Significant value (${valueGap.toFixed(0)} spots)`);
                    }
                }
            }

            return {
                ...player,
                suggestionScore: score,
                suggestionReasons: reasons
            };
        });

        // 5. SELECT TOP 1 CANDIDATE (simplified from 3)
        const topCandidates = scoredCandidates
            .sort((a, b) => b.suggestionScore - a.suggestionScore)
            .slice(0, 1); // Take only the top 1 player

        // If we have no candidates, fill with best available player
        if (topCandidates.length === 0 && availablePlayers.length > 0) {
            const bestAvailable = availablePlayers
                .sort((a, b) => (a.adp || 999) - (b.adp || 999)) // Sort by ADP
                .slice(0, 1);

            topCandidates.push(...bestAvailable.map(player => ({
                ...player,
                suggestionScore: 1,
                suggestionReasons: ['Best available by ADP']
            })));
        }

        log('🧠 AI Suggestion calculated:', {
            currentPick: nextPick,
            round: currentRound,
            userTurn: isUserTurn,
            availablePlayersCount: availablePlayers.length,
            scoredCandidatesCount: scoredCandidates.length,
            topCandidate: topCandidates.length > 0 ? {
                name: topCandidates[0].name,
                position: topCandidates[0].position,
                score: topCandidates[0].suggestionScore?.toFixed(1) || 'N/A',
                reasons: topCandidates[0].suggestionReasons || []
            } : null
        });

        return topCandidates;
    }, [isUserTurn, userTeamPosition, isPaused, isDrafting, nextPick, leagueSize, picks, allPlayers, myRoster, availablePlayers]);

    // Update AI suggestions when relevant data changes
    useEffect(() => {
        const suggestions = calculateAISuggestions();
        console.log('🧠 AI Suggestions Debug Final:', {
            isUserTurn,
            userTeamPosition,
            isPaused,
            isDrafting,
            nextPick,
            allPlayersCount: allPlayers.length,
            picksCount: picks.length,
            suggestionsCount: suggestions.length,
            suggestions: suggestions.map(s => s.name)
        });
        setAiSuggestions(suggestions);
    }, [calculateAISuggestions]);

    // TEMPORARY DEBUG: Force show brackets on top 1 available player when drafting
    useEffect(() => {
        if (isDrafting && userTeamPosition && allPlayers.length > 0) {
            // Get available players (not drafted)
            const draftedPlayerNames = new Set(picks.map(pick => pick.player).filter(Boolean));
            const availablePlayers = allPlayers.filter(player => !draftedPlayerNames.has(player.name));
            const testSuggestion = availablePlayers.slice(0, 1); // Only take 1 player
            console.log('🧪 Debug: Setting test AI suggestion for drafting:', testSuggestion.map(p => p.name));
            setAiSuggestions(testSuggestion);
        } else {
            setAiSuggestions([]);
        }
    }, [isDrafting, userTeamPosition, allPlayers, picks]);

    // Main component render
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

                {/* Live Draft Position Claim */}
                {mode === 'live' && (
                    <div className="mt-2">
                        <h3 className="text-sm font-mono mb-2">Draft Position</h3>
                        {!userTeamPosition ? (
                            <div>
                                <p className="text-gray-400 mb-2 font-mono text-xs">
                                    Claim your draft position:
                                </p>
                                <div className="grid grid-cols-8 gap-1">
                                    {Array.from({ length: leagueSize }, (_, i) => i + 1).map(pos => (
                                        <button
                                            key={pos}
                                            onClick={() => setUserTeamPosition(pos)}
                                            className="p-1 border border-white/20 hover:border-white/40 hover:bg-white/5 font-mono text-xs"
                                        >
                                            {pos}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-2 border border-blue-400/50 bg-blue-900/20">
                                <span className="font-mono text-sm">You are: Team {userTeamPosition}</span>
                                <button
                                    onClick={() => setUserTeamPosition(null)}
                                    className="text-xs text-gray-400 hover:text-white"
                                >
                                    Change
                                </button>
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
                                disabled={!userTeamPosition}
                                className="bg-green-600 text-white px-4 py-2 border border-green-500 hover:bg-green-700 text-sm disabled:opacity-50"
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
                        isUserTurn={isUserTurn}
                        aiSuggestions={aiSuggestions}
                        onManualAssign={(pickNumber, player) => {
                            const newPick: DraftPick = {
                                pick: pickNumber,
                                round: Math.ceil(pickNumber / leagueSize),
                                player: player.name,
                                position: player.position,
                                team: player.team,
                                sleeper_id: player.sleeper_id
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

                            try {
                                const { getPlayerByName } = await import('@/lib/sleeper/fetchAllPlayers');
                                const sleeperPlayer = await getPlayerByName(player.player || '');

                                if (sleeperPlayer?.player_id) {
                                    console.log('✅ Found sleeper player:', sleeperPlayer);
                                    setSelectedPlayerForModal(sleeperPlayer.player_id);
                                } else {
                                    console.warn('❌ Player not found in Sleeper database:', player.player);
                                    alert(`Player "${player.player}" not found in Sleeper database.`);
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
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                                                    <div
                                                        className={`font-medium ${getPositionColor(player.position)} cursor-pointer hover:underline`}
                                                        onClick={async () => {
                                                            console.log('Opening player card for:', player);

                                                            if (player.sleeper_id) {
                                                                setSelectedPlayerForModal(player.sleeper_id);
                                                                return;
                                                            }

                                                            try {
                                                                const { getPlayerByName } = await import('@/lib/sleeper/fetchAllPlayers');
                                                                const sleeperPlayer = await getPlayerByName(player.name);

                                                                if (sleeperPlayer?.player_id) {
                                                                    console.log('✅ Found sleeper player:', sleeperPlayer);
                                                                    setSelectedPlayerForModal(sleeperPlayer.player_id);
                                                                } else {
                                                                    console.warn('❌ Player not found in Sleeper database:', player.name);
                                                                    alert(`Player "${player.name}" not found in Sleeper database.`);
                                                                }
                                                            } catch (error) {
                                                                console.error('Error looking up player:', error);
                                                                alert(`Error looking up player "${player.name}"`);
                                                            }
                                                        }}
                                                        title="Click to view player details"
                                                    >
                                                        {/* TEMPORARILY DISABLED: Show white brackets around AI suggestions, keep original colors */}
                                                        {/* Backend AI suggestion logic still runs, but brackets are hidden for now */}
                                                        {false && isUserTurn && aiSuggestions?.some(suggestion => suggestion.name === player.name) ? (
                                                            <span>
                                                                <span className="text-white font-bold">[</span>
                                                                <span className={getPositionColor(player.position)}>{player.name}</span>
                                                                <span className="text-white font-bold">]</span>
                                                            </span>
                                                        ) : (
                                                            <span className={getPositionColor(player.position)}>{player.name}</span>
                                                        )}
                                                    </div>
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
                        <div className="flex-1 overflow-y-auto terminal-scrollbar">
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

