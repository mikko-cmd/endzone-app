const totalPlayers = positionPlayers.length;

let strength: 'weak' | 'adequate' | 'strong' = 'adequate';

if (pos === 'RB') {
    if (totalPlayers < 3 || avgStarterValue < 600) strength = 'weak';
    else if (totalPlayers >= 5 && avgStarterValue >= 800) strength = 'strong';
} else if (pos === 'WR') {
    if (totalPlayers < 4 || avgStarterValue < 600) strength = 'weak';
    else if (totalPlayers >= 6 && avgStarterValue >= 750) strength = 'strong';
}

analysis[pos] = { starters, depth, strength };
    });

return analysis;
}

// Enhanced cross-position trade generator
function generateBalancedCrossPositionTrades(
    userTeam: TeamAnalysis,
    otherTeam: TeamAnalysis,
    primaryUserPlayer: any,
    primaryOtherPlayer: any
): TradeProposal[] {
    const trades: TradeProposal[] = [];

    // Only for RB↔WR trades
    if (!((primaryUserPlayer.position === 'RB' && primaryOtherPlayer.position === 'WR') ||
        (primaryUserPlayer.position === 'WR' && primaryOtherPlayer.position === 'RB'))) {
        return trades;
    }

    console.log(`[Cross-Position] Analyzing ${primaryUserPlayer.position}↔${primaryOtherPlayer.position} trade balance`);

    // Analyze depth for both teams
    const userDepth = analyzePositionalDepth(userTeam);
    const otherDepth = analyzePositionalDepth(otherTeam);

    // Check if teams can afford the positional swap
    const userGivingPos = primaryUserPlayer.position as 'RB' | 'WR';
    const otherGivingPos = primaryOtherPlayer.position as 'RB' | 'WR';

    if (userDepth[userGivingPos].strength === 'weak' || otherDepth[otherGivingPos].strength === 'weak') {
        console.log(`[Cross-Position] ❌ Trade rejected - insufficient depth (User ${userGivingPos}: ${userDepth[userGivingPos].strength}, Other ${otherGivingPos}: ${otherDepth[otherGivingPos].strength})`);
        return trades;
    }

    // Find balancing players
    // User needs to add a player from the position they're receiving
    // Other team needs to add a player from the position they're receiving
    const userBalancingCandidates = userTeam.players.filter(p =>
        p.position === otherGivingPos &&
        p.value > 0 &&
        p.player_id !== primaryUserPlayer.player_id
    ).sort((a, b) => (a.value || 0) - (b.value || 0)); // Start with lower values
    const otherValue = otherTriple.reduce((sum, p) => sum + p.value, 0);

    // Only consider if you gain value
    if (otherValue <= userValue) continue;

    const trade = createEndzoneValueTrade(
        userTeam, userTriple, otherTriple,
        otherTeam, otherTriple, userTriple,
        '3v3'
    );

    if (trade && trade.fairness_score >= 0.50 && trade.team_a.net_value > 0) {
        trades.push(trade);
    }

    const otherBalancingCandidates = otherTeam.players.filter(p =>
        p.position === userGivingPos &&
        p.value > 0 &&
        p.player_id !== primaryOtherPlayer.player_id
    ).sort((a, b) => (a.value || 0) - (b.value || 0)); // Start with lower values

    if (userBalancingCandidates.length === 0 || otherBalancingCandidates.length === 0) {
        console.log(`[Cross-Position] ❌ No balancing players available`);
    }
}
                }
            }
        }
    }

return trades.slice(0, 5); // Limit to best 5
}

// Simplified trade creation (no fairness tiers)
function createEndzoneValueTrade(
    teamA: TeamAnalysis, teamAGiving: any[], teamAReceiving: any[],
    teamB: TeamAnalysis, teamBGiving: any[], teamBReceiving: any[],
    tradeType: string
): TradeProposal | null {
    const teamAValue = teamAGiving.reduce((sum, p) => sum + (p.value || 0), 0);
    const teamBValue = teamBGiving.reduce((sum, p) => sum + (p.value || 0), 0);

    if (teamAValue === 0 || teamBValue === 0) return null;

    const fairnessScore = Math.min(teamAValue, teamBValue) / Math.max(teamAValue, teamBValue);
    return trades;
}

