import { dataParser } from './dataParser';
import { espnAPI } from './services/espnAPI';
import { createClient } from '@supabase/supabase-js';

interface ESPNPlayerData {
    athleteId?: string;
    recentNews: Array<{
        headline: string;
        type: 'injury' | 'transaction' | 'performance' | 'general';
        impact: 'high' | 'medium' | 'low';
        published: string;
    }>;
    injuryStatus?: {
        status: string;
        details: string;
        severity: 'high' | 'medium' | 'low';
    } | undefined; // Fixed: Explicit undefined for strict mode
    depthChartPosition?: string | undefined; // Fixed: Explicit undefined
}

interface PlayerContext {
    playerName: string;
    team: string;
    position: string;
    recentNews?: string[] | undefined; // Fixed: Explicit undefined
    transactions?: TransactionInfo | undefined; // Fixed: Explicit undefined
    coachingImpact?: string | undefined; // Fixed: Explicit undefined
    teamContext?: string | undefined; // Fixed: Explicit undefined
    espnData?: ESPNPlayerData | undefined; // Fixed: Explicit undefined
    lastUpdated?: string | undefined; // Fixed: Explicit undefined
}

interface TransactionInfo {
    type: 'trade' | 'signing' | 'draft' | 'coaching_change';
    date: string;
    description: string;
    fantasyImpact: string;
}

// Add proper team injury interface
interface TeamInjuryContext {
    totalInjured: number;
    keyInjuries: Array<{
        athlete: { displayName: string; position: { abbreviation: string } };
        status: string;
    }>;
    questionable: Array<{
        athlete: { displayName: string; position: { abbreviation: string } };
        status: string;
    }>;
}

export class ContextEngine {
    private static instance: ContextEngine;
    private playerContextCache: Map<string, PlayerContext> = new Map();

    static getInstance(): ContextEngine {
        if (!ContextEngine.instance) {
            ContextEngine.instance = new ContextEngine();
        }
        return ContextEngine.instance;
    }

    async getPlayerContext(playerName: string, team: string, position: string): Promise<PlayerContext> {
        const cacheKey = `${playerName}_${team}`;

        if (this.playerContextCache.has(cacheKey)) {
            return this.playerContextCache.get(cacheKey)!;
        }

        const context = await this.buildPlayerContext(playerName, team, position);
        this.playerContextCache.set(cacheKey, context);

        return context;
    }

    async getEnhancedPlayerContext(
        playerName: string,
        team: string,
        position: string,
        athleteId?: string | undefined
    ): Promise<PlayerContext> {
        const cacheKey = `${playerName}_${team}_enhanced`;

        // Check cache first (expire after 30 minutes)
        const cached = this.playerContextCache.get(cacheKey);
        if (cached && cached.lastUpdated) {
            const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
            if (cacheAge < 30 * 60 * 1000) { // 30 minutes
                return cached;
            }
        }

        // Build enhanced context
        const context = await this.buildPlayerContext(playerName, team, position);

        // Get ESPN athlete ID from database or parameter
        let espnAthleteId = athleteId;

        if (!espnAthleteId) {
            espnAthleteId = await this.getESPNAthleteIdFromDatabase(playerName);
        }

        // Add ESPN data if we have athlete ID
        if (espnAthleteId) {
            context.espnData = await this.getESPNPlayerData(espnAthleteId, playerName);
        }

        context.lastUpdated = new Date().toISOString();
        this.playerContextCache.set(cacheKey, context);

        return context;
    }

    async getTeamContextualFactors(teamId: string): Promise<any> {
        const [depthChart, injuries, transactions] = await Promise.all([
            espnAPI.getDepthChart(teamId),
            espnAPI.getTeamInjuries(teamId),
            espnAPI.getRecentTransactions(20)
        ]);

        return {
            depthChanges: this.analyzeDepthChanges(depthChart),
            injuryImpacts: this.assessInjuryImpacts(injuries),
            recentMoves: transactions.filter(t =>
                t.teams.some(team => team.id === teamId)
            ).slice(0, 5)
        };
    }

    private async buildPlayerContext(playerName: string, team: string, position: string): Promise<PlayerContext> {
        const context: PlayerContext = { playerName, team, position };

        // Get coaching changes
        const coachingChange = dataParser.getCoachingChange(team);
        if (coachingChange) {
            context.coachingImpact = this.extractCoachingImpact(coachingChange, position);
        }

        // Get recent transactions (you'd expand this with real data)
        context.transactions = await this.getKnownTransactions(playerName, team);

        // Get team context
        context.teamContext = this.getTeamContext(team);

        return context;
    }

