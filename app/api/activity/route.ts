import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface SleeperTransaction {
    type: 'trade' | 'waiver' | 'free_agent';
    transaction_id: string;
    status: 'processing' | 'complete' | 'failed';
    created: number;
    roster_ids: number[];
    drops?: { [rosterId: string]: string };
    adds?: { [rosterId: string]: string };
    waiver_budget?: { [rosterId: string]: number };
    settings?: any;
    metadata?: any;
    draft_picks?: any[];
}

interface SleeperUser {
    user_id: string;
    username: string;
    display_name: string;
}

interface SleeperRoster {
    roster_id: number;
    owner_id: string;
    league_id: string;
}

interface ActivityItem {
    id: string;
    type: 'trade' | 'waiver_add' | 'free_agent_add' | 'drop';
    timestamp: number;
    league_name: string;
    league_id: string;
    description: string;
    teams_involved: string[];
    players_involved: { name: string; action: 'added' | 'dropped' | 'traded' }[];
}

export async function GET() {
    try {
        const supabase = createClient();

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get all user's leagues
        const { data: leagues, error: leaguesError } = await supabase
            .from('leagues')
            .select('sleeper_league_id, league_name, sleeper_username')
            .eq('user_email', user.email);

        if (leaguesError || !leagues) {
            return NextResponse.json({ success: false, error: 'Failed to fetch leagues' }, { status: 500 });
        }

        console.log(`[Activity] Found ${leagues.length} leagues for user`);

        // Fetch activity from all leagues
        const allActivity: ActivityItem[] = [];

        for (const league of leagues) {
            try {
                console.log(`[Activity] Processing league: ${league.league_name} (${league.sleeper_league_id})`);
                const leagueActivity = await fetchLeagueActivity(league.sleeper_league_id, league.league_name);
                allActivity.push(...leagueActivity);
                console.log(`[Activity] Added ${leagueActivity.length} activities from ${league.league_name}`);
            } catch (error) {
                console.error(`[Activity] Failed to fetch activity for league ${league.league_name}:`, error);
                // Continue with other leagues
            }
        }

        // Sort by timestamp (most recent first) and limit to 20 items
        const sortedActivity = allActivity
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);

        console.log(`[Activity] Returning ${sortedActivity.length} activity items`);

        return NextResponse.json({
            success: true,
            activity: sortedActivity,
            total_leagues: leagues.length
        });

    } catch (error: any) {
        console.error('[Activity] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch activity'
        }, { status: 500 });
    }
}

