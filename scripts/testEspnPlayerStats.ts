import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Test ESPN player stats endpoints for projection data
async function testEspnPlayerStats() {
    console.log('🔍 Testing ESPN Player Stats Endpoints\n');

    // Test different stats endpoint patterns for Davante Adams (ID: 16800)
    const statsEndpoints = [
        {
            name: 'Player Stats (2025)',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/16800/statistics',
            description: 'Davante Adams 2025 statistics'
        },
        {
            name: 'Player Stats (general)',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/16800/statistics',
            description: 'Davante Adams general statistics'
        },
        {
            name: 'Player Projections (2025)',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/16800/projections',
            description: 'Davante Adams 2025 projections'
        },
        {
            name: 'Player Event Log',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/16800/eventlog?lang=en&region=us',
            description: 'Davante Adams event log (from API)'
        },
        {
            name: 'Player Notes',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/16800/notes?lang=en&region=us',
            description: 'Davante Adams notes (from API)'
        },
        {
            name: 'Player Stats (2024)',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/athletes/16800/statistics',
            description: 'Davante Adams 2024 statistics'
        }
    ];

    for (const endpoint of statsEndpoints) {
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
                const filename = `davante-adams-${endpoint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                console.log(`✅ Saved: ${filename} (${JSON.stringify(data).length} chars)`);

                // Analyze the data
                console.log(`📊 Data type: ${typeof data}`);
                if (typeof data === 'object') {
                    console.log(`📊 Top-level keys: ${Object.keys(data).join(', ')}`);

                    // Look for stats, projections, or fantasy-related data
                    const relevantKeys = Object.keys(data).filter(key =>
                        key.toLowerCase().includes('stat') ||
                        key.toLowerCase().includes('projection') ||
                        key.toLowerCase().includes('fantasy') ||
                        key.toLowerCase().includes('receiving') ||
                        key.toLowerCase().includes('rushing') ||
                        key.toLowerCase().includes('passing') ||
                        key.toLowerCase().includes('yards') ||
                        key.toLowerCase().includes('touchdown') ||
                        key.toLowerCase().includes('target') ||
                        key.toLowerCase().includes('reception')
                    );

                    if (relevantKeys.length > 0) {
                        console.log(`🎯 Relevant fantasy keys found: ${relevantKeys.join(', ')}`);

                        // Examine the relevant data
                        relevantKeys.forEach(key => {
                            const value = data[key];
                            console.log(`  📈 ${key}:`, typeof value, Array.isArray(value) ? `(array of ${value.length})` : '');
                        });
                    }

                    // Look for items array (common in ESPN APIs)
                    if (data.items && Array.isArray(data.items)) {
                        console.log(`📊 Found ${data.items.length} items`);
                        if (data.items.length > 0) {
                            const firstItem = data.items[0];
                            console.log(`  First item keys: ${Object.keys(firstItem).join(', ')}`);
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

    console.log('🎉 ESPN player stats testing complete!');
}

// Run the tester
testEspnPlayerStats().catch(console.error);