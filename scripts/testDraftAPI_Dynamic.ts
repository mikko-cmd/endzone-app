// Test with dynamic port detection
async function findWorkingPort() {
    const possiblePorts = [3000, 3001, 3002, 3003];

    for (const port of possiblePorts) {
        try {
            console.log(`🔍 Trying port ${port}...`);
            const response = await fetch(`http://localhost:${port}/api/draft/assist`);
            if (response.ok) {
                console.log(`✅ Found working server on port ${port}`);
                return port;
            }
        } catch (error) {
            console.log(`❌ Port ${port} not responding`);
        }
    }

    throw new Error('No working server found on common ports');
}

async function testWithDynamicPort() {
    try {
        const port = await findWorkingPort();

        // Now run the test with the correct port
        const testRequest = {
            league: {
                teams: 12,
                format: "PPR" as const,
                roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 }
            },
            draft: {
                round: 1, pickOverall: 5, pickInRound: 5, snake: true, myTeamIndex: 4, picksUntilMe: 14,
                board: ["Ja'Marr Chase", "Saquon Barkley", "Bijan Robinson", "Justin Jefferson"]
            },
            myTeam: { players: [], needs: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 } }
        };

        const response = await fetch(`http://localhost:${port}/api/draft/assist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testRequest)
        });

        if (response.ok) {
            const recommendation = await response.json();
            console.log(`\n🎉 SUCCESS! Recommended: ${recommendation.primary?.playerId}`);
            console.log(`📊 ADP: ${recommendation.primary?.value?.adp}, Confidence: ${recommendation.confidence}%`);

            // Check if it's a reasonable pick
            const reasonablePicks = ['Jahmyr Gibbs', 'CeeDee Lamb', 'Amon-Ra St. Brown', 'Puka Nacua'];
            const isGood = reasonablePicks.some(name => recommendation.primary?.playerId?.includes(name));
            console.log(isGood ? '✅ Reasonable pick!' : '⚠️  Unexpected recommendation');
        } else {
            console.log(`❌ API error: ${response.status}`);
        }

    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

testWithDynamicPort().catch(console.error);