async function fetchLeagueActivity(leagueId: string, leagueName: string): Promise<ActivityItem[]> {
    console.log(`[Activity] Fetching activity for league ${leagueName} (${leagueId})`);

    // Skip manual/test leagues
    if (leagueId.startsWith('manual_') || leagueId.includes('manual')) {
        console.log(`[Activity] Skipping manual league: ${leagueName} (${leagueId})`);
        return [];
    }

    const activity: ActivityItem[] = [];
    const currentWeek = getCurrentNFLWeek();

    console.log(`[Activity] Current NFL week: ${currentWeek}`);

    // Fetch recent transactions (check more weeks and go back further)
    const weekPromises = [];
    const weeksToCheck = [];

    // Check the last 8 weeks, but also include peak transaction weeks (1-14)
    const startWeek = Math.max(1, currentWeek - 7);
    const endWeek = Math.min(17, currentWeek);

    // If we're late in season, also check peak transaction weeks
    const peakWeeks = currentWeek > 14 ? [1, 2, 3, 4, 5, 10, 11, 12, 13, 14] : [];
    const allWeeksToCheck = [...peakWeeks, ...Array.from({ length: endWeek - startWeek + 1 }, (_, i) => startWeek + i)];

    // Remove duplicates and limit to reasonable number
    const uniqueWeeks = [...new Set(allWeeksToCheck)].slice(0, 10);

    for (const week of uniqueWeeks) {
        weeksToCheck.push(week);
        weekPromises.push(
            fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`)
                .then(async res => {
                    console.log(`[Activity] Week ${week} response status: ${res.status}`);
                    if (res.ok) {
                        const data = await res.json();
                        console.log(`[Activity] Week ${week} transactions: ${data?.length || 0}`);
                        return data;
                    }
                    return [];
                })
                .catch(err => {
                    console.error(`[Activity] Week ${week} error:`, err);
                    return [];
                })
        );
    }

    console.log(`[Activity] Checking weeks: ${weeksToCheck.join(', ')}`);

    // Fetch league data
    const [usersRes, rostersRes, ...transactionResponses] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
        ...weekPromises
    ]);

    console.log(`[Activity] Users API status: ${usersRes.status}`);
    console.log(`[Activity] Rosters API status: ${rostersRes.status}`);

    if (!usersRes.ok || !rostersRes.ok) {
        console.error(`[Activity] Failed to fetch league data for ${leagueId}: users=${usersRes.status}, rosters=${rostersRes.status}`);
        // Don't throw error, just return empty array to continue with other leagues
        return [];
    }

    const users: SleeperUser[] = await usersRes.json();
    const rosters: SleeperRoster[] = await rostersRes.json();

    console.log(`[Activity] Found ${users.length} users and ${rosters.length} rosters`);

    // Create lookup maps
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const rosterMap = new Map(rosters.map(r => [r.roster_id, r]));

    // Fetch NFL players for name lookup
    const playersRes = await fetch('https://api.sleeper.app/v1/players/nfl');
    const players = playersRes.ok ? await playersRes.json() : {};
    console.log(`[Activity] Players API status: ${playersRes.status}`);

    // Process all transactions
    const allTransactions: SleeperTransaction[] = transactionResponses.flat();
    console.log(`[Activity] Total transactions found: ${allTransactions.length}`);

    for (const transaction of allTransactions) {
        console.log(`[Activity] Processing transaction: ${transaction.transaction_id}, type: ${transaction.type}, status: ${transaction.status}`);

        if (transaction.status !== 'complete') {
            console.log(`[Activity] Skipping transaction ${transaction.transaction_id} - status: ${transaction.status}`);
            continue;
        }

        const activityItem = processTransaction(transaction, leagueId, leagueName, userMap, rosterMap, players);
        if (activityItem) {
            console.log(`[Activity] Created activity item: ${activityItem.description}`);
            activity.push(activityItem);
        } else {
            console.log(`[Activity] Failed to create activity item for transaction ${transaction.transaction_id}`);
        }
    }

    console.log(`[Activity] League ${leagueName} returned ${activity.length} activity items`);
    return activity;
}

function processTransaction(
    transaction: SleeperTransaction,
    leagueId: string,
    leagueName: string,
    userMap: Map<string, SleeperUser>,
    rosterMap: Map<number, SleeperRoster>,
    players: any
): ActivityItem | null {
    const timestamp = transaction.created;
    const teamsInvolved: string[] = [];
    const playersInvolved: { name: string; action: 'added' | 'dropped' | 'traded' }[] = [];

    // Process adds
    if (transaction.adds) {
        for (const [playerId, rosterIdStr] of Object.entries(transaction.adds)) {
            const rosterId = parseInt(rosterIdStr);
            const roster = rosterMap.get(rosterId);
            const user = roster ? userMap.get(roster.owner_id) : null;
            const playerName = players[playerId]?.full_name || `Player ${playerId}`;

            if (user) {
                teamsInvolved.push(user.display_name || user.username);
                playersInvolved.push({ name: playerName, action: 'added' });
            }
        }
    }

    // Process drops
    if (transaction.drops) {
        for (const [playerId, rosterIdStr] of Object.entries(transaction.drops)) {
            const rosterId = parseInt(rosterIdStr);
            const roster = rosterMap.get(rosterId);
            const user = roster ? userMap.get(roster.owner_id) : null;
            const playerName = players[playerId]?.full_name || `Player ${playerId}`;

            if (user && !teamsInvolved.includes(user.display_name || user.username)) {
                teamsInvolved.push(user.display_name || user.username);
            }
            playersInvolved.push({ name: playerName, action: 'dropped' });
        }
    }

    if (teamsInvolved.length === 0 || playersInvolved.length === 0) {
        return null;
    }

    // Generate description based on transaction type
    let description = '';
    const team = teamsInvolved[0];

    if (transaction.type === 'trade' && teamsInvolved.length > 1) {
        // For trades, we need to show who traded what to whom
        const tradeDetails: { [teamName: string]: { received: string[]; gave: string[] } } = {};

        // Initialize trade details for each team
        teamsInvolved.forEach(team => {
            tradeDetails[team] = { received: [], gave: [] };
        });

        // Process adds (what each team received)
        if (transaction.adds) {
            for (const [playerId, rosterIdStr] of Object.entries(transaction.adds)) {
                const rosterId = parseInt(rosterIdStr);
                const roster = rosterMap.get(rosterId);
                const user = roster ? userMap.get(roster.owner_id) : null;
                const playerName = players[playerId]?.full_name || `Player ${playerId}`;
                const teamName = user?.display_name || user?.username;

                if (teamName && tradeDetails[teamName]) {
                    tradeDetails[teamName].received.push(playerName);
                }
            }
        }

        // Process drops (what each team gave away)
        if (transaction.drops) {
            for (const [playerId, rosterIdStr] of Object.entries(transaction.drops)) {
                const rosterId = parseInt(rosterIdStr);
                const roster = rosterMap.get(rosterId);
                const user = roster ? userMap.get(roster.owner_id) : null;
                const playerName = players[playerId]?.full_name || `Player ${playerId}`;
                const teamName = user?.display_name || user?.username;

                if (teamName && tradeDetails[teamName]) {
                    tradeDetails[teamName].gave.push(playerName);
                }
            }
        }

        // Build trade description
        const tradeParts = [];
        for (const [teamName, details] of Object.entries(tradeDetails)) {
            if (details.received.length > 0) {
                tradeParts.push(`${teamName} got ${details.received.join(', ')}`);
            }
        }

        if (tradeParts.length > 0) {
            description = `Trade: ${tradeParts.join(' • ')}`;
        } else {
            // Fallback to simple format
            description = `Trade completed between ${teamsInvolved.join(' and ')}`;
        }
    } else if (transaction.type === 'waiver') {
        const added = playersInvolved.find(p => p.action === 'added');
        const dropped = playersInvolved.find(p => p.action === 'dropped');
        if (added && dropped) {
            description = `${team} claimed ${added.name} from waivers, dropped ${dropped.name}`;
        } else if (added) {
            description = `${team} claimed ${added.name} from waivers`;
        }
    } else if (transaction.type === 'free_agent') {
        const added = playersInvolved.find(p => p.action === 'added');
        const dropped = playersInvolved.find(p => p.action === 'dropped');
        if (added && dropped) {
            description = `${team} added ${added.name}, dropped ${dropped.name}`;
        } else if (added) {
            description = `${team} added ${added.name}`;
        } else if (dropped) {
            description = `${team} dropped ${dropped.name}`;
        }
    }

    if (!description) return null;

    return {
        id: transaction.transaction_id,
        type: transaction.type === 'waiver' ? 'waiver_add' :
            transaction.type === 'free_agent' ? 'free_agent_add' : 'trade',
        timestamp,
        league_name: leagueName,
        league_id: leagueId,
        description,
        teams_involved: teamsInvolved,
        players_involved: playersInvolved
    };
}

function getCurrentNFLWeek(): number {
    // Simple approximation - in a real app you'd want to fetch this from an API
    const now = new Date();
    const seasonStart = new Date('2024-09-05'); // Approximate 2024 season start
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(18, weeksSinceStart + 1));
}