    private extractCoachingImpact(coaching: any, position: string): string {
        // Extract position-specific coaching impact
        const impact = coaching.fantasyImpact.toLowerCase();

        if (position === 'RB' && impact.includes('run')) {
            return 'New coaching staff may emphasize ground game';
        } else if (['WR', 'TE'].includes(position) && impact.includes('pass')) {
            return 'Offensive philosophy change could boost target share';
        }

        return 'Coaching change brings scheme uncertainty';
    }

    private async getKnownTransactions(playerName: string, currentTeam: string): Promise<TransactionInfo | undefined> {
        try {
            // First check ESPN transactions for this player
            const transactions = await espnAPI.getRecentTransactions(50);

            // Look for transactions involving this player
            const playerTransaction = transactions.find(t =>
                t.athletes.some(athlete =>
                    athlete.displayName.toLowerCase().includes(playerName.toLowerCase()) ||
                    playerName.toLowerCase().includes(athlete.displayName.toLowerCase())
                )
            );

            if (playerTransaction) {
                return {
                    type: 'trade',
                    date: playerTransaction.date,
                    description: playerTransaction.text,
                    fantasyImpact: this.analyzeTransactionImpact(playerTransaction.text, playerName)
                };
            }

            // Fallback to known major transactions for 2025 season
            const knownTransactions = this.getHardcodedTransactions();
            const known = knownTransactions[playerName];

            if (known) {
                return known;
            }

            // Check if player changed teams between 2024 and 2025
            const teamChangeDetected = await this.detectTeamChange(playerName, currentTeam);
            if (teamChangeDetected) {
                return teamChangeDetected;
            }

            return undefined;
        } catch (error: any) {
            console.warn(`Error getting transactions for ${playerName}:`, error);
            return this.getHardcodedTransactions()[playerName];
        }
    }

    private analyzeTransactionImpact(transactionText: string, playerName: string): string {
        const text = transactionText.toLowerCase();

        if (text.includes('trade')) {
            return 'New team chemistry and role uncertainty following trade';
        } else if (text.includes('sign')) {
            return 'Fresh start with new organization and offensive system';
        } else if (text.includes('claim')) {
            return 'Opportunity for increased role after team change';
        }

        return 'Team change creates uncertainty in fantasy outlook';
    }

    private getHardcodedTransactions(): Record<string, TransactionInfo> {
        return {
            'Jonnu Smith': {
                type: 'trade',
                date: '2024-10-29',
                description: 'Traded from Dolphins to Steelers',
                fantasyImpact: 'New team, new QB - chemistry and role unclear'
            },
            'Evan Engram': {
                type: 'signing',
                date: '2025-03-15',
                description: 'Signed with Broncos after release from Jaguars',
                fantasyImpact: 'First season in Denver - role and target share unknown'
            },
            'Calvin Ridley': {
                type: 'signing',
                date: '2024-03-15',
                description: 'Signed with Titans after season with Jaguars',
                fantasyImpact: 'Fresh start in new system with established QB'
            },
            'Najee Harris': {
                type: 'signing',
                date: '2025-03-10',
                description: 'Signed with Chargers after leaving Steelers',
                fantasyImpact: 'New team, potential backfield competition with rookie draft capital'
            },
            'Rhamondre Stevenson': {
                type: 'draft',
                date: '2025-04-26',
                description: 'Patriots drafted Travion Henderson - potential backfield competition',
                fantasyImpact: 'High draft capital rookie may impact workload distribution'
            }
            // Add more known 2025 team changes...
        };
    }

    private async detectTeamChange(playerName: string, currentTeam: string): Promise<TransactionInfo | undefined> {
        try {
            // Query database for player's 2024 team vs current team
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { data: player } = await supabase
                .from('players')
                .select('name, team, team_2024')  // Assuming you have a team_2024 column
                .eq('name', playerName)
                .maybeSingle();

            if (player && player.team_2024 && player.team_2024 !== currentTeam) {
                return {
                    type: 'signing',
                    date: '2025-03-01', // Approximate offseason
                    description: `Moved from ${player.team_2024} to ${currentTeam}`,
                    fantasyImpact: `First season with ${currentTeam} - no established chemistry or role`
                };
            }

            return undefined;
        } catch (error: any) {
            console.warn(`Error detecting team change for ${playerName}:`, error);
            return undefined;
        }
    }

