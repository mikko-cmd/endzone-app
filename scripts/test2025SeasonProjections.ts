// scripts/test2025SeasonProjections.ts
import 'dotenv/config';
import axios from 'axios';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

interface PlayerProjection {
    longName: string;
    pos: string;
    team: string;
    fantasyPointsDefault: {
        standard: string;
        PPR: string;
        halfPPR: string;
    };
}

async function test2025SeasonProjections() {
    console.log('🎯 Testing 2025 Season-Long Projections for Endzone Value System...\n');

    try {
        console.log('📡 Fetching 2025 season projections from RapidAPI Tank01...');

        const response = await axios.get(`https://${RAPIDAPI_HOST}/getNFLProjections`, {
            params: {
                archiveSeason: '2025',
                pointsPerReception: 1, // PPR scoring
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

        console.log('📊 API Response Status:', response.data?.statusCode);

        if (response.data?.statusCode !== 200) {
            throw new Error(`API returned status: ${response.data?.statusCode}`);
        }

        const playerProjections = response.data.body.playerProjections;
        console.log(`✅ Found projections for ${Object.keys(playerProjections).length} players\n`);

        // Extract and sort all players by projected PPR points
        const playersWithProjections: { id: string, name: string, position: string, points: number }[] = [];

        Object.keys(playerProjections).forEach(playerId => {
            const player: PlayerProjection = playerProjections[playerId];
            const pprPoints = parseFloat(player.fantasyPointsDefault?.PPR || '0');

            if (pprPoints > 0) {
                playersWithProjections.push({
                    id: playerId,
                    name: player.longName || 'Unknown',
                    position: player.pos || 'FLEX',
                    points: pprPoints
                });
            }
        });

        // Sort by projected points (highest to lowest)
        playersWithProjections.sort((a, b) => b.points - a.points);

        console.log('🏆 TOP 10 PROJECTED PLAYERS FOR 2025:');
        console.log('Rank | Player Name           | Pos | Projected PPR Points | Endzone Value');
        console.log('-----|----------------------|-----|---------------------|---------------');

        playersWithProjections.slice(0, 10).forEach((player, index) => {
            const rank = index + 1;
            const endzoneValue = Math.round((playersWithProjections.length - rank + 1) / playersWithProjections.length * 1000);
            console.log(`${rank.toString().padStart(4)} | ${player.name.padEnd(20)} | ${player.position.padEnd(3)} | ${player.points.toString().padStart(19)} | ${endzoneValue.toString().padStart(13)}`);
        });

        console.log('\n📊 SUMMARY STATISTICS:');
        console.log(`Total players with projections: ${playersWithProjections.length}`);
        console.log(`Highest projection: ${playersWithProjections[0]?.points} PPR points (${playersWithProjections[0]?.name})`);
        console.log(`Lowest projection: ${playersWithProjections[playersWithProjections.length - 1]?.points} PPR points`);

        if (playersWithProjections.length > 0) {
            const average = playersWithProjections.reduce((sum, p) => sum + p.points, 0) / playersWithProjections.length;
            console.log(`Average projection: ${average.toFixed(1)} PPR points`);
        }

        console.log('\n🎯 ENDZONE VALUE SYSTEM PREVIEW:');
        console.log('• #1 projected player gets 1000 Endzone Value');
        console.log('• Rankings are based on 2025 season-long PPR projections');
        console.log('• Players with 0 projections get 0 Endzone Value');
        console.log('• Perfect for trade value calculations!');

        return {
            success: true,
            totalPlayers: playersWithProjections.length,
            topPlayer: playersWithProjections[0],
            projections: playersWithProjections
        };

    } catch (error: any) {
        console.error('❌ Error testing 2025 projections:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
test2025SeasonProjections()
    .then(result => {
        if (result.success) {
            console.log('\n✅ 2025 season projection test completed successfully!');
        } else {
            console.log('\n❌ Test failed:', result.error);
        }
        process.exit(0);
    })
    .catch(console.error);
