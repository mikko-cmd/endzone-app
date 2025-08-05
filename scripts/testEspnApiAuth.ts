import 'dotenv/config';
import axios from 'axios';

// Test ESPN API endpoints with different authentication approaches
async function testEspnApiAuth() {
    console.log('🔍 Testing ESPN API Authentication Methods\n');

    // Different ESPN API base URLs to try
    const apiVersions = [
        {
            name: 'ESPN Fantasy API v3',
            base: 'https://fantasy.espn.com/apis/v3/games/ffl',
            needsAuth: true
        },
        {
            name: 'ESPN Site API v2',
            base: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
            needsAuth: false
        },
        {
            name: 'ESPN Core API v2',
            base: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl',
            needsAuth: false
        },
        {
            name: 'ESPN Hidden API',
            base: 'https://api.espn.com/v1/sports/football/nfl',
            needsAuth: false
        }
    ];

    // Test different endpoints for each API version
    const testEndpoints = [
        '',
        '/teams',
        '/players',
        '/seasons/2025',
        '/seasons/2025/players',
        '/seasons/2025/projections'
    ];

    for (const api of apiVersions) {
        console.log(`\n📡 Testing ${api.name}`);
        console.log(`🔗 Base URL: ${api.base}`);

        for (const endpoint of testEndpoints) {
            const url = `${api.base}${endpoint}`;

            try {
                console.log(`\n  Testing: ${endpoint || '(root)'}`);

                const headers: any = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.espn.com/'
                };

                // For fantasy API, try with cookies/session
                if (api.needsAuth) {
                    headers['X-Requested-With'] = 'XMLHttpRequest';
                }

                const response = await axios.get(url, {
                    timeout: 10000,
                    headers,
                    maxRedirects: 0, // Don't follow redirects
                    validateStatus: (status) => status < 400 // Accept 3xx as success
                });

                if (response.status === 200) {
                    const data = response.data;

                    // Check if it's JSON or HTML
                    if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
                        console.log(`    ❌ HTML redirect (not API data)`);
                    } else if (typeof data === 'object') {
                        console.log(`    ✅ JSON data received (${JSON.stringify(data).length} chars)`);

                        // Look for player/projection data
                        if (data.players || data.athletes || (Array.isArray(data) && data.length > 0)) {
                            console.log(`    🎯 Contains player data!`);

                            // Save a sample
                            const samplePath = `espn-sample-${api.name.toLowerCase().replace(/\s+/g, '-')}-${endpoint.replace(/\//g, '-') || 'root'}.json`;
                            require('fs').writeFileSync(samplePath, JSON.stringify(data, null, 2));
                            console.log(`    💾 Sample saved: ${samplePath}`);
                        }
                    } else {
                        console.log(`    ⚠️ Unexpected data type: ${typeof data}`);
                    }
                } else {
                    console.log(`    ⚠️ Status: ${response.status}`);
                }

            } catch (error: any) {
                if (error.response?.status === 404) {
                    console.log(`    ❌ 404 Not Found`);
                } else if (error.response?.status === 403) {
                    console.log(`    🔒 403 Forbidden (needs auth)`);
                } else if (error.response?.status >= 300 && error.response?.status < 400) {
                    console.log(`    🔄 ${error.response.status} Redirect`);
                } else if (error.code === 'ECONNABORTED') {
                    console.log(`    ⏱️ Timeout`);
                } else {
                    console.log(`    ❌ Error: ${error.message}`);
                }
            }
        }
    }

    console.log('\n🎉 ESPN API authentication testing complete!');
}

// Run the tester
testEspnApiAuth().catch(console.error);