// scripts/testEnhancedDataParser.ts
import 'dotenv/config';
import { dataParser } from '../lib/dataParser.js';

console.log('🧪 Testing Enhanced Data Parser with ALL Data...\n');

// Initialize all enhanced data
console.log('🔄 Initializing enhanced data parser...');
await dataParser.initializeData();

// Test 1: Red Zone Data
console.log('\n🎯 Testing Red Zone Data...');
const testRBs = ['Josh Jacobs', 'Derrick Henry', 'Kyren Williams'];
for (const rb of testRBs) {
    const rzData = dataParser.getRedZoneData(rb, 'RB');
    if (rzData) {
        console.log(`✅ ${rb} Red Zone: ${rzData.rzTouchdowns} TDs on ${rzData.rzAttempts} attempts (${rzData.rzTdPercent}% rate)`);
        if (rzData.glTouchdowns) {
            console.log(`   Goal Line: ${rzData.glTouchdowns} TDs on ${rzData.glAttempts} attempts`);
        }
    }
}

const testWRs = ['Calvin Ridley', 'Mike Evans', 'Ja\'Marr Chase'];
for (const wr of testWRs) {
    const rzData = dataParser.getRedZoneData(wr, 'WR');
    if (rzData) {
        console.log(`✅ ${wr} Red Zone: ${rzData.rzTouchdowns} TDs (${rzData.teamTdPercent}% of team)`);
    }
}

// Test 2: Coaching Changes
console.log('\n👨‍💼 Testing Coaching Changes...');
const testTeams = ['CHI', 'DAL', 'JAX', 'LV'];
for (const team of testTeams) {
    const coaching = dataParser.getCoachingChange(team);
    if (coaching) {
        console.log(`✅ ${team}: ${coaching.newCoach}`);
        console.log(`   Impact: ${coaching.fantasyImpact.substring(0, 100)}...`);
    }
}

// Test 3: Rookie Analysis
console.log('\n🆕 Testing Rookie Analysis...');
const testRookies = ['Cam Ward', 'Travis Hunter', 'Ashton Jeanty'];
for (const rookie of testRookies) {
    const analysis = dataParser.getRookieAnalysis(rookie);
    if (analysis) {
        console.log(`✅ ${rookie} (${analysis.position}, ${analysis.team})`);
        console.log(`   Draft: Round ${analysis.draftRound}, Pick ${analysis.draftPick}`);
        console.log(`   Analysis: ${analysis.analysis.substring(0, 150)}...`);
    }
}

// Test 4: Enhanced Market Share (WR/TE)
console.log('\n📊 Testing Enhanced Market Share...');
const testWRMarket = ['Ja\'Marr Chase', 'Mike Evans'];
for (const wr of testWRMarket) {
    const marketShare = dataParser.getMarketShareByPosition(wr, 'WR');
    if (marketShare) {
        console.log(`✅ ${wr}: ${marketShare.tgtPercent}% targets, ${marketShare.ydPercent}% yards`);
    }
}

const testTEs = ['Travis Kelce', 'Mark Andrews'];
for (const te of testTEs) {
    const marketShare = dataParser.getMarketShareByPosition(te, 'TE');
    if (marketShare) {
        console.log(`✅ ${te}: ${marketShare.tgtPercent}% targets, ${marketShare.tdPercent}% TDs`);
    }
}

// Test 5: Integration Test - Full Player Context
console.log('\n🔗 Testing Full Player Context Integration...');
const testPlayers = [
    { name: 'Caleb Williams', position: 'QB', team: 'CHI' },
    { name: 'Travis Hunter', position: 'WR', team: 'JAX' },
    { name: 'Josh Jacobs', position: 'RB', team: 'GB' }
];

for (const player of testPlayers) {
    console.log(`\n📋 Full Context for ${player.name}:`);

    // ADP Data
    const adp = dataParser.getPlayerADP(player.name);
    if (adp) {
        console.log(`   ADP: PPR ${adp.ppr}, Team: ${adp.team}, Bye: ${adp.byeWeek}`);
    }

    // Market Share
    const marketShare = dataParser.getMarketShareByPosition(player.name, player.position);
    if (marketShare) {
        console.log(`   Market Share: ${marketShare.tgtPercent || marketShare.attPercent}% team usage`);
    }

    // Red Zone
    const redZone = dataParser.getRedZoneData(player.name, player.position);
    if (redZone) {
        console.log(`   Red Zone: ${redZone.rzTouchdowns} TDs on ${redZone.rzAttempts} attempts`);
    }

    // Coaching
    const coaching = dataParser.getCoachingChange(player.team);
    if (coaching) {
        console.log(`   Coaching: New ${coaching.position} ${coaching.newCoach}`);
    }

    // Rookie Analysis
    const rookie = dataParser.getRookieAnalysis(player.name);
    if (rookie) {
        console.log(`   Rookie: Round ${rookie.draftRound} pick with detailed analysis available`);
    }

    // Expert Analysis
    const expert = dataParser.getExpertAnalysis(player.name);
    if (expert) {
        console.log(`   Expert Take: ${expert.substring(0, 100)}...`);
    }
}

console.log('\n🎉 ENHANCED DATA PARSER TEST COMPLETE! 🚀');
console.log('💡 Ready to build the most intelligent fantasy AI summaries ever created!');
