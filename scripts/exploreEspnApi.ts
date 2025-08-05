import 'dotenv/config';
import axios from 'axios';

// Comprehensive ESPN API Explorer
async function exploreEspnApi() {
    console.log('🔍 ESPN API Explorer - Testing Multiple Endpoints\n');

    const endpoints = [
        // Basic NFL endpoints
        {
            name: 'NFL Teams',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
        },
        {
            name: 'NFL Scoreboard (Current Week)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
        },
        {
            name: 'NFL News',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news'
        },

        // Player-related endpoints
        {
            name: 'NFL Athletes/Players',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes'
        },
        {
            name: 'NFL Athletes (with limit)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes?limit=50'
        },

        // Stats and standings
        {
            name: 'NFL Standings',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings'
        },
        {
            name: 'NFL Statistics',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics'
        },

        // Season-specific endpoints
        {
            name: 'NFL 2024 Season',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/seasons/2024'
        },
        {
            name: 'NFL 2025 Season',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/seasons/2025'
        },

        // Potential projection endpoints
        {
            name: 'NFL Projections (Direct)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/projections'
        },
        {
            name: 'NFL Fantasy Projections',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/fantasy/projections'
        },
        {
            name: 'NFL Draft Projections',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/draft/projections'
        },

        // Fantasy-specific endpoints
        {
            name: 'NFL Fantasy',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/fantasy'
        },
        {
            name: 'NFL Fantasy Players',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/fantasy/players'
        },
        {
            name: 'NFL Fantasy Rankings',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/fantasy/rankings'
        },

        // Alternative API formats
        {
            name: 'ESPN API v3 (alternative)',
            url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
        },
        {
            name: 'ESPN Fantasy API v3',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl'
        },

        // Specific player test (Jayden Daniels example)
        {
            name: 'Specific Player Game Log (Test ID)',
            url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/4432577/gamelog'
        }
    ];

    const results: Array<{
        name: string;
        url: string;
        status: 'success' | 'error';
        statusCode?: number;
        dataKeys?: string[];
        sampleData?: any;
        error?: string;
    }> = [];

    for (const endpoint of endpoints) {
        try {
            console.log(`📡 Testing: ${endpoint.name}`);

            const response = await axios.get(endpoint.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const dataKeys = response.data ? Object.keys(response.data) : [];

            results.push({
                name: endpoint.name,
                url: endpoint.url,
                status: 'success',
                statusCode: response.status,
                dataKeys,
                sampleData: dataKeys.length > 0 ? {
                    [dataKeys[0]]: typeof response.data[dataKeys[0]]
                } : null
            });

            console.log(`   ✅ Success (${response.status}) - Keys: [${dataKeys.join(', ')}]`);

            // Look for projection-related data
            if (JSON.stringify(response.data).toLowerCase().includes('projection')) {
                console.log(`   🎯 CONTAINS PROJECTION DATA!`);
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

        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');

    console.log(`✅ Successful endpoints: ${successful.length}`);
    console.log(`❌ Failed endpoints: ${failed.length}`);

    if (successful.length > 0) {
        console.log('\n🎯 WORKING ENDPOINTS:');
        successful.forEach(result => {
            console.log(`   • ${result.name}`);
            console.log(`     ${result.url}`);
            console.log(`     Keys: [${result.dataKeys?.join(', ') || 'none'}]\n`);
        });
    }

    if (failed.length > 0) {
        console.log('\n💥 FAILED ENDPOINTS:');
        failed.forEach(result => {
            console.log(`   • ${result.name} (${result.statusCode || 'Unknown'})`);
        });
    }

    console.log('\n🔍 Next Steps:');
    console.log('1. Check successful endpoints for projection data');
    console.log('2. Explore nested endpoints from working base URLs');
    console.log('3. Try different player IDs or team IDs');
    console.log('4. Check response data for hidden projection fields');
}

exploreEspnApi().catch(console.error);