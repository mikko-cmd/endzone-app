import 'dotenv/config';
import axios from 'axios';

// Inspect ESPN Fantasy API data in detail
async function inspectEspnData() {
    console.log('🔍 Detailed Inspection of ESPN Fantasy API Data...\n');

    const url = 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players?view=players_wl';

    try {
        console.log(`📡 Fetching: ${url}`);

        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log(`✅ Status: ${response.status}`);

        const data = response.data;

        if (Array.isArray(data) && data.length > 0) {
            console.log(`📊 Found ${data.length} items`);

            // Look at first few items
            for (let i = 0; i < Math.min(3, data.length); i++) {
                const item = data[i];
                console.log(`\n--- ITEM ${i + 1} ---`);
                console.log(`Keys: [${Object.keys(item).join(', ')}]`);

                // Look for player info
                if (item.player) {
                    console.log(`Player: ${item.player.fullName || 'Unknown'}`);
                    console.log(`Position: ${item.player.defaultPositionId || 'Unknown'}`);

                    // Look for projections or stats
                    if (item.player.stats) {
                        console.log(`Stats keys: [${Object.keys(item.player.stats).join(', ')}]`);
                    }
                    if (item.player.projections) {
                        console.log(`🎯 PROJECTIONS FOUND!`);
                        console.log(`Projection keys: [${Object.keys(item.player.projections).join(', ')}]`);
                    }
                    if (item.player.outlooks) {
                        console.log(`🎯 OUTLOOKS FOUND!`);
                        console.log(`Outlook keys: [${Object.keys(item.player.outlooks).join(', ')}]`);
                    }
                }

                // Check all top-level keys for projection-related data
                Object.keys(item).forEach(key => {
                    if (key.toLowerCase().includes('projection') ||
                        key.toLowerCase().includes('outlook') ||
                        key.toLowerCase().includes('forecast')) {
                        console.log(`🎯 Found projection-related key: ${key}`);
                    }
                });
            }

            // Search entire response for projection keywords
            const jsonStr = JSON.stringify(data);
            const keywords = ['projection', 'projections', 'outlook', 'outlooks', 'forecast', 'expected'];

            console.log(`\n🔍 SEARCHING FOR PROJECTION KEYWORDS:`);
            keywords.forEach(keyword => {
                const regex = new RegExp(keyword, 'gi');
                const matches = jsonStr.match(regex);
                if (matches) {
                    console.log(`   "${keyword}": ${matches.length} occurrences`);
                }
            });

        } else {
            console.log(`📊 Response type: ${typeof data}`);
            console.log(`Keys: [${Object.keys(data).join(', ')}]`);
        }

    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
        }
    }
}

inspectEspnData().catch(console.error);