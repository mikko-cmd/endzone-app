import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Test ESPN game log endpoints for home/away data
async function testEspnGameLogs() {
    console.log('🔍 Testing ESPN Game Log Endpoints for Home/Away Data\n');

    // Test different game log endpoint patterns
    const gameLogEndpoints = [
        {
            name: 'Player Game Log (2024)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/3917315/gamelog?season=2024',
            description: 'Josh Allen 2024 game log'
        },
        {
            name: 'Player Game Log (2023)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/3917315/gamelog?season=2023',
            description: 'Josh Allen 2023 game log'
        },
        {
            name: 'Player Game Log (no season)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/3917315/gamelog',
            description: 'Josh Allen game log (current season)'
        },
        {
            name: 'Team Schedule (2024)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/2/schedule?season=2024',
            description: 'Bills 2024 schedule'
        },
        {
            name: 'Team Schedule (2023)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/2/schedule?season=2023',
            description: 'Bills 2023 schedule'
        },
        {
            name: 'Game Details (2024)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=1&season=2024',
            description: 'Week 1 2024 scoreboard'
        }
    ];

    for (const endpoint of gameLogEndpoints) {
        console.log(`📡 Testing: ${endpoint.description}`);
        console.log(`🔗 URL: ${endpoint.url}`);

        try {
            const response = await axios.get(endpoint.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.espn.com/'
                }
            });

            if (response.status === 200) {
                const data = response.data;

                // Save response
                const filename = `espn-gamelog-${endpoint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                console.log(`✅ Saved: ${filename} (${JSON.stringify(data).length} chars)`);

                // Analyze the data for home/away indicators
                console.log(`📊 Data type: ${typeof data}`);
                if (typeof data === 'object') {
                    console.log(`�� Top-level keys: ${Object.keys(data).join(', ')}`);

                    // Look for home/away related keywords
                    const dataStr = JSON.stringify(data).toLowerCase();
                    const homeAwayKeywords = [
                        'home', 'away', 'location', 'venue', 'stadium',
                        'vs', '@', 'host', 'visitor', 'gameLocation'
                    ];

                    const foundKeywords = homeAwayKeywords.filter(keyword =>
                        dataStr.includes(keyword)
                    );

                    if (foundKeywords.length > 0) {
                        console.log(`�� Home/Away keywords found: ${foundKeywords.join(', ')}`);
                    } else {
                        console.log(`❌ No home/away keywords found`);
                    }

                    // Look for specific patterns in the data
                    if (data.events) {
                        console.log(`📊 Found ${data.events.length} events`);
                        if (data.events.length > 0) {
                            const firstEvent = data.events[0];
                            console.log(`  First event keys: ${Object.keys(firstEvent).join(', ')}`);

                            // Check for home/away in event data
                            if (firstEvent.competitions) {
                                const competition = firstEvent.competitions[0];
                                console.log(`  Competition keys: ${Object.keys(competition).join(', ')}`);

                                if (competition.venue) {
                                    console.log(`  Venue data: ${JSON.stringify(competition.venue).substring(0, 200)}...`);
                                }
                            }
                        }
                    }

                    // Look for items array (common in ESPN APIs)
                    if (data.items && Array.isArray(data.items)) {
                        console.log(`�� Found ${data.items.length} items`);
                        if (data.items.length > 0) {
                            const firstItem = data.items[0];
                            console.log(`  First item keys: ${Object.keys(firstItem).join(', ')}`);

                            // Check for home/away in item data
                            const itemStr = JSON.stringify(firstItem).toLowerCase();
                            const itemHomeAway = homeAwayKeywords.filter(keyword =>
                                itemStr.includes(keyword)
                            );
                            if (itemHomeAway.length > 0) {
                                console.log(`  🏠 Item home/away keywords: ${itemHomeAway.join(', ')}`);
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log(`❌ 404 Not Found - endpoint doesn't exist`);
            } else if (error.response?.status === 403) {
                console.log(`🔒 403 Forbidden - needs authentication`);
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }

        console.log('\n' + '-'.repeat(60) + '\n');
    }

    console.log('🎉 ESPN game log home/away testing complete!');
}

// Run the tester
testEspnGameLogs().catch(console.error);
