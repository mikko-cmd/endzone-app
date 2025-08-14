// Strict TypeScript interfaces
interface ESPNPlayerNews {
    headline: string;
    description: string;
    published: string;
    type: 'injury' | 'transaction' | 'performance' | 'general';
    impact: 'high' | 'medium' | 'low';
    playerId?: string;
}

interface ESPNInjury {
    athlete: {
        id: string;
        displayName: string;
        position: {
            abbreviation: string;
        };
    };
    status: string;
    details: string;
    date: string;
}

interface ESPNTransaction {
    date: string;
    type: string;
    text: string;
    athletes: Array<{ id: string; displayName: string }>;
    teams: Array<{ id: string; displayName: string }>;
}

interface ESPNDepthChart {
    position: string;
    formations: Array<{
        formation: string;
        athletes: Array<{
            athlete: { id: string; displayName: string };
            slot: number;
        }>;
    }>;
}

// Proper API response types
interface ESPNNewsResponse {
    articles?: Array<{
        headline: string;
        description: string;
        published: string;
    }>;
}

interface ESPNInjuryResponse {
    items?: Array<{
        athlete?: {
            id?: string;
            displayName?: string;
            position?: {
                abbreviation?: string;
            };
        };
        status?: string;
        details?: string;
        date?: string;
    }>;
}

interface ESPNSearchResponse {
    results?: Array<{
        type: string;
        sport?: { name: string };
        league?: { name: string };
        id: string;
        displayName: string;
    }>;
}

export class ESPNApiService {
    private readonly baseUrl = 'https://site.api.espn.com/apis';
    private readonly coreUrl = 'https://sports.core.api.espn.com/v2';
    private readonly webUrl = 'https://site.web.api.espn.com/apis';

    // Get player-specific breaking news
    async getPlayerNews(athleteId: string): Promise<ESPNPlayerNews[]> {
        try {
            const url = `${this.baseUrl}/fantasy/v2/games/ffl/news/players?limit=10&playerId=${athleteId}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN API error for player ${athleteId}: ${response.status}`);
                return [];
            }

            const data: ESPNNewsResponse = await response.json();

