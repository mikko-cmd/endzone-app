// scripts/debugPlayerNews.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

class PlayerNewsDebugger {
    private supabase;

    constructor() {
        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }

    async debugSpecificPlayer(searchName: string) {
        console.log(`🔍 Debugging news for: "${searchName}"`);
        console.log('='.repeat(60));

        // 1. Check how the player exists in our database
        const { data: players, error } = await this.supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .ilike('name', `%${searchName}%`)
            .limit(10);

        if (error) {
            console.error('❌ Database error:', error);
            return;
        }

        console.log(`📊 Found ${players.length} players matching "${searchName}":`);
        players.forEach((player, i) => {
            console.log(`  ${i + 1}. "${player.name}" (${player.position}, ${player.team}) - ID: ${player.sleeper_id}`);
        });

        if (players.length === 0) {
            console.log('❌ No players found! Check database or search term.');
            return;
        }

        const targetPlayer = players[0]; // Use first match
        console.log(`\n🎯 Using player: "${targetPlayer.name}"`);

        // 2. Fetch recent ESPN articles
        console.log('\n📰 Fetching recent ESPN articles...');
        const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news', {
            params: { limit: 20 },
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const articles = response.data.articles || [];
        console.log(`📄 Fetched ${articles.length} articles`);

        // 3. Test matching logic
        console.log(`\n🔍 Testing matching for "${targetPlayer.name}"...`);

        const playerName = targetPlayer.name.toLowerCase();
        const firstName = playerName.split(' ')[0];
        const lastName = playerName.split(' ')[1] || '';

        console.log(`   - Full name: "${playerName}"`);
        console.log(`   - First name: "${firstName}"`);
        console.log(`   - Last name: "${lastName}"`);
        console.log(`   - Team: "${targetPlayer.team}"`);

        let foundMatches = 0;

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            const searchText = `${article.headline} ${article.description}`.toLowerCase();

            let relevanceScore = 0;
            let matchReason = '';

            // Full name match
            if (searchText.includes(playerName)) {
                relevanceScore = 10;
                matchReason = 'Full name match';
            }
            // Alternative name formats for A.J. Brown
            else if (playerName.includes('a.j.') && (searchText.includes('aj brown') || searchText.includes('a.j. brown'))) {
                relevanceScore = 10;
                matchReason = 'Alternative name format (A.J./AJ)';
            }
            // Last name + first initial
            else if (lastName && searchText.includes(lastName) && searchText.includes(firstName[0])) {
                relevanceScore = 8;
                matchReason = 'Last name + first initial';
            }
            // Last name only
            else if (lastName && searchText.includes(lastName)) {
                relevanceScore = lastName.length > 4 ? 6 : 3;
                matchReason = `Last name only (score: ${relevanceScore})`;
            }
            // First name + team
            else if (searchText.includes(firstName) && targetPlayer.team &&
                searchText.includes(targetPlayer.team.toLowerCase())) {
                relevanceScore = 5;
                matchReason = 'First name + team';
            }

            if (relevanceScore > 0) {
                foundMatches++;
                console.log(`\n📰 MATCH ${foundMatches} (Score: ${relevanceScore}) - ${matchReason}:`);
                console.log(`   Headline: ${article.headline}`);
                console.log(`   Description: ${article.description?.substring(0, 150)}...`);
                console.log(`   Search text contains: "${playerName}" = ${searchText.includes(playerName)}`);
                console.log(`   Search text contains: "${lastName}" = ${lastName ? searchText.includes(lastName) : 'N/A'}`);
            }
        }

        if (foundMatches === 0) {
            console.log('\n❌ No matches found in recent articles!');
            console.log('\n🔍 Let\'s check what names ARE mentioned in recent headlines:');

            articles.slice(0, 5).forEach((article, i) => {
                console.log(`\n  Article ${i + 1}:`);
                console.log(`    Headline: ${article.headline}`);

                // Extract potential player names (capitalized words)
                const possibleNames = article.headline.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
                if (possibleNames.length > 0) {
                    console.log(`    Possible names: ${possibleNames.join(', ')}`);
                }
            });
        }

        // 4. Check existing news in database for this player
        console.log(`\n📋 Checking existing news in database for ${targetPlayer.name}...`);
        const { data: existingNews } = await this.supabase
            .from('player_news')
            .select('*')
            .eq('player_sleeper_id', targetPlayer.sleeper_id)
            .order('published_at', { ascending: false })
            .limit(5);

        if (existingNews && existingNews.length > 0) {
            console.log(`✅ Found ${existingNews.length} existing news items:`);
            existingNews.forEach((news, i) => {
                console.log(`  ${i + 1}. ${news.headline} (Score: ${news.relevance_score})`);
            });
        } else {
            console.log('❌ No existing news found in database');
        }
    }
}

// Run the debug
const newsDebugger = new PlayerNewsDebugger();
const playerToDebug = process.argv[2] || 'A.J. Brown';
newsDebugger.debugSpecificPlayer(playerToDebug);
