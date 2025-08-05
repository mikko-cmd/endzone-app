import axios from 'axios';

interface ESPNScheduleEvent {
    week: number;
    competitions: Array<{
        competitors: Array<{
            team: {
                id: string;
                displayName: string;
            };
            homeAway: 'home' | 'away';
        }>;
        venue: {
            fullName: string;
        };
    }>;
}

interface ESPNScheduleResponse {
    events: ESPNScheduleEvent[];
}

interface GameLocation {
    week: number;
    opponent: string;
    isHome: boolean;
    venue?: string;
}

// ESPN Team ID mapping (you already have this in defense-rankings/route.ts)
const ESPN_TEAM_IDS: Record<string, number> = {
    'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
    'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
    'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
    'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
    'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
    'TEN': 10, 'WAS': 28
};

export class ESPNScheduleService {
    private readonly baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
    private readonly headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.espn.com/'
    };

    /**
     * Get the real home/away schedule for a team in a specific season
     */
    async getTeamSchedule(teamCode: string, season: number): Promise<GameLocation[]> {
        try {
            const teamId = ESPN_TEAM_IDS[teamCode];
            if (!teamId) {
                console.warn(`⚠️ No ESPN team ID found for ${teamCode}`);
                return [];
            }

            const url = `${this.baseUrl}/${teamId}/schedule?season=${season}`;
            console.log(`📅 Fetching ESPN schedule for ${teamCode} ${season}...`);

            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000
            });

            if (response.status !== 200 || !response.data) {
                console.warn(`⚠️ Failed to fetch ESPN schedule for ${teamCode} ${season}`);
                return [];
            }

            const data: ESPNScheduleResponse = response.data;
            const gameLocations: GameLocation[] = [];

            if (data.events && Array.isArray(data.events)) {
                for (const event of data.events) {
                    if (event.competitions && event.competitions.length > 0) {
                        const competition = event.competitions[0];

                        // Find our team and the opponent
                        let ourTeam: any = null;
                        let opponent: any = null;

                        for (const competitor of competition.competitors) {
                            if (competitor.team.id === teamId.toString()) {
                                ourTeam = competitor;
                            } else {
                                opponent = competitor;
                            }
                        }

                        if (ourTeam && opponent) {
                            gameLocations.push({
                                week: event.week,
                                opponent: opponent.team.displayName,
                                isHome: ourTeam.homeAway === 'home',
                                venue: competition.venue?.fullName
                            });
                        }
                    }
                }
            }

            console.log(`✅ Found ${gameLocations.length} games for ${teamCode} ${season}`);
            return gameLocations;

        } catch (error: any) {
            console.error(`❌ Error fetching ESPN schedule for ${teamCode} ${season}:`, error.message);
            return [];
        }
    }

    /**
     * Get the home/away status for a specific game
     */
    async getGameLocation(teamCode: string, opponent: string, week: number, season: number): Promise<{ isHome: boolean; venue?: string } | null> {
        try {
            const schedule = await this.getTeamSchedule(teamCode, season);
            const game = schedule.find(g => g.week === week && g.opponent.includes(opponent));

            if (game) {
                return {
                    isHome: game.isHome,
                    venue: game.venue
                };
            }

            return null;
        } catch (error) {
            console.error(`❌ Error getting game location for ${teamCode} vs ${opponent} week ${week}:`, error);
            return null;
        }
    }

    /**
     * Format opponent string with home/away indicator
     */
    formatOpponent(opponent: string, isHome: boolean): string {
        return isHome ? `vs ${opponent}` : `@ ${opponent}`;
    }
}

// Export a singleton instance
export const espnScheduleService = new ESPNScheduleService();
