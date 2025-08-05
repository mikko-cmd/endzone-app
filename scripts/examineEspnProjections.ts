import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Examine ESPN Fantasy API projection endpoints in detail
async function examineEspnProjections() {
    console.log('🔍 Examining ESPN Fantasy API Projection Endpoints...\n');

    const endpoints = [
        {
            name: 'ESPN Fantasy API v3',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl'
        },
        {
            name: 'ESPN Fantasy Players',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/players'
        },
        {
            name: 'ESPN Fantasy Players with Params',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/players?view=kona_player_info'
        },
        {
            name: 'ESPN Fantasy Players 2025',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players'
        },
        {
            name: 'ESPN Fantasy Players 2025 with View',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players?view=players_wl'
        }
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n📡 Testing: ${endpoint.name}`);
            console.log(`🔗 URL: ${endpoint.url}`);

            const response = await axios.get(endpoint.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            console.log(`✅ Status: ${response.status}`);

            // Analyze the response structure
            const data = response.data;

            if (Array.isArray(data)) {
                console.log(`📊 Response: Array with ${data.length} items`);

                if (data.length > 0) {
                    const firstItem = data[0];
                    console.log(`🔍 First item keys: [${Object.keys(firstItem).slice(0, 10).join(', ')}...]`);

                    // Look for projection-related fields
                    const jsonStr = JSON.stringify(firstItem);
                    const projectionKeywords = ['projection', 'forecast', 'predicted', 'expected', 'outlooks'];
                    const foundKeywords = projectionKeywords.filter(keyword =>
                        jsonStr.toLowerCase().includes(keyword)
                    );

                    if (foundKeywords.length > 0) {
                        console.log(`🎯 Found projection keywords: [${foundKeywords.join(', ')}]`);
                    }

                    // Save a sample for manual inspection
                    const sampleFileName = `espn-sample-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}.json`;
                    fs.writeFileSync(sampleFileName, JSON.stringify(firstItem, null, 2));
                    console.log(`💾 Sample saved to: ${sampleFileName}`);
                }
            } else if (typeof data === 'object') {
                console.log(`📊 Response: Object with keys [${Object.keys(data).slice(0, 10).join(', ')}...]`);

                // Look for projection-related fields
                const jsonStr = JSON.stringify(data);
                const projectionKeywords = ['projection', 'forecast', 'predicted', 'expected', 'outlooks'];
                const foundKeywords = projectionKeywords.filter(keyword =>
                    jsonStr.toLowerCase().includes(keyword)
                );

                if (foundKeywords.length > 0) {
                    console.log(`🎯 Found projection keywords: [${foundKeywords.join(', ')}]`);
                }

                // Save a sample for manual inspection
                const sampleFileName = `espn-sample-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}.json`;
                fs.writeFileSync(sampleFileName, JSON.stringify(data, null, 2));
                console.log(`💾 Sample saved to: ${sampleFileName}`);
            }

        } catch (error: any) {
            console.log(`❌ Error (${error.response?.status || 'Unknown'}): ${error.message}`);
        }

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎯 MANUAL INSPECTION NEEDED:');
    console.log('Check the generated JSON files to see if they contain:');
    console.log('- Player projections for 2025 season');
    console.log('- Weekly projections');
    console.log('- Fantasy point projections');
    console.log('- Statistical projections (passing yards, TDs, etc.)');
}

examineEspnProjections().catch(console.error);