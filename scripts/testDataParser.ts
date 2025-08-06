// scripts/testDataParser.ts
import 'dotenv/config';
import { dataParser } from '../lib/dataParser';
import fs from 'fs';
import path from 'path';

interface TestResults {
    passed: number;
    failed: number;
    errors: string[];
}

class DataParserTester {
    private results: TestResults = {
        passed: 0,
        failed: 0,
        errors: []
    };

    private log(message: string) {
        console.log(message);
    }

    private pass(testName: string) {
        this.results.passed++;
        this.log(`✅ PASS: ${testName}`);
    }

    private fail(testName: string, error: string) {
        this.results.failed++;
        this.results.errors.push(`${testName}: ${error}`);
        this.log(`❌ FAIL: ${testName} - ${error}`);
    }

    /**
     * Test if data files exist
     */
    private testFileExistence() {
        this.log('\n📁 Testing File Existence...');

        const requiredFiles = [
            'data/adp/2025_sleeper_adp_ppr.csv',
            'data/research/2024_marketshare_rb.csv',
            'data/analysis/2025_sleeper_candidates.txt',
            'data/analysis/2025_breakout_candidates.txt',
        ];

        for (const filePath of requiredFiles) {
            const fullPath = path.join(process.cwd(), filePath);
            if (fs.existsSync(fullPath)) {
                this.pass(`File exists: ${filePath}`);
            } else {
                this.fail(`File missing: ${filePath}`, 'File not found');
            }
        }
    }

    /**
     * Test ADP data parsing
     */
    private async testADPParsing() {
        this.log('\n📊 Testing ADP Data Parsing...');

        try {
            const adpData = await dataParser.parseSleeperADP();

            // Test 1: Data was loaded
            if (adpData.length > 0) {
                this.pass(`ADP data loaded: ${adpData.length} players`);
            } else {
                this.fail('ADP data loading', 'No data returned');
                return;
            }

            // Test 2: Check first few players for expected format
            const testPlayers = ['Ja\'Marr Chase', 'Saquon Barkley', 'Bijan Robinson'];

            for (const playerName of testPlayers) {
                const player = dataParser.getPlayerADP(playerName);
                if (player) {
                    this.pass(`Found player: ${playerName}`);

                    // Test player data structure
                    if (player.ppr && player.position && player.team) {
                        this.pass(`Valid data structure for: ${playerName}`);
                        this.log(`   └─ ${playerName}: ${player.position}, ${player.team}, PPR ADP: ${player.ppr}`);
                    } else {
                        this.fail(`Data structure for ${playerName}`, 'Missing required fields');
                    }
                } else {
                    this.fail(`Player lookup: ${playerName}`, 'Player not found in ADP data');
                }
            }

            // Test 3: Check ADP format differences
            const chaseData = dataParser.getPlayerADP('Ja\'Marr Chase');
            if (chaseData) {
                this.log(`   📈 Ja'Marr Chase ADP Formats:`);
                this.log(`      PPR: ${chaseData.ppr}`);
                this.log(`      Standard: ${chaseData.standard}`);
                this.log(`      Superflex: ${chaseData.superflex}`);

                if (chaseData.ppr > 0 && chaseData.standard > 0) {
                    this.pass('Multiple ADP formats available');
                } else {
                    this.fail('Multiple ADP formats', 'Missing format data');
                }
            }

        } catch (error: any) {
            this.fail('ADP parsing', error.message);
        }
    }

    /**
     * Test Market Share data parsing
     */
    private async testMarketShareParsing() {
        this.log('\n📈 Testing Market Share Data Parsing...');

        try {
            const marketShareData = await dataParser.parseRBMarketShare();

            // Test 1: Data was loaded
            if (marketShareData.length > 0) {
                this.pass(`Market Share data loaded: ${marketShareData.length} RBs`);
            } else {
                this.fail('Market Share data loading', 'No data returned');
                return;
            }

            // Test 2: Check specific high-usage RBs
            const testRBs = ['Saquon Barkley', 'Jonathan Taylor', 'Kyren Williams'];

            for (const rbName of testRBs) {
                const rb = dataParser.getPlayerMarketShare(rbName);
                if (rb) {
                    this.pass(`Found RB: ${rbName}`);
                    this.log(`   └─ ${rbName}: ${rb.rbPointsPercent}% of team RB points, ${rb.attPercent}% of attempts`);

                    // Test that the data makes sense
                    if (rb.rbPointsPercent && rb.rbPointsPercent > 50) {
                        this.pass(`Realistic market share for: ${rbName}`);
                    } else {
                        this.fail(`Market share for ${rbName}`, 'Unrealistic or missing percentage');
                    }
                } else {
                    this.fail(`RB lookup: ${rbName}`, 'RB not found in market share data');
                }
            }

        } catch (error: any) {
            this.fail('Market Share parsing', error.message);
        }
    }

