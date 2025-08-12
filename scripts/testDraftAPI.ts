// Test the complete draft assistant API
async function testDraftAPI() {
    console.log('🎯 Testing Draft Assistant API...\n');

    // Fix the test scenario with REAL 2025 top picks
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
                "Ja'Marr Chase",     // Pick 1 (1.02 ADP)
                "Saquon Barkley",    // Pick 2 (1.02 ADP)  
                "Bijan Robinson",    // Pick 3 (1.04 ADP)
                "Justin Jefferson"   // Pick 4 (1.04 ADP)
            ]
            // Available at pick 5: Jahmyr Gibbs (1.06), CeeDee Lamb (1.07), etc.
        },
        myTeam: {
            players: [], // First pick
            needs: {
                QB: 1,
                RB: 2,
                WR: 2,
                TE: 1,
                FLEX: 2,
                BENCH: 6
            }
        },
        constraints: {
            maxReach: 12,
            preferStacks: true,
            avoidQBTEBackToBack: true
        }
    };

    try {
        console.log('📤 Sending request to /api/draft/assist...');
        console.log('Draft Context:', {
            round: testRequest.draft.round,
            pick: testRequest.draft.pickOverall,
            format: testRequest.league.format,
            drafted: testRequest.draft.board
        });

        const response = await fetch('http://localhost:3000/api/draft/assist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testRequest)
        });

        console.log(`📥 Response status: ${response.status}\n`);

        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ API Error:', errorData);
            return;
        }

        const recommendation = await response.json();

        console.log('🎉 SUCCESS! Draft recommendation received:\n');
        console.log('='.repeat(60));
        console.log(`🎯 DECISION: ${recommendation.decision.toUpperCase()}`);
        console.log(`🌟 PRIMARY PICK: ${recommendation.primary?.playerId || 'None'}`);
        console.log(`📊 CONFIDENCE: ${recommendation.confidence}%`);
        console.log('='.repeat(60));

        if (recommendation.primary) {
            console.log('\n📋 PRIMARY RECOMMENDATION:');
            console.log(`Player: ${recommendation.primary.playerId}`);
            console.log(`Position Need: ${recommendation.primary.fit?.positionalNeed || 'Unknown'}`);
            console.log(`ADP: ${recommendation.primary.value?.adp || 'Unknown'}`);
            console.log(`Reach: ${recommendation.primary.value?.reach > 0 ? '+' : ''}${recommendation.primary.value?.reach || 0}`);
            console.log(`Scarcity Score: ${recommendation.primary.value?.scarcityScore || 0}`);
            console.log(`Bye Impact: ${recommendation.primary.fit?.byeImpact || 'Unknown'}`);
            console.log(`Risk Flags: ${recommendation.primary.riskFlags?.join(', ') || 'None'}`);
            if (recommendation.primary.coachism) {
                console.log(`🏈 Coach Says: "${recommendation.primary.coachism}"`);
            }
            console.log(`💭 Reasoning: ${recommendation.primary.reason}`);
        }

        if (recommendation.alternates && recommendation.alternates.length > 0) {
            console.log('\n🔄 ALTERNATE OPTIONS:');
            recommendation.alternates.forEach((alt: any, index: number) => {
                console.log(`${index + 1}. ${alt.playerId} (Reach: ${alt.value?.reach > 0 ? '+' : ''}${alt.value?.reach || 0})`);
                console.log(`   Reason: ${alt.reason}`);
                if (alt.riskFlags?.length > 0) {
                    console.log(`   Risks: ${alt.riskFlags.join(', ')}`);
                }
            });
        }

        if (recommendation.strategyNotes && recommendation.strategyNotes.length > 0) {
            console.log('\n📝 STRATEGY NOTES:');
            recommendation.strategyNotes.forEach((note: string, index: number) => {
                console.log(`• ${note}`);
            });
        }

        console.log('\n✅ API Test Complete!');

    } catch (error) {
        console.error('💥 Test failed with error:', error);

        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 5).join('\n')
            });
        }
    }
}

// Also test a mid-round scenario
async function testMidRoundScenario() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Testing Mid-Round Scenario (Round 5, Need TE)...\n');

    const midRoundRequest = {
        league: {
            teams: 12,
            format: "PPR" as const,
            roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 }
        },
        draft: {
            round: 5,
            pickOverall: 53, // Pick 5 of round 5
            pickInRound: 5,
            snake: true,
            myTeamIndex: 4,
            picksUntilMe: 14,
            board: [
                // Simulate 4 rounds of picks (48 players drafted)
                "Christian McCaffrey", "Tyreek Hill", "Austin Ekeler", "Cooper Kupp",
                "Ja'Marr Chase", "Saquon Barkley", "Stefon Diggs", "Josh Allen",
                "Travis Kelce", "Derrick Henry", "Davante Adams", "Aaron Jones",
                // ... would normally have 48 players
            ]
        },
        myTeam: {
            players: [
                "Ja'Marr Chase",    // Round 1
                "Josh Jacobs",      // Round 2  
                "Mike Evans",       // Round 3
                "Tony Pollard"      // Round 4
            ],
            needs: { QB: 1, RB: 1, WR: 1, TE: 1, FLEX: 2, BENCH: 6 }
        }
    };

    try {
        const response = await fetch('http://localhost:3000/api/draft/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(midRoundRequest)
        });

        if (response.ok) {
            const recommendation = await response.json();
            console.log(`✅ Mid-round test: ${recommendation.primary?.playerId} (${recommendation.confidence}%)`);
            console.log(`💭 ${recommendation.primary?.reason}`);
        } else {
            console.log(`❌ Mid-round test failed: ${response.status}`);
        }

    } catch (error) {
        console.log(`💥 Mid-round test error: ${error}`);
    }
}

// Run the tests
async function runAllAPITests() {
    console.log('🚀 Starting Draft Assistant API Tests\n');

    // First, make sure the server is running
    try {
        const healthCheck = await fetch('http://localhost:3000/api/draft/assist');
        if (!healthCheck.ok) {
            console.log('⚠️  Server may not be running. Start with: npm run dev');
            return;
        }
    } catch (error) {
        console.log('❌ Cannot connect to server. Make sure to run: npm run dev');
        return;
    }

    await testDraftAPI();
    await testMidRoundScenario();

    console.log('\n🏁 All API tests completed!');
}

runAllAPITests().catch(console.error);
