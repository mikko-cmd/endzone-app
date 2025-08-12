// scripts/testRapidAPIProjections.ts
import 'dotenv/config';
import axios from 'axios';

// Environment validation
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
    console.error('❌ Missing RAPIDAPI_KEY in environment variables');
    process.exit(1);
}

interface ProjectionTest {
    name: string;
    url: string;
    params: Record<string, any>;
    description: string;
}

async function testRapidAPIProjections() {
    console.log('🧪 Testing RapidAPI NFL Projections...\n');
    console.log('='.repeat(80));

    // Test different projection endpoints
    const projectionTests: ProjectionTest[] = [
        {
            name: 'Season-Long Projections (2025)',
            url: 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections',
            params: {
                week: 'season', // Try season-long
                archiveSeason: '2025',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            description: 'Full season projections for 2025'
        },
        {
            name: 'Week 1 Projections',
            url: 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections',
            params: {
                week: 1,
                archiveSeason: '2025',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            description: 'Week 1 specific projections'
        },
        {
            name: '2024 Season Data (for comparison)',
            url: 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLProjections',
            params: {
                archiveSeason: '2024',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            description: '2024 season data to see format'
        }
    ];

    // Test each projection type
    for (const test of projectionTests) {
        console.log(`\n📊 ${test.name}`);
        console.log(`📝 ${test.description}`);
        console.log(`🔗 URL: ${test.url}`);
        console.log(`⚙️  Params:`, JSON.stringify(test.params, null, 2));

        try {
            const response = await axios.get(test.url, {
                params: test.params,
                headers: {
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY
                },
                timeout: 15000
            });

            console.log(`✅ Status: ${response.status}`);
            console.log(`📄 Response structure:`, Object.keys(response.data || {}));

            if (response.data && typeof response.data === 'object') {
                const data = response.data;

                // Log the actual response structure and first few items
                console.log(`🔍 Full response:`, JSON.stringify(data, null, 2).substring(0, 1000) + '...');

                // Handle different response formats
                let playerArray = [];
                if (Array.isArray(data)) {
                    playerArray = data;
                    console.log(`📦 Direct array with ${data.length} items`);
                } else if (data.body && Array.isArray(data.body)) {
                    playerArray = data.body;
                    console.log(`📦 Body array with ${data.body.length} items`);
                } else if (data.body) {
                    console.log(`📋 Body object keys:`, Object.keys(data.body));
                    // Try to find players in the body object
                    if (typeof data.body === 'object') {
                        Object.keys(data.body).forEach(key => {
                            const value = data.body[key];
                            if (Array.isArray(value)) {
                                console.log(`  - ${key}: Array with ${value.length} items`);
                                if (value.length > 0) {
                                    playerArray = value;
                                }
                            } else if (typeof value === 'object' && value !== null) {
                                console.log(`  - ${key}: Object with keys`, Object.keys(value));
                            } else {
                                console.log(`  - ${key}: ${typeof value} = ${value}`);
                            }
                        });
                    }
                }

                // Analyze first few players if we found any
                if (playerArray.length > 0) {
                    console.log(`\n👥 Found ${playerArray.length} players`);
                    console.log(`🔍 First player structure:`, Object.keys(playerArray[0]));

                    // Show first 3 players
                    console.log(`\n📋 Sample Players:`);
                    for (let i = 0; i < Math.min(3, playerArray.length); i++) {
                        analyzePlayerProjection(playerArray[i], test.name, i + 1);
                    }

                    // Look for our target RBs
                    findSamplePlayers(playerArray, ['Bucky Irving', 'Aaron Jones', 'Isiah Pacheco', 'Rhamondre Stevenson'], test.name);
                } else {
                    console.log(`❌ No player array found`);
                }
            }

        } catch (error) {
            console.log(`❌ Failed:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message,
                data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No data'
            });
        }

        console.log('-'.repeat(60));
    }

    // Test additional endpoints
    await testAdditionalEndpoints();
}

function analyzePlayerProjection(player: any, testName: string, index: number) {
    console.log(`\n  🏈 Player ${index}:`);

    // Try different name fields
    const name = player.longName || player.playerName || player.name || player.displayName || `Player_${index}`;
    const team = player.team || player.teamAbv || player.teamAbbr || 'Unknown';
    const position = player.pos || player.position || player.primaryPosition || 'Unknown';

    console.log(`    👤 Name: ${name}`);
    console.log(`    🏟️  Team: ${team}`);
    console.log(`    📍 Position: ${position}`);

    // Look for fantasy points
    const fantasyPoints = player.projectedPoints || player.fantasyPoints || player.proj_fp ||
        player.projectedFantasyPoints || player.totalFantasyPoints || 'N/A';
    console.log(`    ⭐ Fantasy Points: ${fantasyPoints}`);

    // Look for key stats
    const stats = {};
    const statMappings = {
        'Rushing Yards': ['rushingYards', 'rushYards', 'rushing_yards'],
        'Rushing TDs': ['rushingTDs', 'rushTDs', 'rushing_touchdowns', 'rushingTouchdowns'],
        'Receiving Yards': ['receivingYards', 'recYards', 'receiving_yards'],
        'Receiving TDs': ['receivingTDs', 'recTDs', 'receiving_touchdowns', 'receivingTouchdowns'],
        'Receptions': ['receptions', 'rec', 'catches'],
        'Passing Yards': ['passingYards', 'passYards', 'passing_yards'],
        'Passing TDs': ['passingTDs', 'passTDs', 'passing_touchdowns', 'passingTouchdowns'],
        'Targets': ['targets', 'tgt']
    };

    for (const [statName, possibleFields] of Object.entries(statMappings)) {
        for (const field of possibleFields) {
            if (player[field] !== undefined && player[field] !== null) {
                stats[statName] = player[field];
                break;
            }
        }
    }

    if (Object.keys(stats).length > 0) {
        console.log(`    📊 Stats:`, stats);
    }

    // Show all available fields for debugging
    console.log(`    🔧 Available fields: [${Object.keys(player).slice(0, 10).join(', ')}${Object.keys(player).length > 10 ? '...' : ''}]`);
}

function findSamplePlayers(playerArray: any[], playerNames: string[], testName: string) {
    console.log(`\n🔍 Looking for sample RBs in ${testName}:`);

    const foundPlayers = [];
    for (const targetName of playerNames) {
        const found = playerArray.find(p => {
            const name = p.longName || p.playerName || p.name || p.displayName || '';
            return name.toLowerCase().includes(targetName.toLowerCase()) ||
                targetName.toLowerCase().includes(name.toLowerCase());
        });

        if (found) {
            const fantasyPoints = found.projectedPoints || found.fantasyPoints || found.proj_fp || 'N/A';
            foundPlayers.push({
                target: targetName,
                found: found.longName || found.playerName || found.name || found.displayName,
                points: fantasyPoints,
                team: found.team || found.teamAbv || 'Unknown'
            });
        }
    }

    if (foundPlayers.length > 0) {
        console.log(`✅ Found ${foundPlayers.length}/${playerNames.length} target players:`);
        foundPlayers.forEach(p => {
            console.log(`  • ${p.found} (${p.team}) - ${p.points} pts`);
        });
    } else {
        console.log(`❌ No target players found in this dataset`);

        // Show a few player names for debugging
        console.log(`📝 Sample player names from dataset:`);
        for (let i = 0; i < Math.min(5, playerArray.length); i++) {
            const player = playerArray[i];
            const name = player.longName || player.playerName || player.name || player.displayName || `Player_${i}`;
            const pos = player.pos || player.position || 'Unknown';
            console.log(`  - ${name} (${pos})`);
        }
    }
}

async function testAdditionalEndpoints() {
    console.log(`\n🔄 Testing Additional NFL Data Endpoints...\n`);

    const additionalTests = [
        {
            name: 'Player Info - Bucky Irving',
            url: 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLPlayerInfo',
            params: { playerName: 'Bucky Irving' }
        },
        {
            name: 'Team Roster - Tampa Bay',
            url: 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLTeamRoster',
            params: { teamAbv: 'TB' }
        }
    ];

    for (const test of additionalTests) {
        console.log(`📡 Testing: ${test.name}`);
        try {
            const response = await axios.get(test.url, {
                params: test.params,
                headers: {
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY
                },
                timeout: 10000
            });

            console.log(`✅ ${test.name} - Status: ${response.status}`);
            if (response.data) {
                console.log(`📄 Structure:`, Object.keys(response.data));

                // Show actual data for player info
                if (test.name.includes('Player Info') && response.data.body) {
                    console.log(`🏈 Player Data:`, JSON.stringify(response.data.body, null, 2));
                }

                // Show roster preview
                if (test.name.includes('Team Roster') && response.data.body?.roster) {
                    console.log(`👥 Roster size: ${response.data.body.roster.length} players`);
                    if (response.data.body.roster.length > 0) {
                        console.log(`📝 First player:`, response.data.body.roster[0]);
                    }
                }
            }
        } catch (error) {
            console.log(`❌ ${test.name} failed:`, error.response?.status || error.message);
        }
    }
}

async function main() {
    console.log('🚀 RapidAPI NFL Projections Test Suite');
    console.log('🎯 Goal: Test season-long vs weekly projections for trade valuation');
    console.log(`🔑 Using API Key: ${RAPIDAPI_KEY ? 'Present' : 'Missing'}`);
    console.log(`🏢 Host: ${RAPIDAPI_HOST}\n`);

    await testRapidAPIProjections();

    console.log('\n🏁 Testing Complete!');
    console.log('\n💡 Next Steps for Trade Finder:');
    console.log('1. ✅ Use projection data for player valuation');
    console.log('2. ✅ Calculate positional scarcity (RB9 vs RB31)');
    console.log('3. ✅ Analyze team needs by position counts');
    console.log('4. ✅ Match surplus positions with needs');
    console.log('5. ✅ Build realistic trade fairness algorithm');
}

main().catch(console.error);
