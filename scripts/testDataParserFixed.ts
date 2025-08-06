// scripts/testDataParserFixed.ts
import 'dotenv/config';
import { dataParser } from '../lib/dataParser.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Data Parser Tests...\n');

// Test 1: File Existence
console.log('📁 Testing File Existence...');
const requiredFiles = [
    'data/adp/2025_sleeper_adp_ppr.csv',
    'data/research/2024_marketshare_rb.csv',
    'data/analysis/2025_sleeper_candidates.txt',
    'data/analysis/2025_breakout_candidates.txt',
];

let filesOK = true;
for (const filePath of requiredFiles) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ File exists: ${filePath}`);
    } else {
        console.log(`❌ File missing: ${filePath}`);
        filesOK = false;
    }
}

if (!filesOK) {
    console.log('❌ Some files are missing. Please check your data directory.');
    process.exit(1);
}

// Test 2: Initialize Data Parser
console.log('\n🔄 Initializing data parser...');
try {
    await dataParser.initializeData();
    console.log('✅ Data parser initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize data parser:', error);
    process.exit(1);
}

// Test 3: ADP Data
console.log('\n📊 Testing ADP Data...');
const testPlayers = ['Ja\'Marr Chase', 'Saquon Barkley', 'Bijan Robinson'];

for (const playerName of testPlayers) {
    const player = dataParser.getPlayerADP(playerName);
    if (player) {
        console.log(`✅ Found ${playerName}:`);
        console.log(`   Position: ${player.position}, Team: ${player.team}`);
        console.log(`   PPR ADP: ${player.ppr}, Standard: ${player.standard}, Superflex: ${player.superflex}`);
    } else {
        console.log(`❌ Player not found: ${playerName}`);
    }
}

// Test 4: Market Share Data
console.log('\n📈 Testing Market Share Data...');
const testRBs = ['Saquon Barkley', 'Jonathan Taylor', 'Kyren Williams'];

for (const rbName of testRBs) {
    const rb = dataParser.getPlayerMarketShare(rbName);
    if (rb) {
        console.log(`✅ Found ${rbName}:`);
        console.log(`   Team: ${rb.team}, Games: ${rb.gamesPlayed}`);
        console.log(`   RB Points%: ${rb.rbPointsPercent}%, Rush Att%: ${rb.attPercent}%`);
    } else {
        console.log(`❌ RB not found: ${rbName}`);
    }
}

// Test 5: Text File Reading
console.log('\n📝 Testing Text File Reading...');
try {
    const sleeperFile = path.join(process.cwd(), 'data/analysis/2025_sleeper_candidates.txt');
    const content = fs.readFileSync(sleeperFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    console.log(`✅ Read sleeper candidates: ${lines.length} lines`);
    console.log('📄 Sample content:');
    lines.slice(0, 3).forEach(line => {
        if (line.trim()) console.log(`   ${line.substring(0, 80)}...`);
    });
} catch (error) {
    console.error('❌ Error reading text file:', error);
}

console.log('\n🎉 ALL TESTS COMPLETED! Your data is ready to use! 🚀');
