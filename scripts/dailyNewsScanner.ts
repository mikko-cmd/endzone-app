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
     * Match articles to players with improved relevance scoring
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

        // Team name mapping for better matching
        const teamMap: Record<string, string[]> = {
            'ATL': ['falcons', 'atlanta'],
            'BAL': ['ravens', 'baltimore'],
            'BUF': ['bills', 'buffalo'],
            'CAR': ['panthers', 'carolina'],
            'CHI': ['bears', 'chicago'],
            'CIN': ['bengals', 'cincinnati'],
            'CLE': ['browns', 'cleveland'],
            'DAL': ['cowboys', 'dallas'],
            'DEN': ['broncos', 'denver'],
            'DET': ['lions', 'detroit'],
            'GB': ['packers', 'green bay'],
            'HOU': ['texans', 'houston'],
            'IND': ['colts', 'indianapolis'],
            'JAX': ['jaguars', 'jacksonville'],
            'KC': ['chiefs', 'kansas city'],
            'LV': ['raiders', 'las vegas'],
            'LAC': ['chargers', 'los angeles'],
            'LAR': ['rams', 'los angeles'],
            'MIA': ['dolphins', 'miami'],
            'MIN': ['vikings', 'minnesota'],
            'NE': ['patriots', 'new england'],
            'NO': ['saints', 'new orleans'],
            'NYG': ['giants', 'new york'],
            'NYJ': ['jets', 'new york'],
            'PHI': ['eagles', 'philadelphia'],
            'PIT': ['steelers', 'pittsburgh'],
            'SF': ['49ers', 'san francisco'],
            'SEA': ['seahawks', 'seattle'],
            'TB': ['buccaneers', 'tampa bay'],
            'TEN': ['titans', 'tennessee'],
            'WAS': ['commanders', 'washington'],
        };

        for (const article of articles) {
            const searchText = normalize(`${article.headline} ${article.description}`);
            const headline = normalize(article.headline);
            const description = normalize(article.description);

            // Track all potential matches with their scores
            const potentialMatches: { player: any; score: number }[] = [];

            for (const player of players) {
                const full = normalize(player.name);
                const parts = full.split(' ');
                const first = parts[0];
                const last = parts[parts.length - 1];
                const teamNorm = normalize(player.team);
                const teamVariants = teamMap[player.team] || [];

                let relevanceScore = 0;

                // HEADLINE SCORING (much higher weight)
                if (headline.includes(full)) {
                    relevanceScore += 25; // Full name in headline = primary subject
                } else if (last && headline.includes(last) && headline.includes(first[0])) {
                    relevanceScore += 20; // "J. Smith" format in headline
                } else if (last && last.length > 4 && headline.includes(last)) {
                    relevanceScore += 15; // Last name only in headline (if unique enough)
                }

                // DESCRIPTION SCORING (medium weight)
                if (description.includes(full)) {
                    relevanceScore += 10; // Full name in description
                } else if (last && description.includes(last) && description.includes(first[0])) {
                    relevanceScore += 8; // "J. Smith" format in description
                } else if (last && last.length > 4 && description.includes(last)) {
                    relevanceScore += 5; // Last name only in description
                }

                // CONTEXT SCORING (confirms relevance)
                if (player.position && searchText.includes(normalize(player.position))) {
                    relevanceScore += 2; // Position mentioned
                }

                if (teamNorm && (searchText.includes(teamNorm) || teamVariants.some(variant => searchText.includes(variant)))) {
                    relevanceScore += 2; // Team mentioned
                }

                // PROXIMITY SCORING (name near key contextual words)
                const contextWords = ['traded', 'signed', 'injured', 'touchdown', 'yards', 'catch', 'rush', 'passing'];
                for (const word of contextWords) {
                    if (searchText.includes(word) && searchText.includes(last)) {
                        const nameIndex = searchText.indexOf(last);
                        const wordIndex = searchText.indexOf(word);
                        const distance = Math.abs(nameIndex - wordIndex);
                        if (distance < 50) { // Within 50 characters
                            relevanceScore += 1;
                        }
                    }
                }

                if (relevanceScore > 0) {
                    potentialMatches.push({ player, score: relevanceScore });
                }
            }

            // Sort by relevance and only take articles where someone has a strong score
            potentialMatches.sort((a, b) => b.score - a.score);

            // Only include if:
            // 1. Top scorer has at least 12 points (strong relevance)
            // 2. OR top scorer has 8+ and is significantly higher than second place
            if (potentialMatches.length > 0) {
                const topMatch = potentialMatches[0];
                const secondMatch = potentialMatches[1];

                const shouldInclude =
                    topMatch.score >= 12 ||
                    (topMatch.score >= 8 && (!secondMatch || topMatch.score >= secondMatch.score * 1.5));

                if (shouldInclude) {
                    // Only include the top match to avoid duplicate irrelevant entries
                    matches.push({
                        playerId: topMatch.player.sleeper_id,
                        playerName: topMatch.player.name,
                        articleId: article.id,
                        headline: article.headline,
                        description: article.description,
                        published: article.published,
                        relevanceScore: topMatch.score,
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
