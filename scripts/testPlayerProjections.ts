// scripts/testPlayerProjections.ts
import 'dotenv/config';
import axios from 'axios';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

async function getPlayerProjections() {
    console.log('🎯 Extracting Player Projection Data...\n');

    try {
        // Get 2025 season projections
        const response = await axios.get(`https://${RAPIDAPI_HOST}/getNFLProjections`, {
            params: {
                archiveSeason: '2025',
                pointsPerReception: 1,
                rushTD: 6,
                receivingTD: 6,
                passTD: 4
            },
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY
            },
            timeout: 15000
        });

        const playerProjections = response.data.body.playerProjections;
        console.log(`📊 Found projections for ${Object.keys(playerProjections).length} players\n`);

        // Get Bucky Irving's player ID from our earlier test
        const buckyIrvingId = '4596448';

        if (playerProjections[buckyIrvingId]) {
            console.log('🏈 Bucky Irving (RB9) Projections:');
            console.log(JSON.stringify(playerProjections[buckyIrvingId], null, 2));
        }

        // Get a few more player examples
        const samplePlayerIds = Object.keys(playerProjections).slice(0, 5);
        console.log('\n📋 Sample Player Projections:');

        for (const playerId of samplePlayerIds) {
            const projection = playerProjections[playerId];
            console.log(`\nPlayer ID ${playerId}:`);
            console.log(`  Fantasy Points: ${projection.fantasyPointsDefault || projection.fantasyPoints || 'N/A'}`);
            console.log(`  Rush Yards: ${projection.rushYards || 'N/A'}`);
            console.log(`  Rush TDs: ${projection.rushTD || 'N/A'}`);
            console.log(`  Rec Yards: ${projection.recYards || 'N/A'}`);
            console.log(`  Rec TDs: ${projection.recTD || 'N/A'}`);
            console.log(`  Receptions: ${projection.rec || 'N/A'}`);
            console.log(`  All fields: [${Object.keys(projection).join(', ')}]`);
        }

        // Now test getting player info to match names with IDs
        console.log('\n🔍 Testing Player Name to ID Matching...');

        const testPlayers = ['Bucky Irving', 'Aaron Jones', 'Saquon Barkley'];
        for (const playerName of testPlayers) {
            try {
                const playerInfoResponse = await axios.get(`https://${RAPIDAPI_HOST}/getNFLPlayerInfo`, {
                    params: { playerName },
                    headers: {
                        'x-rapidapi-host': RAPIDAPI_HOST,
                        'x-rapidapi-key': RAPIDAPI_KEY
                    },
                    timeout: 10000
                });

                if (playerInfoResponse.data.body?.[0]) {
                    const player = playerInfoResponse.data.body[0];
                    const playerId = player.playerID;
                    const projection = playerProjections[playerId];

                    console.log(`\n✅ ${playerName}:`);
                    console.log(`  Player ID: ${playerId}`);
                    console.log(`  Team: ${player.team}`);
                    console.log(`  Position: ${player.pos}`);

                    if (projection) {
                        console.log(`  🎯 2025 Projections:`);
                        console.log(`    Fantasy Points: ${projection.fantasyPointsDefault || 'N/A'}`);
                        console.log(`    Rush Yards: ${projection.rushYards || 'N/A'}`);
                        console.log(`    Rush TDs: ${projection.rushTD || 'N/A'}`);
                        console.log(`    Receptions: ${projection.rec || 'N/A'}`);
                        console.log(`    Rec Yards: ${projection.recYards || 'N/A'}`);
                        console.log(`    Rec TDs: ${projection.recTD || 'N/A'}`);
                    } else {
                        console.log(`  ❌ No projection data found for ID ${playerId}`);
                    }
                }
            } catch (error) {
                console.log(`❌ Failed to get ${playerName}:`, error.response?.status || error.message);
            }
        }

    } catch (error) {
        console.error('❌ Failed to get projections:', error.response?.status || error.message);
    }
}

getPlayerProjections().catch(console.error);
