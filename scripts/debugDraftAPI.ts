// Debug version to see what players are actually available
async function debugAvailablePlayers() {
    console.log('🔍 Debugging Available Players...\n');

    const testRequest = {
        league: { teams: 12, format: "PPR" as const, roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 } },
        draft: {
            round: 1, pickOverall: 5, pickInRound: 5, snake: true, myTeamIndex: 4, picksUntilMe: 14,
            board: ["Ja'Marr Chase", "Saquon Barkley", "Bijan Robinson", "Justin Jefferson"]
        },
        myTeam: { players: [], needs: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 } }
    };

    try {
        // First, let's see what our data loading returns
        const { DraftDataService } = await import('../lib/draftData.js');

        console.log('📊 Loading PPR players...');
        const allPlayers = await DraftDataService.getAllPlayersForFormat('PPR');

        // Show top 10 players by ADP
        const topPlayers = allPlayers
            .filter(p => p.adp.PPR < 50) // Only players with reasonable ADP
            .sort((a, b) => a.adp.PPR - b.adp.PPR)
            .slice(0, 15);

        console.log('\n🏆 Top 15 players by PPR ADP:');
        topPlayers.forEach((player, i) => {
            console.log(`${i + 1}. ${player.name} (${player.position}, ${player.team}) - ADP: ${player.adp.PPR}`);
        });

        // Filter out drafted players
        const available = DraftDataService.getAvailablePlayers(allPlayers, testRequest.draft.board);
        const availableTop = available
            .filter(p => p.adp.PPR < 50)
            .sort((a, b) => a.adp.PPR - b.adp.PPR)
            .slice(0, 10);

        console.log('\n✅ Top 10 AVAILABLE after removing drafted:');
        availableTop.forEach((player, i) => {
            console.log(`${i + 1}. ${player.name} (${player.position}, ${player.team}) - ADP: ${player.adp.PPR}`);
        });

        // Check if drafted players are actually being filtered
        console.log('\n🚫 Checking if drafted players were removed:');
        testRequest.draft.board.forEach(draftedName => {
            const stillThere = available.find(p => p.name === draftedName);
            console.log(`${draftedName}: ${stillThere ? '❌ STILL AVAILABLE!' : '✅ Properly removed'}`);
        });

        // Look for the problematic players
        console.log('\n🔍 Checking problematic players:');
        const jordanMims = allPlayers.find(p => p.name.includes('Jordan Mims'));
        const mikeBoone = allPlayers.find(p => p.name.includes('Mike Boone'));

        if (jordanMims) {
            console.log(`Jordan Mims ADP: PPR=${jordanMims.adp.PPR}, Half=${jordanMims.adp.Half}`);
        }
        if (mikeBoone) {
            console.log(`Mike Boone ADP: PPR=${mikeBoone.adp.PPR}, Half=${mikeBoone.adp.Half}`);
        }

    } catch (error) {
        console.error('💥 Debug failed:', error);
    }
}

debugAvailablePlayers().catch(console.error);
