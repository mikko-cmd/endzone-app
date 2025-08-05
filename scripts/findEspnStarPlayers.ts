import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

// Try to find actual NFL star players with projection data
async function findEspnStarPlayers() {
    console.log('🔍 Searching for ESPN NFL Star Players with Projection Data\n');

    // Try different approaches to find real players
    const searchApproaches = [
        {
            name: 'Team Rosters',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/teams/22/athletes',
            description: 'Philadelphia Eagles roster (team 22)'
        },
        {
            name: 'Team Rosters 2',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/teams/14/athletes',
            description: 'Green Bay Packers roster (team 14)'
        },
        {
            name: 'Athletes with limit',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?limit=100',
            description: 'More athletes with larger limit'
        },
        {
            name: 'Current season athletes',
            url: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/athletes?limit=100',
            description: '2024 season athletes'
        }
    ];

    for (const approach of searchApproaches) {
        console.log(`📡 Trying: ${approach.description}`);
        console.log(`🔗 URL: ${approach.url}`);

        try {
            const response = await axios.get(approach.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.espn.com/'
                }
            });

            if (response.status === 200) {
                const data = response.data;

                // Save response
                const filename = `espn-${approach.name.toLowerCase().replace(/\s+/g, '-')}.json`;
                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                console.log(`✅ Saved: ${filename} (${JSON.stringify(data).length} chars)`);

                // Analyze the data
                if (data.items && Array.isArray(data.items)) {
                    console.log(`👥 Found ${data.items.length} items`);

                    // Test first few items to get individual player data
                    for (let i = 0; i < Math.min(3, data.items.length); i++) {
                        const item = data.items[i];
                        if (item.$ref) {
                            console.log(`\n  🏈 Testing player ${i + 1}: ${item.$ref}`);

                            try {
                                const playerResponse = await axios.get(item.$ref, {
                                    timeout: 10000,
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                        'Accept': 'application/json',
                                        'Referer': 'https://www.espn.com/'
                                    }
                                });

                                const playerData = playerResponse.data;
                                const name = playerData.displayName || playerData.fullName || 'Unknown';
                                const position = playerData.position?.displayName || playerData.position?.name || 'Unknown';

                                console.log(`    Name: ${name}`);
                                console.log(`    Position: ${position}`);

                                // Check for skill positions (QB, RB, WR, TE)
                                const skillPositions = ['Quarterback', 'Running Back', 'Wide Receiver', 'Tight End', 'QB', 'RB', 'WR', 'TE'];
                                const isSkillPosition = skillPositions.some(pos =>
                                    position.toLowerCase().includes(pos.toLowerCase())
                                );

                                if (isSkillPosition) {
                                    console.log(`    🎯 SKILL POSITION FOUND! Saving detailed data...`);

                                    const skillPlayerFile = `espn-skill-player-${name.replace(/\s+/g, '-').toLowerCase()}.json`;
                                    fs.writeFileSync(skillPlayerFile, JSON.stringify(playerData, null, 2));
                                    console.log(`    💾 Saved skill player: ${skillPlayerFile}`);

                                    // Look for stats/projections in this player
                                    const statRefs = Object.keys(playerData).filter(key =>
                                        playerData[key]?.$ref && (
                                            playerData[key].$ref.includes('stat') ||
                                            playerData[key].$ref.includes('projection') ||
                                            playerData[key].$ref.includes('season')
                                        )
                                    );

                                    if (statRefs.length > 0) {
                                        console.log(`    📈 Stat references found: ${statRefs.join(', ')}`);
                                    }
                                }

                            } catch (playerError: any) {
                                console.log(`    ❌ Player error: ${playerError.message}`);
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('🎉 ESPN star player search complete!');
}

// Run the search
findEspnStarPlayers().catch(console.error);