    private getTeamContext(team: string): string {
        const teamContexts: Record<string, string> = {
            'PIT': 'Transitioning to Aaron Rodgers at QB - new offensive identity',
            'TEN': 'Established passing attack with Will Levis development',
            'PHI': 'High-powered offense with multiple receiving threats',
            // Add more team contexts...
        };

        return teamContexts[team] || '';
    }

    private analyzePlayerSplits(splits: any): string[] {
        const insights: string[] = [];

        // Analyze home/away performance
        if (splits.homeAway) {
            const home = splits.homeAway.find(s => s.name === 'Home');
            const away = splits.homeAway.find(s => s.name === 'Away');

            if (home && away) {
                const homePPG = home.stats?.fantasyPoints / home.stats?.games || 0;
                const awayPPG = away.stats?.fantasyPoints / away.stats?.games || 0;

                if (homePPG > awayPPG * 1.2) {
                    insights.push('Significantly better fantasy performer at home');
                } else if (awayPPG > homePPG * 1.2) {
                    insights.push('Road warrior - performs better away from home');
                }
            }
        }

        return insights;
    }

    // Add this method to get ESPN ID from your existing database
    private async getESPNAthleteIdFromDatabase(playerName: string): Promise<string | undefined> {
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Try exact name match first
            let { data: player } = await supabase
                .from('players')
                .select('espn_id')
                .eq('name', playerName)
                .maybeSingle();

            // If no exact match, try normalized search
            if (!player) {
                const normalizedName = this.normalizePlayerName(playerName);

                const { data: players } = await supabase
                    .from('players')
                    .select('name, espn_id')
                    .not('espn_id', 'is', null);

                // Find best match using name normalization
                player = players?.find(p =>
                    this.normalizePlayerName(p.name) === normalizedName
                );
            }

            return player?.espn_id || undefined;
        } catch (error: any) {
            console.warn(`Could not get ESPN ID for ${playerName}:`, error);
            return undefined;
        }
    }

    private normalizePlayerName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private async getESPNPlayerData(athleteId: string, playerName: string): Promise<ESPNPlayerData> {
        try {
            const news = await espnAPI.getPlayerNews(athleteId);

            const espnData: ESPNPlayerData = {
                athleteId,
                recentNews: news.slice(0, 5).map(item => ({
                    headline: item.headline,
                    type: item.type,
                    impact: item.impact,
                    published: item.published
                }))
            };

            // Extract injury status from news
            const injuryNews = news.find(item => item.type === 'injury' && item.impact !== 'low');
            if (injuryNews) {
                espnData.injuryStatus = {
                    status: this.extractInjuryStatus(injuryNews.headline),
                    details: injuryNews.description,
                    severity: injuryNews.impact as 'high' | 'medium' | 'low'
                };
            }

            return espnData;
        } catch (error: any) {
            console.error(`Error getting ESPN data for ${playerName}:`, error);
            return { recentNews: [] };
        }
    }

    private extractInjuryStatus(headline: string): string {
        const lower = headline.toLowerCase();

        if (lower.includes('out') || lower.includes('ir')) return 'Out';
        if (lower.includes('doubtful')) return 'Doubtful';
        if (lower.includes('questionable')) return 'Questionable';
        if (lower.includes('probable')) return 'Probable';
        if (lower.includes('limited')) return 'Limited';

        return 'Unknown';
    }

    // Add these placeholder methods that are referenced but missing
    private analyzeDepthChanges(depthChart: any): string[] {
        // Placeholder - implement later if needed
        return [];
    }

    private assessInjuryImpacts(injuries: any[]): string[] {
        // Placeholder - implement later if needed
        return [];
    }

    // Add this method to validate stats relevance
    validateStatsRelevance(playerContext: PlayerContext): {
        statsValid: boolean;
        warningMessage?: string;
    } {
        // If player has a recent transaction, stats might be from wrong team
        if (playerContext.transactions) {
            const transactionDate = new Date(playerContext.transactions.date);
            const cutoffDate = new Date('2024-09-01'); // Start of 2024 season

            if (transactionDate > cutoffDate) {
                return {
                    statsValid: false,
                    warningMessage: `2024 stats from previous team (${playerContext.transactions.description})`
                };
            }
        }

        return { statsValid: true };
    }

    // Method to get contextual factors for player comparison
    async getPlayerContextualFactors(playerName: string, team: string, position: string): Promise<string[]> {
        const factors: string[] = [];

        // Validate stats first
        const playerContext = await this.getEnhancedPlayerContext(playerName, team, position);
        const statsValidation = this.validateStatsRelevance(playerContext);
        if (!statsValidation.statsValid) {
            factors.push(statsValidation.warningMessage!);
        }

        // ESPN injury context
        if (playerContext.espnData?.injuryStatus) {
            const injury = playerContext.espnData.injuryStatus;
            if (injury.severity === 'high') {
                factors.push(`Injury concern: ${injury.status} - ${injury.details.substring(0, 60)}...`);
            } else if (injury.severity === 'medium') {
                factors.push(`Monitor injury status: ${injury.status}`);
            }
        }

        // Transaction context (enhanced)
        if (playerContext.transactions) {
            factors.push(playerContext.transactions.fantasyImpact);
        }

        // Coaching context
        if (playerContext.coachingImpact) {
            factors.push(playerContext.coachingImpact);
        }

        // Add coaching impact check (NEW)
        const coachingImpact = await this.checkCoachingImpact(team);
        if (coachingImpact) {
            factors.push(coachingImpact);
        }

        // Check for rookie competition (NOW ASYNC)
        const rookieCompetition = await this.checkRookieCompetition(playerName, position, team);
        if (rookieCompetition) {
            factors.push(rookieCompetition);
        }

        return factors.slice(0, 2); // Limit to 2 most relevant
    }

    private async checkRookieCompetition(playerName: string, position: string, team: string): Promise<string | undefined> {
        try {
            // Ensure rookie data is loaded
            await dataParser.parseRookieDraftCapital();

            const competition = dataParser.getRookieCompetition(playerName);
            if (competition) {
                return `${competition.impactDescription} - ${competition.rookiePlayer} drafted in Round ${competition.round}`;
            }

            return undefined;
        } catch (error: any) {
            console.warn(`Error checking rookie competition for ${playerName}:`, error);
            return undefined;
        }
    }

    private async checkCoachingImpact(team: string): Promise<string | undefined> {
        try {
            await dataParser.parseCoachingChanges();
            const changes = dataParser.getCoachingChange2025(team);

            if (changes.length > 0) {
                // Prioritize head coach changes over coordinator changes
                const headCoachChange = changes.find(c => c.role === 'Head Coach');
                const ocChange = changes.find(c => c.role === 'Offensive Coordinator');

                if (headCoachChange) {
                    return `New head coach ${headCoachChange.coachName}: ${headCoachChange.fantasyImpact}`;
                } else if (ocChange) {
                    return `New offensive coordinator ${ocChange.coachName}: ${ocChange.fantasyImpact}`;
                }
            }

            return undefined;
        } catch (error: any) {
            console.warn(`Error checking coaching changes for ${team}:`, error);
            return undefined;
        }
    }

    // Method to invalidate cache when news breaks
    invalidatePlayerCache(playerName: string): void {
        const keysToDelete: string[] = [];

        for (const [key, _] of this.playerContextCache) {
            if (key.includes(playerName)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.playerContextCache.delete(key));
        console.log(`🗑️ Invalidated cache for ${playerName} (${keysToDelete.length} entries)`);
    }

    // Method to get team injury report
    async getTeamInjuryContext(teamId: string): Promise<TeamInjuryContext> {
        try {
            const injuries = await espnAPI.getTeamInjuries(teamId);

            return {
                totalInjured: injuries.length,
                keyInjuries: injuries.filter(injury =>
                    ['Out', 'Doubtful', 'IR'].includes(injury.status)
                ).map(injury => ({
                    athlete: {
                        displayName: injury.athlete.displayName,
                        position: { abbreviation: injury.athlete.position.abbreviation }
                    },
                    status: injury.status
                })),
                questionable: injuries.filter(injury =>
                    injury.status === 'Questionable'
                ).map(injury => ({
                    athlete: {
                        displayName: injury.athlete.displayName,
                        position: { abbreviation: injury.athlete.position.abbreviation }
                    },
                    status: injury.status
                }))
            };
        } catch (error: any) {
            console.error(`Error getting team injury context for ${teamId}:`, error);
            return { totalInjured: 0, keyInjuries: [], questionable: [] };
        }
    }
}

export const contextEngine = ContextEngine.getInstance();
