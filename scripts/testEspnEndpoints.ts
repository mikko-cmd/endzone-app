import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Simple ESPN API endpoint tester
async function testEspnEndpoints() {
    console.log('🔍 Testing ESPN API Endpoints for Projections...\n');

    const endpoints = [
        // Core working endpoints
        {
            name: 'NFL Teams',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
        },
        {
            name: 'NFL Scoreboard',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
        },

        // Alternative API versions
        {
            name: 'ESPN Core API v2',
            url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
        },
        {
            name: 'ESPN Core API Athletes',
            url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes'
        },

        // Fantasy-specific attempts
        {
            name: 'ESPN Fantasy API v3',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl'
        },
        {
            name: 'ESPN Fantasy Players',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/players'
        },

        // Player-specific with known ESPN ID (Josh Allen - 3917315)
        {
            name: 'Josh Allen Stats',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/3917315'
        },
        {
            name: 'Josh Allen Game Log',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/3917315/gamelog'
        }
    ];

    const results: any[] = [];

    for (const endpoint of endpoints) {
        try {
            console.log(`📡 Testing: ${endpoint.name}`);

            const response = await axios.get(endpoint.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const dataKeys = response.data ? Object.keys(response.data) : [];
            const dataStr = JSON.stringify(response.data);

            // Look for projection-related keywords
            const hasProjections = dataStr.toLowerCase().includes('projection') ||
                dataStr.toLowerCase().includes('forecast') ||
                dataStr.toLowerCase().includes('predicted') ||
                dataStr.toLowerCase().includes('expected');

            results.push({
                name: endpoint.name,
                url: endpoint.url,
                status: 'success',
                statusCode: response.status,
                dataKeys,
                hasProjections,
                sampleData: dataKeys.length > 0 ? response.data[dataKeys[0]] : null
            });

            console.log(`   ✅ Success (${response.status}) - Keys: [${dataKeys.slice(0, 5).join(', ')}${dataKeys.length > 5 ? '...' : ''}]`);

            if (hasProjections) {
                console.log(`   🎯 CONTAINS PROJECTION-RELATED DATA!`);
            }

        } catch (error: any) {
            results.push({
                name: endpoint.name,
                url: endpoint.url,
                status: 'error',
                statusCode: error.response?.status,
                error: error.message
            });

            console.log(`   ❌ Error (${error.response?.status || 'Unknown'}): ${error.message}`);
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Save results to file
    fs.writeFileSync('espn-api-results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 Results saved to espn-api-results.json');

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.status === 'success');
    const withProjections = successful.filter(r => r.hasProjections);

    console.log(`✅ Working endpoints: ${successful.length}/${results.length}`);
    console.log(`🎯 With projection data: ${withProjections.length}`);

    if (withProjections.length > 0) {
        console.log('\n🎯 ENDPOINTS WITH PROJECTION DATA:');
        withProjections.forEach(result => {
            console.log(`   • ${result.name}: ${result.url}`);
        });
    }

    if (successful.length > 0) {
        console.log('\n✅ ALL WORKING ENDPOINTS:');
        successful.forEach(result => {
            console.log(`   • ${result.name}: ${result.url}`);
        });
    }
}

testEspnEndpoints().catch(console.error);