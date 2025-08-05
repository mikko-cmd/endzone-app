import axios from 'axios';

interface ESPNAdvancedReceivingStats {
    playerId: string;
    playerName: string;

    // ESPN-specific advanced metrics (only these 5 key stats)
    yardsAfterCatch?: number;
    yardsAtCatch?: number;
    bigPlays20Plus?: number;
    receivingFirstDowns?: number;
    espnWRRating?: number;

    // Calculated efficiency metrics
    targetEfficiency?: number; // receptions / targets
    yacPerReception?: number;
    firstDownRate?: number; // first downs / receptions

    lastUpdated: string;
}

export class ESPNAdvancedStatsService {
    private readonly baseUrl = 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes';
    private readonly headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.espn.com/'
    };

    /**
     * Get ONLY the advanced receiving stats from ESPN that NFLverse doesn't have
     */
    async getAdvancedReceivingStats(espnPlayerId: string): Promise<ESPNAdvancedReceivingStats | null> {
        try {
            console.log(`📈 Fetching ESPN advanced stats for player ${espnPlayerId}...`);

            const url = `${this.baseUrl}/${espnPlayerId}/statistics`;
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000
            });

            if (response.status !== 200 || !response.data) {
                console.log(`⚠️ No ESPN stats data for player ${espnPlayerId}`);
                return null;
            }

            const data = response.data;

            // Find the receiving category in the splits
            const receivingStats = this.extractReceivingStats(data);
            if (!receivingStats) {
                console.log(`⚠️ No receiving stats found for player ${espnPlayerId}`);
                return null;
            }

            // Get player name
            const playerName = await this.getPlayerName(espnPlayerId);

            const advancedStats: ESPNAdvancedReceivingStats = {
                playerId: espnPlayerId,
                playerName: playerName || 'Unknown',

                // Only the 5 advanced metrics we want from ESPN
                yardsAfterCatch: receivingStats.yardsAfterCatch,
                yardsAtCatch: receivingStats.yardsAtCatch,
                bigPlays20Plus: receivingStats.bigPlays20Plus,
                receivingFirstDowns: receivingStats.receivingFirstDowns,
                espnWRRating: receivingStats.espnWRRating,

                // Calculate efficiency metrics from the data
                targetEfficiency: this.calculateTargetEfficiency(receivingStats),
                yacPerReception: this.calculateYACPerReception(receivingStats),
                firstDownRate: this.calculateFirstDownRate(receivingStats),

                lastUpdated: new Date().toISOString()
            };

            console.log(`✅ Retrieved ESPN advanced stats for ${playerName}`);
            return advancedStats;

        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log(`❌ ESPN player ${espnPlayerId} not found`);
            } else {
                console.log(`❌ Error fetching ESPN stats for ${espnPlayerId}:`, error.message);
            }
            return null;
        }
    }

    /**
     * Extract only the specific receiving stats we need from ESPN's nested structure
     */
    private extractReceivingStats(data: any): any {
        try {
            const splits = data.splits;
            if (!splits?.categories) return null;

            // Find the receiving category
            const receivingCategory = splits.categories.find((cat: any) =>
                cat.name === 'receiving' || cat.abbreviation === 'rec'
            );

            if (!receivingCategory?.stats) return null;

            const stats = receivingCategory.stats;
            const statsMap: any = {};

            // Extract ONLY the specific stats we need (not the ones NFLverse already has)
            stats.forEach((stat: any) => {
                switch (stat.name) {
                    case 'receivingYardsAfterCatch':
                        statsMap.yardsAfterCatch = stat.value;
                        break;
                    case 'receivingYardsAtCatch':
                        statsMap.yardsAtCatch = stat.value;
                        break;
                    case 'receivingBigPlays':
                        statsMap.bigPlays20Plus = stat.value;
                        break;
                    case 'receivingFirstDowns':
                        statsMap.receivingFirstDowns = stat.value;
                        break;
                    case 'ESPNWRRating':
                        statsMap.espnWRRating = stat.value;
                        break;
                    // We need these for calculations but NFLverse already has them
                    case 'receivingTargets':
                        statsMap.targets = stat.value;
                        break;
                    case 'receptions':
                        statsMap.receptions = stat.value;
                        break;
                }
            });

            return statsMap;
        } catch (error) {
            console.log('⚠️ Error extracting receiving stats:', error);
            return null;
        }
    }

    /**
     * Get player name from ESPN athlete endpoint
     */
    private async getPlayerName(espnPlayerId: string): Promise<string | null> {
        try {
            const url = `${this.baseUrl}/${espnPlayerId}`;
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 5000
            });

            return response.data?.displayName || response.data?.fullName || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Calculate target efficiency (receptions / targets)
     */
    private calculateTargetEfficiency(stats: any): number | undefined {
        if (!stats.receptions || !stats.targets || stats.targets === 0) return undefined;
        return Math.round((stats.receptions / stats.targets) * 1000) / 10; // Percentage with 1 decimal
    }

    /**
     * Calculate YAC per reception
     */
    private calculateYACPerReception(stats: any): number | undefined {
        if (!stats.yardsAfterCatch || !stats.receptions || stats.receptions === 0) return undefined;
        return Math.round((stats.yardsAfterCatch / stats.receptions) * 10) / 10; // 1 decimal place
    }

    /**
     * Calculate first down rate (first downs / receptions)
     */
    private calculateFirstDownRate(stats: any): number | undefined {
        if (!stats.receivingFirstDowns || !stats.receptions || stats.receptions === 0) return undefined;
        return Math.round((stats.receivingFirstDowns / stats.receptions) * 1000) / 10; // Percentage with 1 decimal
    }

    /**
     * Get advanced stats for multiple players (for your comparison tool)
     */
    async getBulkAdvancedStats(espnPlayerIds: string[]): Promise<ESPNAdvancedReceivingStats[]> {
        console.log(`📊 Fetching ESPN advanced stats for ${espnPlayerIds.length} players...`);

        const results: ESPNAdvancedReceivingStats[] = [];

        // Process players in small batches to avoid rate limiting
        const batchSize = 3;
        for (let i = 0; i < espnPlayerIds.length; i += batchSize) {
            const batch = espnPlayerIds.slice(i, i + batchSize);

            const batchPromises = batch.map(playerId =>
                this.getAdvancedReceivingStats(playerId)
            );

            const batchResults = await Promise.all(batchPromises);

            // Add successful results
            batchResults.forEach(result => {
                if (result) results.push(result);
            });

            // Small delay between batches to be respectful to ESPN's servers
            if (i + batchSize < espnPlayerIds.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`✅ Retrieved ESPN advanced stats for ${results.length}/${espnPlayerIds.length} players`);
        return results;
    }
}

export const espnAdvancedStats = new ESPNAdvancedStatsService();
