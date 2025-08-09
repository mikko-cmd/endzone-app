// scripts/dailyNewsScanner.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

interface ESPNArticle {
    id: string;
    headline: string;
    description: string;
    published: string;
    lastModified: string;
    categories: any[];
    links: any[];
    images?: any[];
}

interface PlayerNewsMatch {
    playerId: string;
    playerName: string;
    articleId: string;
    headline: string;
    description: string;
    published: string;
    relevanceScore: number;
}

class DailyNewsScanner {
    private supabase;

    constructor() {
        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }

    /**
     * Fetch latest NFL news from ESPN
     */
    async fetchESPNNews(limit: number = 50): Promise<ESPNArticle[]> {
        try {
            console.log(`📰 Fetching latest ${limit} NFL news articles from ESPN...`);

            const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news', {
                params: { limit },
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const articles = response.data.articles || [];
            console.log(`✅ Successfully fetched ${articles.length} articles`);

            return articles;
        } catch (error) {
            console.error('❌ Error fetching ESPN news:', error.message);
            return [];
        }
    }

    /**
     * Get all players from our database
     */
    async getAllPlayers(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .order('name');

        if (error) {
            console.error('❌ Error fetching players:', error);
            return [];
        }

        console.log(`📊 Loaded ${data.length} players from database`);
        return data;
    }

    /**
     * Match article headlines/descriptions to player names
     */
    matchArticlesToPlayers(articles: ESPNArticle[], players: any[]): PlayerNewsMatch[] {
        console.log(`🔍 Matching articles to players...`);
        const matches: PlayerNewsMatch[] = [];

        const normalize = (s: string | null | undefined) =>
            (s || '')
                .toLowerCase()
                .replace(/[.\u2019']/g, '') // remove dots/apostrophes
                .replace(/\s+/g, ' ')
                .trim();

        for (const article of articles) {
            const searchText = normalize(`${article.headline} ${article.description}`);

            for (const player of players) {
                const full = normalize(player.name);          // e.g., "aj brown"
                const [first, last = ''] = full.split(' ');   // "aj", "brown"
                const teamNorm = normalize(player.team);

                let relevanceScore = 0;

                if (searchText.includes(full)) {
                    relevanceScore = 10;
                } else if (last && searchText.includes(last) && searchText.includes(first[0])) {
                    relevanceScore = 8;
                } else if (last && searchText.includes(last)) {
                    relevanceScore = last.length > 4 ? 6 : 3;
                } else if (searchText.includes(first) && teamNorm && searchText.includes(teamNorm)) {
                    relevanceScore = 5;
                }

                if (player.position && searchText.includes(normalize(player.position))) {
                    relevanceScore += 1;
                }

                if (relevanceScore >= 6) {
                    matches.push({
                        playerId: player.sleeper_id,
                        playerName: player.name,
                        articleId: article.id,
                        headline: article.headline,
                        description: article.description,
                        published: article.published,
                        relevanceScore,
                    });
                }
            }
        }

        console.log(`✅ Found ${matches.length} player-article matches`);
        return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Save news matches to database
     */
    async saveNewsToDatabase(matches: PlayerNewsMatch[]): Promise<void> {
        console.log(`💾 Saving ${matches.length} news items to database...`);

        // Create player_news table structure
        const newsItems = matches.map(match => ({
            player_sleeper_id: match.playerId,
            article_id: match.articleId,
            headline: match.headline,
            description: match.description,
            published_at: match.published,
            source: 'ESPN',
            relevance_score: match.relevanceScore,
            created_at: new Date().toISOString()
        }));

        // Insert in batches
        const batchSize = 100;
        let savedCount = 0;

        for (let i = 0; i < newsItems.length; i += batchSize) {
            const batch = newsItems.slice(i, i + batchSize);

            const { error } = await this.supabase
                .from('player_news')
                .upsert(batch, {
                    onConflict: 'article_id',
                    ignoreDuplicates: true
                });

            if (error) {
                console.error(`❌ Error saving batch ${i / batchSize + 1}:`, error);
            } else {
                savedCount += batch.length;
                console.log(`✅ Saved batch ${i / batchSize + 1}: ${batch.length} items`);
            }
        }

        console.log(`✅ Total saved: ${savedCount} news items`);
    }

    /**
     * Clean up old news (keep last 30 days)
     */
    async cleanupOldNews(): Promise<void> {
        console.log('🧹 Cleaning up old news...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { error } = await this.supabase
            .from('player_news')
            .delete()
            .lt('published_at', thirtyDaysAgo.toISOString());

        if (error) {
            console.error('❌ Error cleaning up old news:', error);
        } else {
            console.log('✅ Old news cleaned up successfully');
        }
    }

    /**
     * Run the full daily scan process
     */
    async runDailyScan(): Promise<void> {
        console.log('🚀 Starting Daily News Scan...');
        console.log('='.repeat(50));

        try {
            // 1. Fetch latest news
            const articles = await this.fetchESPNNews(100); // Get 100 latest articles

            if (articles.length === 0) {
                console.log('❌ No articles fetched, aborting scan');
                return;
            }

            // 2. Get all players
            const players = await this.getAllPlayers();

            if (players.length === 0) {
                console.log('❌ No players found, aborting scan');
                return;
            }

            // 3. Match articles to players
            const matches = this.matchArticlesToPlayers(articles, players);

            // 4. Save to database
            if (matches.length > 0) {
                await this.saveNewsToDatabase(matches);
            } else {
                console.log('ℹ️ No relevant matches found');
            }

            // 5. Cleanup old news
            await this.cleanupOldNews();

            console.log('✅ Daily news scan completed successfully!');

        } catch (error) {
            console.error('❌ Daily news scan failed:', error);
        }
    }
}

// Run the daily scan
const scanner = new DailyNewsScanner();
scanner.runDailyScan();