// Try combinations to find balanced trades
for (const userBalancing of userBalancingCandidates.slice(0, 3)) { // Try top 3
    for (const otherBalancing of otherBalancingCandidates.slice(0, 3)) { // Try top 3
        const userTotal = (primaryUserPlayer.value || 0) + (userBalancing.value || 0);
        const otherTotal = (primaryOtherPlayer.value || 0) + (otherBalancing.value || 0);

        // 🔥 SIMPLIFIED REASONING - Remove redundant information
        let reasoning: string[];

        if (tradeType.includes('cross_position')) {

            const fairness = Math.min(userTotal, otherTotal) / Math.max(userTotal, otherTotal);
            const userGain = otherTotal - userTotal;

            // Only consider if user gains value and trade is reasonably fair
            if (userGain > 0 && fairness >= 0.75) {
                const trade = createEndzoneValueTrade(
                    userTeam,
                    [primaryUserPlayer, userBalancing],
                    [primaryOtherPlayer, otherBalancing],
                    // Special reasoning for cross-position trades (set in generateBalancedCrossPositionTrades)
                    reasoning = []; // Will be overridden
            } else if (teamAGiving.length > 1) {
                reasoning = [
                    `Multi-player trade: ${teamAGiving.length}v${teamBGiving.length}`,
                    `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`,
                    `Net gain: +${teamBValue - teamAValue} EV`
                ];
            } else {
                reasoning = [
                    `Trade fairness: ${(fairnessScore * 100).toFixed(1)}%`,
                    `Net gain: +${teamBValue - teamAValue} EV`
                ];
            }

            return {
                trade_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                team_a: {
                    team_name: teamA.team_name,
                    owner_id: teamA.owner_id,
                    giving: teamAGiving.map(p => ({
                        player_id: p.player_id,
                        name: p.name,
                        position: p.position,
                        trade_value: p.value || 0,
                        value: p.value || 0
                    })),
                    receiving: teamAReceiving.map(p => ({
                        player_id: p.player_id,
                        name: p.name,
                        position: p.position,
                        trade_value: p.value || 0,
                        value: p.value || 0
                    })),
                    net_value: teamBValue - teamAValue,
                    addresses_needs: []
                    otherTeam,
                    [primaryOtherPlayer, otherBalancing],
                    [primaryUserPlayer, userBalancing],
                    '2v2_cross_position_balanced'
                );

                    if(trade) {
                        // Add enhanced reasoning for cross-position trades
                        trade.reasoning = [
                            `Cross-position trade: ${primaryUserPlayer.position}+${userBalancing.position} ↔ ${primaryOtherPlayer.position}+${otherBalancing.position}`,
                            `Maintains positional balance for both teams`,
                            `You gain: +${userGain} EV while keeping roster depth`,
                            `Trade fairness: ${(fairness * 100).toFixed(1)}%`
                        ];

                        trades.push(trade);
                        console.log(`[Cross-Position] ✅ Balanced trade: ${primaryUserPlayer.name}+${userBalancing.name} ↔ ${primaryOtherPlayer.name}+${otherBalancing.name} (+${userGain} EV)`);
                    }
                }
            }
        }

        return trades.slice(0, 2); // Return best 2 balanced cross-position trades
    }

    // Update generateMultiPlayerTrades to include cross-position balanced trades
    function generateMultiPlayerTrades(
        userTeam: TeamAnalysis,
        otherTeams: TeamAnalysis[],
        maxResults: number
    ): TradeProposal[] {
        console.log(`[Multi-Player Trades] Generating up to ${maxResults} multi-player trades`);

        const allTrades: TradeProposal[] = [];

        for (const otherTeam of otherTeams) {
            // Generate cross-position balanced trades first (highest priority)
            for (const userPlayer of userTeam.players) {
                for (const otherPlayer of otherTeam.players) {
                    if (!userPlayer.value || !otherPlayer.value) continue;
                    if (otherPlayer.value <= userPlayer.value) continue;

                    const crossPositionTrades = generateBalancedCrossPositionTrades(
                        userTeam, otherTeam, userPlayer, otherPlayer
                    );
                    allTrades.push(...crossPositionTrades);
                },
                team_b: {
                    team_name: teamB.team_name,
                        owner_id: teamB.owner_id,
                            giving: teamBGiving.map(p => ({
                                player_id: p.player_id,
                                name: p.name,
                                position: p.position,
                                trade_value: p.value || 0,
                            }
        }

                // Generate regular 2v2 and 3v3 trades
                const twoVTwoTrades = generate2v2Trades(userTeam, otherTeam);
                allTrades.push(...twoVTwoTrades);

                const threeVThreeTrades = generate3v3Trades(userTeam, otherTeam);
                value: p.value || 0
            })),
            receiving: teamBReceiving.map(p => ({
                player_id: p.player_id,
                name: p.name,
                position: p.position,
                trade_value: p.value || 0,
                value: p.value || 0
            })),
                net_value: teamAValue - teamBValue,
                    addresses_needs: []
        },
        fairness_score: fairnessScore,
            fairness_tier: fairnessScore >= 0.80 ? 'very_strict' : fairnessScore >= 0.70 ? 'somewhat_fair' : 'fleece',
                trade_type: tradeType,
                    allTrades.push(...threeVThreeTrades);
    }

    // Sort by combination of fairness and strategic value
    return allTrades
        .filter(trade => trade.team_a.net_value > 0)
        .sort((a, b) => {
            // Prioritize cross-position balanced trades
            const aIsBalanced = a.trade_type?.includes('cross_position') ? 0.1 : 0;
            const bIsBalanced = b.trade_type?.includes('cross_position') ? 0.1 : 0;

            const aScore = a.fairness_score * 0.6 + (a.team_a.net_value / 1000) * 0.3 + aIsBalanced;
            const bScore = b.fairness_score * 0.6 + (b.team_a.net_value / 1000) * 0.3 + bIsBalanced;
            return bScore - aScore;
        })
        .slice(0, maxResults);
}

