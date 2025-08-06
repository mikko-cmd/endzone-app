// scripts/simpleTest.ts
console.log('🧪 Simple Test Starting...');

// Test 1: Basic functionality
console.log('✅ Console output works');
console.log('📁 Working directory:', process.cwd());

// Test 2: File system access
import fs from 'fs';
import path from 'path';

const testFiles = [
    'data/adp/2025_sleeper_adp_ppr.csv',
    'data/research/2024_marketshare_rb.csv',
    'data/analysis/2025_sleeper_candidates.txt'
];

console.log('\n📁 Testing file existence...');
testFiles.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${filePath}`);
});

// Test 3: Try to read first CSV file
try {
    const csvPath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
    if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.split('\n');
        console.log(`\n📊 CSV file info:`);
        console.log(`   Lines: ${lines.length}`);
        console.log(`   Header: ${lines[0]}`);
        console.log(`   First data line: ${lines[1]}`);
    }
} catch (error) {
    console.error('❌ Error reading CSV:', error);
}

console.log('\n🏁 Simple Test Complete');
