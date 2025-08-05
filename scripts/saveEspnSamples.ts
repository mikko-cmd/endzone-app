import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Save working ESPN API data samples
async function saveEspnSamples() {
    console.log('🔍 Saving ESPN Core API Data Samples\n');

    const workingEndpoints = [
        {
            name: 'espn-core-api-root',
            url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl',
            description: 'ESPN Core API Root - NFL League Data'
        },
        {
            name: 'espn-core-api-2025-season',
            url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025',
            description: 'ESPN Core API 2025 Season Data'
        },
        {
            name: 'espn-site-api-teams',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
            description: 'ESPN Site API NFL Teams'
        }
    ];

    for (const endpoint of workingEndpoints) {
        console.log(`📡 Fetching: ${endpoint.description}`);
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

                // Save full response
                const fullPath = `${endpoint.name}-full.json`;
                fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
                console.log(`✅ Saved full data: ${fullPath} (${JSON.stringify(data).length} chars)`);

                // Analyze structure
                console.log(`📊 Data type: ${typeof data}`);
                if (typeof data === 'object') {
                    console.log(`📊 Top-level keys: ${Object.keys(data).join(', ')}`);

                    // Look for player-related data
                    const playerKeys = Object.keys(data).filter(key =>
                        key.toLowerCase().includes('player') ||
                        key.toLowerCase().includes('athlete') ||
                        key.toLowerCase().includes('roster')
                    );

                    if (playerKeys.length > 0) {
                        console.log(`🎯 Player-related keys found: ${playerKeys.join(', ')}`);
                    }

                    // Look for projection-related data
                    const projectionKeys = Object.keys(data).filter(key =>
                        key.toLowerCase().includes('projection') ||
                        key.toLowerCase().includes('forecast') ||
                        key.toLowerCase().includes('stats')
                    );

                    if (projectionKeys.length > 0) {
                        console.log(`📈 Projection-related keys found: ${projectionKeys.join(', ')}`);
                    }
                }
            }

        } catch (error: any) {
            console.log(`❌ Error fetching ${endpoint.name}: ${error.message}`);
        }

        console.log(''); // Empty line for readability
    }

    console.log('🎉 ESPN API sample collection complete!');
}

// Run the saver
saveEspnSamples().catch(console.error);