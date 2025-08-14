import axios from 'axios';

// Strict TypeScript interfaces
interface PlayerProjection {
    playerId: string;
    playerName: string;
    team: string;
    position: string;
    week: number;
    season: string;

    // Fantasy Points
    fantasyPoints: number;
    fantasyPointsStandard: number;
    fantasyPointsPPR: number;
    fantasyPointsHalfPPR: number;

    // Passing stats
    passingYards?: number;
    passingTDs?: number;
    interceptions?: number;
    passAttempts?: number;
    passCompletions?: number;

    // Rushing stats
    rushingYards?: number;
    rushingTDs?: number;
    rushingAttempts?: number;

    // Receiving stats
    receivingYards?: number;
    receivingTDs?: number;
    receptions?: number;
    targets?: number;

    // Other stats
    fumblesLost?: number;
    twoPointConversions?: number;
}

interface ProjectionResponse {
    success: boolean;
    projections: PlayerProjection[];
    metadata: {
        week: number;
        season: string;
        totalPlayers: number;
        lastUpdated: string;
    };
    error?: string;
}

export class ProjectionService {
    private static instance: ProjectionService;
    private projectionCache: Map<string, { data: PlayerProjection[], lastUpdated: Date }> = new Map();
    private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    private constructor() { }

    static getInstance(): ProjectionService {
        if (!ProjectionService.instance) {
            ProjectionService.instance = new ProjectionService();
        }
        return ProjectionService.instance;
    }

    /**
     * Get Week 1 projections for all players
     */
    async getWeekProjections(week: number = 1, season: string = '2025'): Promise<ProjectionResponse> {
        try {
            const cacheKey = `projections_${week}_${season}`;

            // Check cache first
            const cached = this.projectionCache.get(cacheKey);
            if (cached && Date.now() - cached.lastUpdated.getTime() < this.CACHE_DURATION) {
                return {
                    success: true,
                    projections: cached.data,
                    metadata: {
                        week,
                        season,
                        totalPlayers: cached.data.length,
                        lastUpdated: cached.lastUpdated.toISOString()
                    }
                };
            }

            // Environment variables
            const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
            const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

            if (!RAPIDAPI_KEY) {
                throw new Error('RAPIDAPI_KEY not configured');
            }

            // Fetch projections from RapidAPI
            const response = await axios.get(
                'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections',
                {
                    params: {
                        week: week,
                        archiveSeason: season,
                        pointsPerReception: 1,
                        rushTD: 6,
                        receivingTD: 6,
                        passTD: 4
                    },
                    headers: {
                        'x-rapidapi-host': RAPIDAPI_HOST,
                        'x-rapidapi-key': RAPIDAPI_KEY
                    },
                    timeout: 15000
                }
            );

            if (response.data?.statusCode === 200 && response.data?.body?.playerProjections) {
                const rawProjections = response.data.body.playerProjections;
                const projections = Object.values(rawProjections).map((player: any) =>
                    this.formatPlayerProjection(player, week, season)
                );

                // Cache the results
                this.projectionCache.set(cacheKey, {
                    data: projections,
                    lastUpdated: new Date()
                });

                return {
                    success: true,
                    projections,
                    metadata: {
                        week: parseInt(response.data.body.week || week),
                        season: response.data.body.season || season,
                        totalPlayers: projections.length,
                        lastUpdated: new Date().toISOString()
                    }
                };
            }

            throw new Error('Invalid response format from projections API');

        } catch (error: any) {
            console.error('❌ Projection fetch error:', error.message);
            return {
                success: false,
                projections: [],
                metadata: {
                    week,
                    season,
                    totalPlayers: 0,
                    lastUpdated: new Date().toISOString()
                },
                error: error.message
            };
        }
    }

    /**
     * Get projection for a specific player by name
     */
    async getPlayerProjection(playerName: string, week: number = 1, season: string = '2025'): Promise<PlayerProjection | null> {
        try {
            const response = await this.getWeekProjections(week, season);
            if (!response.success) {
                return null;
            }

            // Find player by name (case-insensitive, partial match)
            const player = response.projections.find(p =>
                p.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
                playerName.toLowerCase().includes(p.playerName.toLowerCase())
            );

            return player || null;

        } catch (error: any) {
            console.error(`❌ Error fetching projection for ${playerName}:`, error.message);
            return null;
        }
    }

