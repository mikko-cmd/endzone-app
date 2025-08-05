import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Test individual ESPN athlete endpoints for detailed projection data
async function testIndividualEspnAthlete() {
    console.log('🔍 Testing Individual ESPN Athlete Endpoints\n');

    // Test a few individual athlete URLs from the previous results
    const athleteUrls = [
        'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/4246273?lang=en&region=us',
        'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/4246281?lang=en&region=us',
        'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/4246273?lang=en&region=us'
    ];

    for (let i = 0; i < athleteUrls.length; i++) {
        const url = athleteUrls[i];
        console.log(`📡 Testing Athlete ${i + 1}`);
        console.log(`🔗 URL: ${url}`);

        try {
            const response = await axios.get(url, {
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
                const filename = `espn-athlete-${i + 1}-detailed.json`;
                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                console.log(`✅ Saved: ${filename} (${JSON.stringify(data).length} chars)`);

                // Analyze athlete data
                console.log(`📊 Top-level keys: ${Object.keys(data).join(', ')}`);

                if (data.displayName || data.name) {
                    console.log(`🏈 Athlete: ${data.displayName || data.name}`);
                }

                if (data.position) {
                    console.log(`📍 Position: ${data.position.displayName || data.position.name || data.position}`);
                }

                // Look for statistics, projections, or stats
                const statKeys = Object.keys(data).filter(key =>
                    key.toLowerCase().includes('stat') ||
                    key.toLowerCase().includes('projection') ||
                    key.toLowerCase().includes('forecast') ||
                    key.toLowerCase().includes('performance')
                );

                if (statKeys.length > 0) {
                    console.log(`🎯 Found stat-related keys: ${statKeys.join(', ')}`);

                    // Examine the stats data
                    for (const key of statKeys) {
                        const statData = data[key];
                        console.log(`  📈 ${key}:`, typeof statData, statData?.$ref ? `(ref: ${statData.$ref})` : '');
                    }
                }

                // Look for any reference URLs that might contain projections
                const refs = Object.keys(data).filter(key => data[key]?.$ref);
                if (refs.length > 0) {
                    console.log(`🔗 Reference URLs found:`);
                    refs.forEach(key => {
                        const ref = data[key].$ref;
                        if (ref.includes('stat') || ref.includes('projection') || ref.includes('season')) {
                            console.log(`  🎯 ${key}: ${ref}`);
                        }
                    });
                }
            }

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('🎉 Individual ESPN athlete testing complete!');
}

// Run the tester
testIndividualEspnAthlete().catch(console.error);