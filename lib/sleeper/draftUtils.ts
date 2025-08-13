/**
 * Sleeper Draft Integration Utilities
 */

// Extract draft ID from Sleeper URL
// Example: https://sleeper.com/draft/nfl/1234567890 -> 1234567890
export function extractDraftId(sleeperUrl: string): string | null {
    const match = sleeperUrl.match(/\/draft\/nfl\/(\d+)/);
    return match ? match[1] : null;
}

// Sleeper API Types
export interface SleeperPick {
    pick_no: number;
    player_id: string;
    picked_by: string;
    roster_id: number;
    round: number;
    draft_slot: number;
    is_keeper?: boolean;
    metadata?: {
        team: string;
        position: string;
        player_name: string;
    };
}

export interface SleeperDraftInfo {
    draft_id: string;
    status: 'pre_draft' | 'drafting' | 'complete';
    type: number; // 0 = snake, 1 = linear
    sport: string;
    league_id: string;
    season: string;
    settings: {
        rounds: number;
        pick_timer: number;
        teams: number;
    };
}

// Add these interfaces
export interface SleeperUser {
    user_id: string;
    username: string;
    display_name: string;
    avatar?: string;
}

export interface SleeperLeagueRoster {
    roster_id: number;
    owner_id: string;
    user_id: string;
    league_id: string;
}

// Fetch draft picks from Sleeper API
export async function fetchDraftPicks(draftId: string): Promise<SleeperPick[]> {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
    if (!response.ok) {
        throw new Error(`Failed to fetch draft picks: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Fetch draft info from Sleeper API
export async function fetchDraftInfo(draftId: string): Promise<SleeperDraftInfo> {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch draft info: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Add these functions
export async function fetchLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    if (!response.ok) {
        throw new Error(`Failed to fetch league users: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export async function fetchLeagueRosters(leagueId: string): Promise<SleeperLeagueRoster[]> {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
    if (!response.ok) {
        throw new Error(`Failed to fetch league rosters: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Create a map of draft slot to team name
export async function getDraftSlotToTeamNameMap(leagueId: string): Promise<Record<number, string>> {
    try {
        const [users, rosters] = await Promise.all([
            fetchLeagueUsers(leagueId),
            fetchLeagueRosters(leagueId)
        ]);

        const teamNameMap: Record<number, string> = {};

        rosters.forEach(roster => {
            const user = users.find(u => u.user_id === roster.owner_id);
            if (user) {
                // Use display_name if available, otherwise username
                const teamName = user.display_name || user.username || `Team ${roster.roster_id}`;
                teamNameMap[roster.roster_id] = teamName;
            }
        });

        return teamNameMap;
    } catch (error: any) {
        console.error('Failed to fetch team names:', error);
        return {};
    }
}

// Convert Sleeper pick to our draft board position
export function sleeperPickToBoardPosition(
    pick: SleeperPick,
    teams: number
): { round: number; teamIndex: number } {
    const round = pick.round;
    const teamIndex = pick.draft_slot - 1; // Convert 1-based to 0-based

    return { round, teamIndex };
}

// Validate Sleeper URL format
export function isValidSleeperDraftUrl(url: string): boolean {
    return /https?:\/\/sleeper\.com\/draft\/nfl\/\d+/.test(url);
}