            return (data.articles || []).map((article): ESPNPlayerNews => ({
                headline: article.headline || '',
                description: article.description || '',
                published: article.published || new Date().toISOString(),
                type: this.categorizeNews(article.headline || ''),
                impact: this.assessNewsImpact(article.headline || '', article.description || ''),
                playerId: athleteId
            }));
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error fetching player news:', error);
            return [];
        }
    }

    // Get general NFL news
    async getGeneralNews(limit: number = 20): Promise<ESPNPlayerNews[]> {
        try {
            const url = `${this.baseUrl}/site/v2/sports/football/nfl/news?limit=${limit}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN API error for general news: ${response.status}`);
                return [];
            }

            const data: ESPNNewsResponse = await response.json();

            return (data.articles || []).map((article): ESPNPlayerNews => ({
                headline: article.headline || '',
                description: article.description || '',
                published: article.published || new Date().toISOString(),
                type: this.categorizeNews(article.headline || ''),
                impact: this.assessNewsImpact(article.headline || '', article.description || '')
            }));
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error fetching general news:', error);
            return [];
        }
    }

    // Get team injuries
    async getTeamInjuries(teamId: string): Promise<ESPNInjury[]> {
        try {
            const url = `${this.coreUrl}/sports/football/leagues/nfl/teams/${teamId}/injuries`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN API error for team ${teamId} injuries: ${response.status}`);
                return [];
            }

            const data: ESPNInjuryResponse = await response.json();

            return (data.items || []).map((injury): ESPNInjury => ({
                athlete: {
                    id: injury.athlete?.id || '',
                    displayName: injury.athlete?.displayName || '',
                    position: {
                        abbreviation: injury.athlete?.position?.abbreviation || ''
                    }
                },
                status: injury.status || 'Unknown',
                details: injury.details || '',
                date: injury.date || new Date().toISOString()
            }));
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error fetching team injuries:', error);
            return [];
        }
    }

    // Get recent transactions
    async getRecentTransactions(limit: number = 50): Promise<ESPNTransaction[]> {
        try {
            const url = `${this.coreUrl}/sports/football/leagues/nfl/transactions?limit=${limit}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN API error for transactions: ${response.status}`);
                return [];
            }

            const data: any = await response.json(); // Using any for complex transaction structure

            return (data.items || []).map((transaction: any): ESPNTransaction => ({
                date: transaction.date || new Date().toISOString(),
                type: transaction.type || 'Unknown',
                text: transaction.text || '',
                athletes: transaction.athletes || [],
                teams: transaction.teams || []
            }));
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error fetching transactions:', error);
            return [];
        }
    }

    // Get live depth charts
    async getDepthChart(teamId: string, year: number = 2025): Promise<ESPNDepthChart[]> {
        try {
            const url = `${this.coreUrl}/sports/football/leagues/nfl/seasons/${year}/teams/${teamId}/depthcharts`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN API error for team ${teamId} depth chart: ${response.status}`);
                return [];
            }

            const data: any = await response.json(); // Using any for complex depth chart structure
            return data.items || [];
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error fetching depth chart:', error);
            return [];
        }
    }

    // Search for players to get their ESPN athlete ID
    async searchPlayer(playerName: string): Promise<Array<{ id: string; displayName: string }>> {
        try {
            const url = `${this.webUrl}/search/v2?limit=10&query=${encodeURIComponent(playerName)}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`ESPN search API error for ${playerName}: ${response.status}`);
                return [];
            }

            const data: ESPNSearchResponse = await response.json();

            // Filter for NFL athletes with proper type checking
            return (data.results || [])
                .filter((result): result is typeof result & { id: string; displayName: string } =>
                    result.type === 'athlete' &&
                    result.sport?.name === 'football' &&
                    result.league?.name === 'NFL' &&
                    typeof result.id === 'string' &&
                    typeof result.displayName === 'string'
                )
                .map(result => ({
                    id: result.id,
                    displayName: result.displayName
                }));
        } catch (error: any) { // Fixed: Added ": any" to catch
            console.error('Error searching player:', error);
            return [];
        }
    }

    private categorizeNews(headline: string): 'injury' | 'transaction' | 'performance' | 'general' {
        const lower = headline.toLowerCase();

        // Injury keywords
        if (lower.includes('injury') || lower.includes('hurt') || lower.includes('injured') ||
            lower.includes('questionable') || lower.includes('doubtful') || lower.includes('out') ||
            lower.includes('ir') || lower.includes('surgery') || lower.includes('concussion') ||
            lower.includes('ankle') || lower.includes('knee') || lower.includes('shoulder') ||
            lower.includes('hamstring') || lower.includes('groin') || lower.includes('back')) {
            return 'injury';
        }

        // Transaction keywords
        if (lower.includes('trade') || lower.includes('traded') || lower.includes('sign') ||
            lower.includes('signed') || lower.includes('release') || lower.includes('released') ||
            lower.includes('waive') || lower.includes('waived') || lower.includes('cut') ||
            lower.includes('claim') || lower.includes('claimed') || lower.includes('acquire')) {
            return 'transaction';
        }

        // Performance keywords
        if (lower.includes('touchdown') || lower.includes('yards') || lower.includes('performance') ||
            lower.includes('stats') || lower.includes('record') || lower.includes('career') ||
            lower.includes('season high') || lower.includes('breakout')) {
            return 'performance';
        }

        return 'general';
    }

    private assessNewsImpact(headline: string, description: string): 'high' | 'medium' | 'low' {
        const text = (headline + ' ' + description).toLowerCase();

        // High impact keywords
        if (text.includes('out for season') || text.includes('ir') || text.includes('surgery') ||
            text.includes('torn') || text.includes('fracture') || text.includes('traded') ||
            text.includes('released') || text.includes('waived') || text.includes('suspended') ||
            text.includes('out indefinitely') || text.includes('multiple weeks') ||
            text.includes('starting') || text.includes('benched')) {
            return 'high';
        }

        // Medium impact keywords
        if (text.includes('questionable') || text.includes('doubtful') || text.includes('limited') ||
            text.includes('backup') || text.includes('week-to-week') || text.includes('day-to-day') ||
            text.includes('probable') || text.includes('game-time decision') ||
            text.includes('minor') || text.includes('signed') || text.includes('claimed')) {
            return 'medium';
        }

        return 'low';
    }
}

export const espnAPI = new ESPNApiService();