    /**
     * Test text file parsing (basic read test)
     */
    private testTextFileParsing() {
        this.log('\n📝 Testing Text File Parsing...');

        try {
            const txtFiles = [
                'data/analysis/2025_sleeper_candidates.txt',
                'data/analysis/2025_breakout_candidates.txt',
            ];

            for (const filePath of txtFiles) {
                const fullPath = path.join(process.cwd(), filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const lines = content.split('\n').filter(line => line.trim());

                    this.pass(`Read ${path.basename(filePath)}: ${lines.length} lines`);

                    // Look for player names and ADP mentions
                    const playerMentions = lines.filter(line =>
                        line.includes('ADP:') || line.includes('Current ADP:')
                    ).length;

                    if (playerMentions > 0) {
                        this.pass(`Found ${playerMentions} ADP mentions in ${path.basename(filePath)}`);
                    }

                    // Show sample content
                    const sampleLines = lines.slice(0, 3);
                    this.log(`   📄 Sample from ${path.basename(filePath)}:`);
                    sampleLines.forEach(line => {
                        if (line.trim()) this.log(`      ${line.substring(0, 80)}...`);
                    });

                } else {
                    this.fail(`Text file read: ${filePath}`, 'File not found');
                }
            }

        } catch (error: any) {
            this.fail('Text file parsing', error.message);
        }
    }

    /**
     * Test data integration (combining multiple sources)
     */
    private async testDataIntegration() {
        this.log('\n🔗 Testing Data Integration...');

        try {
            // Test: Find a player in both ADP and Market Share data
            const testPlayer = 'Saquon Barkley';

            const adpData = dataParser.getPlayerADP(testPlayer);
            const marketData = dataParser.getPlayerMarketShare(testPlayer);

            if (adpData && marketData) {
                this.pass(`Cross-data lookup for: ${testPlayer}`);
                this.log(`   📊 Integration Data for ${testPlayer}:`);
                this.log(`      ADP (PPR): ${adpData.ppr}`);
                this.log(`      Market Share: ${marketData.rbPointsPercent}% of team points`);
                this.log(`      Team: ${adpData.team} (ADP) vs ${marketData.team} (Market)`);

                // Verify team consistency
                if (adpData.team === marketData.team) {
                    this.pass('Team data consistency across sources');
                } else {
                    this.fail('Team data consistency', `ADP shows ${adpData.team}, Market shows ${marketData.team}`);
                }
            } else {
                this.fail(`Cross-data lookup for ${testPlayer}`, 'Player not found in both sources');
            }

        } catch (error: any) {
            this.fail('Data integration', error.message);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        this.log('🧪 Starting Data Parser Tests...\n');

        // Initialize data parser
        try {
            await dataParser.initializeData();
        } catch (error: any) {
            this.fail('Data initialization', error.message);
            return this.showResults();
        }

        // Run all test suites
        this.testFileExistence();
        await this.testADPParsing();
        await this.testMarketShareParsing();
        this.testTextFileParsing();
        await this.testDataIntegration();

        this.showResults();
    }

    /**
     * Show final test results
     */
    private showResults() {
        this.log('\n🏁 Test Results Summary:');
        this.log(`✅ Passed: ${this.results.passed}`);
        this.log(`❌ Failed: ${this.results.failed}`);

        if (this.results.failed > 0) {
            this.log('\n❌ Failed Tests:');
            this.results.errors.forEach(error => this.log(`   • ${error}`));
        }

        if (this.results.failed === 0) {
            this.log('\n🎉 ALL TESTS PASSED! Your data is ready to use! 🚀');
        } else {
            this.log('\n⚠️  Some tests failed. Please check the errors above.');
        }
    }
}

// Main execution
async function main() {
    const tester = new DataParserTester();
    await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { DataParserTester };
