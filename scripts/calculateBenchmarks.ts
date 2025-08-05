import { nflverseData } from '@/lib/nflverseData';

async function calculatePositionBenchmarks() {
  console.log('📊 Calculating 2024 NFL performance benchmarks...');
  
  // Get all 2024 game logs for active players
  const allPlayerStats = await nflverseData.fetchSeasonStats(2024);
  
  // Group by position
  const statsByPosition = groupBy(allPlayerStats, 'position');
  
  // Calculate percentiles for each position
  for (const [position, players] of Object.entries(statsByPosition)) {
    const benchmarks = calculatePercentiles(players);
    console.log(`${position} Benchmarks:`, benchmarks);
  }
}

function calculatePercentiles(playerStats: any[]): any {
  const stats = ['passing_yards', 'passing_tds', 'rushing_yards', /* etc */];
  const benchmarks: any = {};
  
  for (const stat of stats) {
    const values = playerStats
      .map(p => p[stat] || 0)
      .filter(v => v !== null)
      .sort((a, b) => a - b);
    
    benchmarks[stat] = [
      percentile(values, 25),  // 25th percentile
      percentile(values, 50),  // 50th percentile (median)
      percentile(values, 75)   // 75th percentile
    ];
  }
  
  return benchmarks;
} 