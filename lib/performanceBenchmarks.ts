interface PositionBenchmarks {
  position: string;
  games_minimum: number;
  benchmarks: {
    // Percentiles (25th, 50th, 75th)
    passing_yards: [number, number, number];
    passing_tds: [number, number, number];
    passing_attempts: [number, number, number];
    completions: [number, number, number];
    interceptions: [number, number, number];
    rushing_yards: [number, number, number];
    rushing_tds: [number, number, number];
    carries: [number, number, number];
    receptions: [number, number, number];
    receiving_yards: [number, number, number];
    receiving_tds: [number, number, number];
    targets: [number, number, number];
    fantasy_points: [number, number, number];
    sacks: [number, number, number];
    fumbles: [number, number, number];
  };
}

// Example QB benchmarks (calculated from 2024 data)
const QB_BENCHMARKS: PositionBenchmarks = {
  position: 'QB',
  games_minimum: 8, // Must have played at least 8 games
  benchmarks: {
    passing_yards: [180, 235, 285],     // 25th, 50th, 75th percentile
    passing_tds: [0, 1, 2],
    passing_attempts: [25, 32, 38],
    completions: [16, 21, 26],
    interceptions: [0, 0, 1],           // Lower is better
    rushing_yards: [2, 8, 18],
    rushing_tds: [0, 0, 0],
    carries: [0, 1, 2],                 // QBs occasionally carry
    receptions: [0, 0, 0],              // QBs don't receive
    receiving_yards: [0, 0, 0],         // QBs don't receive
    receiving_tds: [0, 0, 0],           // QBs don't receive
    targets: [0, 0, 0],                 // QBs don't get targeted
    fantasy_points: [12, 18, 24],
    sacks: [0, 1, 2],                   // Lower is better
    fumbles: [0, 0, 0],                 // Lower is better
  }
}; 