import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Test ESPN athlete endpoints for projection data
async function testEspnAthletes() {
    console.log('🔍 Testing ESPN Athlete Endpoints for Projection Data\n');

    const athleteEndpoints = [
        {
            name: 'espn-2025-athletes',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes',
            description: '2025 Season Athletes'
        },
        {
            name: 'espn-all-athletes',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes',
            description: 'All NFL Athletes'
        }
    ];

    for (const endpoint of athleteEndpoints) {
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

                // Save full response
                const fullPath = `${endpoint.name}-full.json`;
                fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
                console.log(`✅ Saved: ${fullPath} (${JSON.stringify(data).length} chars)`);

                // Analyze structure
                console.log(`📊 Data type: ${typeof data}`);
                if (typeof data === 'object') {
                    console.log(`📊 Top-level keys: ${Object.keys(data).join(', ')}`);

                    // Look for items/athletes array
                    if (data.items && Array.isArray(data.items)) {
                        console.log(`👥 Found ${data.items.length} athletes`);

                        // Examine first few athletes
                        const sampleAthletes = data.items.slice(0, 3);
                        for (let i = 0; i < sampleAthletes.length; i++) {
                            const athlete = sampleAthletes[i];
                            console.log(`\n  🏈 Athlete ${i + 1}:`);
                            console.log(`    ID: ${athlete.id || 'N/A'}`);
                            console.log(`    Name: ${athlete.displayName || athlete.name || 'N/A'}`);
                            console.log(`    Keys: ${Object.keys(athlete).join(', ')}`);

                            // Look for stats/projections
                            if (athlete.statistics || athlete.stats || athlete.projections) {
                                console.log(`    🎯 Has statistics/projections!`);
                            }

                            // Check if there's a detailed reference
                            if (athlete.$ref) {
                                console.log(`    🔗 Detailed ref: ${athlete.$ref}`);
                            }
                        }

                        // Save sample athletes
                        const samplePath = `${endpoint.name}-samples.json`;
                        fs.writeFileSync(samplePath, JSON.stringify(sampleAthletes, null, 2));
                        console.log(`\n💾 Saved athlete samples: ${samplePath}`);
                    }
                }
            }

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('\n' + '='.repeat(60) + '\n');
    }

    console.log('🎉 ESPN athlete endpoint testing complete!');
}

// Run the tester
testEspnAthletes().catch(console.error);