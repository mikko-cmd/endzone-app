import { DraftDataService } from '../lib/draftData';

async function testDataLoading() {
    console.log('🧪 Testing draft data loading...\n');

    try {
        // Test PPR format
        console.log('📊 Loading PPR players...');
        const pprPlayers = await DraftDataService.getAllPlayersForFormat('PPR');
        console.log(`✅ Loaded ${pprPlayers.length} PPR players`);

        if (pprPlayers.length > 0) {
            console.log('Sample PPR player:', {
                name: pprPlayers[0].name,
                team: pprPlayers[0].team,
                position: pprPlayers[0].position,
                byeWeek: pprPlayers[0].byeWeek,
                adp: pprPlayers[0].adp,
                marketShare: pprPlayers[0].marketShare ? 'Found' : 'Not found',
                redZone: pprPlayers[0].redZone ? 'Found' : 'Not found'
            });
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test Dynasty format
        console.log('🏆 Loading Dynasty players...');
        const dynastyPlayers = await DraftDataService.getAllPlayersForFormat('Dynasty');
        console.log(`✅ Loaded ${dynastyPlayers.length} Dynasty players`);

        if (dynastyPlayers.length > 0) {
            console.log('Sample Dynasty player:', {
                name: dynastyPlayers[0].name,
                team: dynastyPlayers[0].team,
                position: dynastyPlayers[0].position,
                age: dynastyPlayers[0].age,
                adp: dynastyPlayers[0].adp,
                marketShare: dynastyPlayers[0].marketShare ? 'Found' : 'Not found',
                redZone: dynastyPlayers[0].redZone ? 'Found' : 'Not found'
            });
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test data consistency
        console.log('🔍 Testing data consistency...');

        // Check if we have the expected top players
        const topPPRPlayers = pprPlayers
            .filter(p => p.adp.PPR < 25)
            .sort((a, b) => a.adp.PPR - b.adp.PPR)
            .slice(0, 10);

        console.log('Top 10 PPR players by ADP:');
        topPPRPlayers.forEach((player, index) => {
            console.log(`${index + 1}. ${player.name} (${player.position}, ${player.team}) - ADP: ${player.adp.PPR}`);
        });

        // Test available players filter
        console.log('\n🚫 Testing drafted players filter...');
        const draftedPlayers = ['Ja\'Marr Chase', 'Saquon Barkley', 'Bijan Robinson'];
        const available = DraftDataService.getAvailablePlayers(pprPlayers, draftedPlayers);
        console.log(`Original: ${pprPlayers.length} players, After removing ${draftedPlayers.length} drafted: ${available.length} available`);

        // Verify the drafted players are actually removed
        const stillAvailable = available.filter(p => draftedPlayers.includes(p.name));
        if (stillAvailable.length === 0) {
            console.log('✅ Drafted players filter working correctly');
        } else {
            console.log('❌ ERROR: Some drafted players still in available list:', stillAvailable.map(p => p.name));
        }

        console.log('\n🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Error loading data:', error);

        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
        }
    }
}

// Also test cache functionality
async function testCaching() {
    console.log('\n⚡ Testing caching...');

    const start1 = Date.now();
    await DraftDataService.getAllPlayersForFormat('PPR');
    const time1 = Date.now() - start1;
    console.log(`First load: ${time1}ms`);

    const start2 = Date.now();
    await DraftDataService.getAllPlayersForFormat('PPR');
    const time2 = Date.now() - start2;
    console.log(`Second load (cached): ${time2}ms`);

    if (time2 < time1 / 2) {
        console.log('✅ Caching is working - second load much faster');
    } else {
        console.log('⚠️  Caching may not be working properly');
    }
}

// Run the tests
async function runAllTests() {
    await testDataLoading();
    await testCaching();
}

runAllTests().catch(console.error);
