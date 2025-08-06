// scripts/testADPSystem.ts
import 'dotenv/config';
import { adpSystem, type LeagueFormat } from '../lib/adpSystem.js';
import { dataParser } from '../lib/dataParser.js';

console.log('🧪 Testing Enhanced ADP System...\n');

// Initialize data first
console.log('🔄 Initializing data...');
await dataParser.initializeData();

// Test 1: Expert Analysis Loading
console.log('\n📝 Testing Expert Analysis Loading...');
const testPlayersForAnalysis = ['Bryce Young', 'Justin Fields', 'Jordan Mason', 'Tank Bigsby'];

for (const playerName of testPlayersForAnalysis) {
    const analysis = adpSystem.getExpertAnalysis(playerName);
    if (analysis) {
        console.log(`✅ Found expert analysis for ${playerName}:`);
        console.log(`   ${analysis.substring(0, 100)}...`);
    } else {
        console.log(`❌ No expert analysis found for ${playerName}`);
    }
}

// Test 2: Format-Specific ADP Adjustments
console.log('\n⚙️ Testing Format-Specific ADP Adjustments...');

const testFormats: LeagueFormat[] = [
    {
        scoring: 'PPR',
        qbFormat: '1QB',
        teFormat: 'Standard',
        leagueSize: 12,
        positions: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 }
    },
    {
        scoring: 'Standard',
        qbFormat: 'Superflex',
        teFormat: 'TE-Premium',
        leagueSize: 10,
        positions: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 1 }
    }
];

const testPlayersForADP = ['Ja\'Marr Chase', 'Saquon Barkley', 'Lamar Jackson'];

for (const player of testPlayersForADP) {
    const adpData = adpSystem.getSleeperADP(player);
    if (adpData) {
        console.log(`\n📊 ${player} ADP Analysis:`);
        console.log(`   Base ADPs: PPR ${adpData.ppr} | Std ${adpData.standard} | SF ${adpData.superflex}`);

        for (const format of testFormats) {
            const adjustedADP = adpSystem.applyFormatAdjustments(adpData, format);
            const round = Math.ceil(adjustedADP / format.leagueSize);
            console.log(`   ${format.scoring} ${format.qbFormat}: ${adjustedADP} (Round ${round})`);
        }
    }
}

// Test 3: Player Context Integration
console.log('\n🔗 Testing Player Context Integration...');

const contextTestPlayers = ['Saquon Barkley', 'Kyren Williams', 'Bryce Young'];

for (const playerName of contextTestPlayers) {
    const context = adpSystem.getPlayerContext(playerName, testFormats[0]);
    console.log(`\n📋 Context for ${playerName}:`);
    console.log(`   Position: ${context.position}, Team: ${context.team}`);

    if (context.adpData) {
        console.log(`   ADP: PPR ${context.adpData.ppr}, Format Adjusted: ${context.formatAdjustedADP}`);
    }

    if (context.marketShare) {
        console.log(`   Usage: ${context.marketShare.rbPointsPercent}% of team RB points`);
    }

    if (context.expertAnalysis) {
        console.log(`   Expert Take: ${context.expertAnalysis.substring(0, 80)}...`);
    }
}

// Test 4: Enhanced AI Prompt Generation
console.log('\n🤖 Testing Enhanced AI Prompt Generation...');

const promptTestPlayer = 'Saquon Barkley';
const mockStats = {
    rushing_yards: 2005,
    rushing_touchdowns: 13,
    receptions: 33,
    receiving_yards: 278,
    receiving_touchdowns: 2,
    fantasy_points: 312.3
};

const enhancedPrompt = adpSystem.generateEnhancedPrompt(
    promptTestPlayer,
    testFormats[0],
    mockStats
);

console.log(`✅ Generated enhanced prompt for ${promptTestPlayer}:`);
console.log('📄 Prompt preview:');
console.log(enhancedPrompt.substring(0, 500) + '...');

// Test 5: Value Pick Identification
console.log('\n💰 Testing Value Pick Identification...');

const valuePicks = adpSystem.findValuePicks('RB', testFormats[0]);
console.log(`✅ Found ${valuePicks.length} RB value picks:`);

valuePicks.slice(0, 5).forEach(pick => {
    console.log(`   ${pick.name} (${pick.team}) - ADP: ${pick.adpData?.ppr || 'N/A'}`);
});

// Test 6: Cross-Format Comparison
console.log('\n📈 Testing Cross-Format Comparison...');

const comparisonPlayer = 'Lamar Jackson';
const comparisonData = adpSystem.getSleeperADP(comparisonPlayer);

if (comparisonData) {
    console.log(`\n🔄 ${comparisonPlayer} Format Impact:`);

    const pprAdp = adpSystem.applyFormatAdjustments(comparisonData, {
        scoring: 'PPR',
        qbFormat: '1QB',
        teFormat: 'Standard',
        leagueSize: 12,
        positions: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 }
    });

    const superflexAdp = adpSystem.applyFormatAdjustments(comparisonData, {
        scoring: 'PPR',
        qbFormat: 'Superflex',
        teFormat: 'Standard',
        leagueSize: 12,
        positions: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 1 }
    });

    const adpDifference = pprAdp - superflexAdp;
    console.log(`   1QB PPR: Pick ${pprAdp} (Round ${Math.ceil(pprAdp / 12)})`);
    console.log(`   Superflex PPR: Pick ${superflexAdp} (Round ${Math.ceil(superflexAdp / 12)})`);
    console.log(`   Format Impact: ${adpDifference > 0 ? '+' : ''}${adpDifference} picks`);
}

console.log('\n🎉 Enhanced ADP System Test Complete! 🚀');