    /**
     * Get projections for multiple players by names
     */
    async getMultiplePlayerProjections(playerNames: string[], week: number = 1, season: string = '2025'): Promise<PlayerProjection[]> {
        try {
            const response = await this.getWeekProjections(week, season);
            if (!response.success) {
                return [];
            }

            return playerNames.map(name => {
                const player = response.projections.find(p =>
                    p.playerName.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(p.playerName.toLowerCase())
                );
                return player;
            }).filter(Boolean) as PlayerProjection[];

        } catch (error: any) {
            console.error('❌ Error fetching multiple player projections:', error.message);
            return [];
        }
    }

    /**
     * Get projections filtered by team
     */
    async getTeamProjections(teamAbbreviation: string, week: number = 1, season: string = '2025'): Promise<PlayerProjection[]> {
        try {
            const response = await this.getWeekProjections(week, season);
            if (!response.success) {
                return [];
            }

            return response.projections.filter(p =>
                p.team.toUpperCase() === teamAbbreviation.toUpperCase()
            );

        } catch (error: any) {
            console.error(`❌ Error fetching team projections for ${teamAbbreviation}:`, error.message);
            return [];
        }
    }

    /**
     * Get projections filtered by position
     */
    async getPositionProjections(position: string, week: number = 1, season: string = '2025'): Promise<PlayerProjection[]> {
        try {
            const response = await this.getWeekProjections(week, season);
            if (!response.success) {
                return [];
            }

            return response.projections
                .filter(p => p.position.toLowerCase() === position.toLowerCase())
                .sort((a, b) => b.fantasyPointsPPR - a.fantasyPointsPPR); // Sort by projected points

        } catch (error: any) {
            console.error(`❌ Error fetching ${position} projections:`, error.message);
            return [];
        }
    }

    /**
     * Clear projection cache
     */
    clearCache(): void {
        this.projectionCache.clear();
    }

    /**
     * Format raw API player data into our PlayerProjection interface
     */
    private formatPlayerProjection(player: any, week: number, season: string): PlayerProjection {
        return {
            playerId: player.playerID,
            playerName: player.longName,
            team: player.team,
            position: player.pos,
            week,
            season,

            // Fantasy Points
            fantasyPoints: parseFloat(player.fantasyPoints) || 0,
            fantasyPointsStandard: parseFloat(player.fantasyPointsDefault?.standard) || 0,
            fantasyPointsPPR: parseFloat(player.fantasyPointsDefault?.PPR) || 0,
            fantasyPointsHalfPPR: parseFloat(player.fantasyPointsDefault?.halfPPR) || 0,

            // Passing stats
            passingYards: player.Passing?.passYds ? parseFloat(player.Passing.passYds) : undefined,
            passingTDs: player.Passing?.passTD ? parseFloat(player.Passing.passTD) : undefined,
            interceptions: player.Passing?.int ? parseFloat(player.Passing.int) : undefined,
            passAttempts: player.Passing?.passAttempts ? parseFloat(player.Passing.passAttempts) : undefined,
            passCompletions: player.Passing?.passCompletions ? parseFloat(player.Passing.passCompletions) : undefined,

            // Rushing stats
            rushingYards: player.Rushing?.rushYds ? parseFloat(player.Rushing.rushYds) : undefined,
            rushingTDs: player.Rushing?.rushTD ? parseFloat(player.Rushing.rushTD) : undefined,
            rushingAttempts: player.Rushing?.carries ? parseFloat(player.Rushing.carries) : undefined,

            // Receiving stats
            receivingYards: player.Receiving?.recYds ? parseFloat(player.Receiving.recYds) : undefined,
            receivingTDs: player.Receiving?.recTD ? parseFloat(player.Receiving.recTD) : undefined,
            receptions: player.Receiving?.receptions ? parseFloat(player.Receiving.receptions) : undefined,
            targets: player.Receiving?.targets ? parseFloat(player.Receiving.targets) : undefined,

            // Other stats
            fumblesLost: player.fumblesLost ? parseFloat(player.fumblesLost) : undefined,
            twoPointConversions: player.twoPointConversion ? parseFloat(player.twoPointConversion) : undefined
        };
    }
}

// Export singleton instance
export const projectionService = ProjectionService.getInstance();