// Generate 2v2 trades
function generate2v2Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.value && p.value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.value && p.value > 0);

    // Try different 2v2 combinations
    for (let i = 0; i < userPlayers.length - 1; i++) {
        for (let j = i + 1; j < userPlayers.length; j++) {
            const userPair = [userPlayers[i], userPlayers[j]];
            const userValue = userPair.reduce((sum, p) => sum + (p.value || 0), 0);

            for (let x = 0; x < otherPlayers.length - 1; x++) {
                for (let y = x + 1; y < otherPlayers.length; y++) {
                    const otherPair = [otherPlayers[x], otherPlayers[y]];
                    const otherValue = otherPair.reduce((sum, p) => sum + (p.value || 0), 0);

                    // Only consider if you gain value
                    if (otherValue <= userValue) continue;

                    const trade = createEndzoneValueTrade(
                        userTeam, userPair, otherPair,
                        otherTeam, otherPair, userPair,
                        '2v2_balanced'
                    );

                    if (trade) trades.push(trade);
                }
            }
        }
    }

    return trades.slice(0, 3); // Limit to best 3
}

// Generate 3v3 trades
function generate3v3Trades(userTeam: TeamAnalysis, otherTeam: TeamAnalysis): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const userPlayers = userTeam.players.filter(p => p.value && p.value > 0);
    const otherPlayers = otherTeam.players.filter(p => p.value && p.value > 0);

    // Limit combinations to prevent performance issues
    const maxCombinations = 20;
    let combinations = 0;

    for (let i = 0; i < userPlayers.length - 2 && combinations < maxCombinations; i++) {
        for (let j = i + 1; j < userPlayers.length - 1 && combinations < maxCombinations; j++) {
            for (let k = j + 1; k < userPlayers.length && combinations < maxCombinations; k++) {
                const userTrio = [userPlayers[i], userPlayers[j], userPlayers[k]];
                const userValue = userTrio.reduce((sum, p) => sum + (p.value || 0), 0);

                for (let x = 0; x < otherPlayers.length - 2 && combinations < maxCombinations; x++) {
                    for (let y = x + 1; y < otherPlayers.length - 1 && combinations < maxCombinations; y++) {
                        for (let z = y + 1; z < otherPlayers.length && combinations < maxCombinations; z++) {
                            const otherTrio = [otherPlayers[x], otherPlayers[y], otherPlayers[z]];
                            const otherValue = otherTrio.reduce((sum, p) => sum + (p.value || 0), 0);

                            combinations++;

                            // Only consider if you gain value
                            if (otherValue <= userValue) continue;

                            const trade = createEndzoneValueTrade(
                                userTeam, userTrio, otherTrio,
                                otherTeam, otherTrio, userTrio,
                                '3v3_balanced'
                            );

                            if (trade) trades.push(trade);
                        }
                    }
                }
            }
        }
    }

    return trades.slice(0, 2); // Limit to best 2
}

// Helper function to get fairness bucket ranges
function getFairnessBucket(tier: 'fleece' | 'somewhat_fair' | 'very_strict'): { min: number; max: number } {
    switch (tier) {
        case 'fleece':
            return { min: 0.50, max: 0.69 };
        case 'somewhat_fair':
            return { min: 0.70, max: 0.79 };
        case 'very_strict':
            return { min: 0.80, max: 1.00 };
        default:
            return { min: 0.70, max: 0.79 };
    }
}

// Calculate Endzone Value based on projected points and percentile ranking
function calculateEndzoneValue(projectedPoints: number, allProjectionValues: number[]): number {
    if (!projectedPoints || projectedPoints <= 0) return 0;

    const validProjections = allProjectionValues.filter(p => p > 0).sort((a, b) => b - a);
    if (validProjections.length === 0) return Math.round(projectedPoints * 10);

    const playerRank = validProjections.findIndex(p => p <= projectedPoints);
    return Math.round((validProjections.length - playerRank + 1) / validProjections.length * 1000);
}