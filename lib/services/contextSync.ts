import { espnAPI } from './espnAPI';
import { contextEngine } from '../contextEngine';
// import { NewsAnalyzer } from './newsAnalyzer';
import { playerMapping } from './playerMapping';

interface SyncMetrics {
    lastSync: string;
    newsProcessed: number;
    playersUpdated: number;
    errors: number;
}

export class ContextSyncService {
    private syncInterval: NodeJS.Timeout | null = null;
    private isGameDay: boolean = false;
    private metrics: SyncMetrics = {
        lastSync: '',
        newsProcessed: 0,
        playersUpdated: 0,
        errors: 0
    };

    startRealTimeSync(): void {
        // Check if it's game day (Thu-Mon during NFL season)
        this.updateGameDayStatus();

        // Sync more frequently on game days
        const interval = this.isGameDay ? 10 * 60 * 1000 : 30 * 60 * 1000; // 10min vs 30min

        this.syncInterval = setInterval(async () => {
            await this.syncCriticalUpdates();
        }, interval);

        console.log(`🔄 Context sync started (${this.isGameDay ? 'Game Day' : 'Regular'} mode)`);
    }

    stopRealTimeSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏹️ Context sync stopped');
        }
    }

    async syncCriticalUpdates(): Promise<void> {
        try {
            console.log('🔄 Starting context sync...');

            // Parallel sync operations
            const [transactions, generalNews] = await Promise.all([
                espnAPI.getRecentTransactions(10),
                espnAPI.getGeneralNews(20)
            ]);

            let playersUpdated = 0;
            let newsProcessed = 0;

            // Process transactions
            for (const transaction of transactions) {
                for (const athlete of transaction.athletes) {
                    if (athlete.displayName) {
                        await contextEngine.invalidatePlayerCache(athlete.displayName);
                        playersUpdated++;
                    }
                }
            }

            // Process breaking news for impact
            for (const news of generalNews) {
                if (news.impact === 'high' || news.impact === 'medium') {
                    // Extract player names from headline/description
                    const playerNames = this.extractPlayerNames(news.headline + ' ' + news.description);

                    for (const playerName of playerNames) {
                        // const impact = NewsAnalyzer.analyzeNews(news.headline, news.description, playerName);
                        const impact = {
                            actionable: true,
                            severity: 'medium' as const
                        };

                        if (impact.actionable) {
                            await contextEngine.invalidatePlayerCache(playerName);
                            playersUpdated++;

                            // Log updates (simplified - no severity distinction for now)
                            console.log(`📰 NEWS UPDATE: ${playerName} - ${news.headline}`);
                        }
                    }
                    newsProcessed++;
                }
            }

            // Update metrics
            this.metrics = {
                lastSync: new Date().toISOString(),
                newsProcessed,
                playersUpdated,
                errors: 0
            };

            console.log(`✅ Context sync completed: ${newsProcessed} news, ${playersUpdated} players updated`);

        } catch (error: any) {
            this.metrics.errors++;
            console.error('❌ Context sync failed:', error);
        }
    }

    private updateGameDayStatus(): void {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Game days: Thursday (4), Sunday (0), Monday (1)
        this.isGameDay = day === 0 || day === 1 || day === 4;
    }

    private extractPlayerNames(text: string): string[] {
        // Simple regex to find capitalized names (First Last format)
        const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
        const matches = text.match(namePattern) || [];

        // Filter out common non-player words
        const excludeWords = ['New York', 'Los Angeles', 'San Francisco', 'Green Bay', 'Las Vegas', 'Kansas City'];

        return matches.filter(name =>
            !excludeWords.includes(name) &&
            name.length > 5 // Minimum reasonable name length
        );
    }

    // Manual sync trigger for critical situations
    async forceSyncPlayer(playerName: string): Promise<void> {
        try {
            console.log(`🔄 Force syncing ${playerName}...`);

            // Get ESPN athlete ID
            const athleteId = await playerMapping.getESPNAthleteId(playerName);

            if (athleteId) {
                const news = await espnAPI.getPlayerNews(athleteId);

                if (news.length > 0) {
                    await contextEngine.invalidatePlayerCache(playerName);
                    console.log(`✅ Force sync completed for ${playerName}: ${news.length} news items`);
                }
            }
        } catch (error: any) {
            console.error(`❌ Force sync failed for ${playerName}:`, error);
        }
    }

    getMetrics(): SyncMetrics {
        return { ...this.metrics };
    }
}

export const contextSync = new ContextSyncService();
