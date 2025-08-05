import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Comprehensive ESPN API data analyzer that handles large files
async function analyzeEspnProjections() {
    console.log('🔍 ESPN API Projection Data Analyzer\n');

    // Create results directory
    const resultsDir = 'espn-api-results';
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir);
    }

    const endpoints = [
        {
            name: 'espn-fantasy-2025-players',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players?view=players_wl',
            description: 'ESPN Fantasy 2025 Players with Weekly Projections'
        },
        {
            name: 'espn-fantasy-2025-players-stats',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players?view=kona_player_info',
            description: 'ESPN Fantasy 2025 Players with Stats'
        },
        {
            name: 'espn-fantasy-2025-projections',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/players?view=projected',
            description: 'ESPN Fantasy 2025 Projected Stats'
        },
        {
            name: 'espn-fantasy-current-players',
            url: 'https://fantasy.espn.com/apis/v3/games/ffl/players?view=players_wl',
            description: 'ESPN Fantasy Current Season Players'
        }
    ];

    for (const endpoint of endpoints) {
        console.log(`\n📡 Testing: ${endpoint.description}`);
        console.log(`🔗 URL: ${endpoint.url}`);

        try {
            const response = await axios.get(endpoint.url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            console.log(`✅ Status: ${response.status}`);

            // Save full response
            const fullFilePath = path.join(resultsDir, `${endpoint.name}-full.json`);
            fs.writeFileSync(fullFilePath, JSON.stringify(response.data, null, 2));
            console.log(`💾 Saved full response: ${fullFilePath}`);

            // Analyze data structure
            const data = response.data;
            const analysis = analyzeDataStructure(data, endpoint.name);

            // Save analysis
            const analysisFilePath = path.join(resultsDir, `${endpoint.name}-analysis.json`);
            fs.writeFileSync(analysisFilePath, JSON.stringify(analysis, null, 2));
            console.log(`📊 Saved analysis: ${analysisFilePath}`);

            // Extract sample players with projections
            if (Array.isArray(data)) {
                const samplesWithProjections = extractProjectionSamples(data);
                if (samplesWithProjections.length > 0) {
                    const sampleFilePath = path.join(resultsDir, `${endpoint.name}-projection-samples.json`);
                    fs.writeFileSync(sampleFilePath, JSON.stringify(samplesWithProjections, null, 2));
                    console.log(`🎯 Saved projection samples: ${sampleFilePath} (${samplesWithProjections.length} players)`);
                }
            }

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log(`\n🎉 Analysis complete! Check the '${resultsDir}' directory for results.`);
}

function analyzeDataStructure(data: any, endpointName: string) {
    const analysis: any = {
        endpoint: endpointName,
        timestamp: new Date().toISOString(),
        dataType: typeof data,
        isArray: Array.isArray(data),
        structure: {}
    };

    if (Array.isArray(data)) {
        analysis.arrayLength = data.length;

        if (data.length > 0) {
            const firstItem = data[0];
            analysis.structure.firstItemKeys = Object.keys(firstItem || {});

            // Look for projection-related keys
            const projectionKeys = findProjectionKeys(firstItem);
            if (projectionKeys.length > 0) {
                analysis.projectionKeys = projectionKeys;
            }

            // Sample a few items to understand variations
            const sampleSize = Math.min(5, data.length);
            analysis.samples = [];

            for (let i = 0; i < sampleSize; i++) {
                const item = data[i];
                const sample: any = {
                    index: i,
                    keys: Object.keys(item || {})
                };

                // Extract player info if available
                if (item?.player) {
                    sample.playerInfo = {
                        id: item.player.id,
                        fullName: item.player.fullName,
                        position: item.player.defaultPositionId
                    };
                }

                // Look for stats/projections
                if (item?.player?.stats) {
                    sample.hasStats = true;
                    sample.statsKeys = Object.keys(item.player.stats);
                }

                analysis.samples.push(sample);
            }
        }
    } else if (typeof data === 'object' && data !== null) {
        analysis.structure.topLevelKeys = Object.keys(data);
    }

    return analysis;
}

function findProjectionKeys(obj: any, path: string = ''): string[] {
    const projectionKeys: string[] = [];

    if (!obj || typeof obj !== 'object') return projectionKeys;

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key suggests projections
        if (key.toLowerCase().includes('projection') ||
            key.toLowerCase().includes('projected') ||
            key.toLowerCase().includes('forecast') ||
            key.toLowerCase().includes('outlook')) {
            projectionKeys.push(currentPath);
        }

        // Recursively search nested objects
        if (typeof value === 'object' && value !== null) {
            projectionKeys.push(...findProjectionKeys(value, currentPath));
        }
    }

    return projectionKeys;
}

function extractProjectionSamples(data: any[]): any[] {
    const samples: any[] = [];

    for (const item of data.slice(0, 10)) { // First 10 items
        if (item?.player) {
            const player = item.player;
            const sample: any = {
                id: player.id,
                fullName: player.fullName,
                position: player.defaultPositionId,
                team: player.proTeamId
            };

            // Extract any projection/stats data
            if (player.stats) {
                sample.stats = player.stats;
            }

            // Look for other projection fields
            const projectionData = extractProjectionData(item);
            if (Object.keys(projectionData).length > 0) {
                sample.projections = projectionData;
            }

            samples.push(sample);
        }
    }

    return samples.filter(sample =>
        sample.stats || sample.projections ||
        Object.keys(sample).some(key =>
            key.toLowerCase().includes('projection') ||
            key.toLowerCase().includes('forecast')
        )
    );
}

function extractProjectionData(obj: any, result: any = {}): any {
    if (!obj || typeof obj !== 'object') return result;

    for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes('projection') ||
            key.toLowerCase().includes('projected') ||
            key.toLowerCase().includes('forecast') ||
            key.toLowerCase().includes('outlook')) {
            result[key] = value;
        }

        if (typeof value === 'object' && value !== null) {
            extractProjectionData(value, result);
        }
    }

    return result;
}

// Run the analyzer
analyzeEspnProjections().catch(console.error);