// Test the complete draft assistant API with CORRECT 2025 data
async function testDraftAPI() {
    console.log('🎯 Testing Draft Assistant API with 2025 data...\n');

    // CORRECT Test scenario: 12-team PPR, Round 1 Pick 5
    const testRequest = {
        league: {
            teams: 12,
            format: "PPR" as const,
            roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 }
        },
        draft: {
            round: 1,
            pickOverall: 5,
            pickInRound: 5,
            snake: true,
            myTeamIndex: 4,
            picksUntilMe: 14,
            board: [
                "Ja'Marr Chase",     // Pick 1 - WR1 (1.02 ADP)
                "Saquon Barkley",    // Pick 2 - RB1 (1.02 ADP)
                "Bijan Robinson",    // Pick 3 - RB2 (1.04 ADP)
                "Justin Jefferson"   // Pick 4 - WR2 (1.04 ADP)
            ]
            // Available at pick 5 should be: Jahmyr Gibbs, CeeDee Lamb, Puka Nacua, etc.
        },
        myTeam: {
            players: [], // First pick
            needs: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 }
        },
        constraints: {
            maxReach: 12,
            preferStacks: true,
            avoidQBTEBackToBack: true
        }
    };

    try {
        console.log('📤 Sending CORRECTED request to /api/draft/assist...');
        console.log('Expected available: Jahmyr Gibbs (RB), CeeDee Lamb (WR), Puka Nacua (WR)');
        console.log('Drafted (correct 2025):', testRequest.draft.board);

        const response = await fetch('http://localhost:3000/api/draft/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testRequest)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ API Error:', errorData);
            return;
        }

        const recommendation = await response.json();

        console.log('\n🎉 SUCCESS! Draft recommendation:');
        console.log('='.repeat(60));
        console.log(`🎯 RECOMMENDED: ${recommendation.primary?.playerId || 'None'}`);
        console.log(`📊 CONFIDENCE: ${recommendation.confidence}%`);

        // Validate the recommendation makes sense
        const expectedPlayers = ['Jahmyr Gibbs', 'CeeDee Lamb', 'Puka Nacua', 'Amon-Ra St. Brown'];
        const isReasonable = expectedPlayers.some(name =>
            recommendation.primary?.playerId?.includes(name) ||
            name.includes(recommendation.primary?.playerId || '')
        );

        if (isReasonable) {
            console.log('✅ RECOMMENDATION LOOKS GOOD - Expected top player selected');
        } else {
            console.log('⚠️  UNEXPECTED RECOMMENDATION - May indicate data issue');
            console.log(`Expected one of: ${expectedPlayers.join(', ')}`);
            console.log(`Got: ${recommendation.primary?.playerId}`);
        }

        console.log(`💭 Reasoning: ${recommendation.primary?.reason}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

testDraftAPI().catch(console.error);
