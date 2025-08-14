type PerformanceColor = 'green' | 'yellow' | 'red';

interface ColorResult {
    color: PerformanceColor;
    percentile: number;
    comparison: 'above' | 'average' | 'below';
}

// Simple benchmarks - we'll improve these later with real data
const POSITION_BENCHMARKS: Record<string, Record<string, [number, number, number]>> = {
    'QB': {
        passing_yards: [200, 250, 300],    // More realistic: 200-250-300
        passing_tds: [0, 1, 3],            // 0-1-3 TDs per game
        interceptions: [0, 1, 2],          // 0-1-2 INTs (higher = worse)
        rushing_yards: [5, 15, 35],        // 5-15-35 rushing yards
        rushing_tds: [0, 0, 1],            // 0-0-1 rushing TDs
        fantasy_points: [15, 22, 28],      // 15-22-28 fantasy points
        attempts: [28, 35, 42],            // 28-35-42 attempts
        completions: [18, 24, 30],         // 18-24-30 completions
        carries: [3, 6, 12],               // 3-6-12 carries
        sacks: [0, 2, 4],                  // 0-2-4 sacks taken
        fumbles: [0, 0, 1],                // 0-0-1 fumbles
    },
    'RB': {
        rushing_yards: [40, 80, 120],      // 40-80-120 rushing yards
        rushing_tds: [0, 1, 2],            // 0-1-2 rushing TDs
        carries: [10, 18, 25],             // 10-18-25 carries
        receptions: [1, 3, 4],             // 1-3-4 receptions (RB-specific: 4+ is green, 3 is yellow, 1-2 is red)
        receiving_yards: [10, 20, 30],     // 10-20-30 receiving yards (RB-specific: 30+ is green, 10-29 is yellow, <10 is red)
        receiving_tds: [0, 0, 1],          // 0-0-1 receiving TDs (unchanged)
        targets: [2, 3, 5],                // 2-3-5 targets (RB-specific: 5+ is green, 3-4 is yellow, 1-2 is red)
        fantasy_points: [8, 15, 22],       // 8-15-22 fantasy points
        fumbles: [0, 0, 1],                // 0-0-1 fumbles
        yards_per_carry: [3.5, 4.5, 5.5], // 3.5-4.5-5.5 yards per carry
        yards_per_target: [8, 12, 16],     // 8-12-16 yards per target
        yards_per_catch: [10, 14, 18],     // 10-14-18 yards per catch
    },
    'WR': {
        receptions: [3, 6, 9],             // 3-6-9 receptions
        receiving_yards: [40, 75, 110],    // 40-75-110 receiving yards
        receiving_tds: [0, 1, 2],          // 0-1-2 receiving TDs
        targets: [5, 9, 13],               // 5-9-13 targets
        fantasy_points: [6, 12, 18],       // 6-12-18 fantasy points
        fumbles: [0, 0, 0],                // 0-0-0 fumbles
        yards_per_target: [8, 12, 16],     // 8-12-16 yards per target
        yards_per_catch: [12, 16, 20],     // 12-16-20 yards per catch
    },
    'TE': {
        receptions: [2, 5, 8],             // 2-5-8 receptions
        receiving_yards: [25, 55, 85],     // 25-55-85 receiving yards
        receiving_tds: [0, 1, 2],          // 0-1-2 receiving TDs
        targets: [4, 7, 11],               // 4-7-11 targets
        fantasy_points: [4, 10, 16],       // 4-10-16 fantasy points
        fumbles: [0, 0, 0],                // 0-0-0 fumbles
        yards_per_target: [7, 11, 15],     // 7-11-15 yards per target
        yards_per_catch: [10, 14, 18],     // 10-14-18 yards per catch
    }
};

function getBenchmarksForPosition(position: string): Record<string, [number, number, number]> {
    return POSITION_BENCHMARKS[position] || POSITION_BENCHMARKS['WR'];
}

function getPerformanceColor(
    statName: string,
    value: number,
    position: string,
    isReverseStat: boolean = false
): ColorResult {
    const benchmarks = getBenchmarksForPosition(position);
    const statBenchmarks = benchmarks[statName];

    if (!statBenchmarks) {
        return { color: 'yellow', percentile: 50, comparison: 'average' };
    }

    const [p25, p50, p75] = statBenchmarks;

    let percentile: number;
    let color: PerformanceColor;

    if (value <= p25) {
        percentile = 25;
        color = isReverseStat ? 'green' : 'red';
    } else if (value <= p50) {
        percentile = 50;
        color = 'yellow';
    } else if (value <= p75) {
        percentile = 75;
        color = isReverseStat ? 'yellow' : 'green';
    } else {
        percentile = 90;
        color = isReverseStat ? 'red' : 'green';
    }

    return {
        color,
        percentile,
        comparison: percentile >= 75 ? 'above' : (percentile >= 25 ? 'average' : 'below')
    };
}

// UI Helper function for CSS classes
export function getStatStyle(statName: string, value: number, position: string): React.CSSProperties {
    console.log(`🎨 Style check: ${statName}=${value} for ${position}`);

    if (value === null || value === undefined || value < 0) {
        return {};
    }

    const reverseStats = ['interceptions', 'sacks', 'fumbles', 'fumbles_lost'];
    const isReverseStat = reverseStats.includes(statName);

    const result = getPerformanceColor(statName, value, position, isReverseStat);
    console.log(`🎨 ${statName}=${value} → ${result.color}`);

    switch (result.color) {
        case 'green':
            return {
                backgroundColor: 'rgba(34, 197, 94, 0.15)',  // Subtle green background
                color: 'white',                              // White text
                border: '1px solid rgba(34, 197, 94, 0.3)'   // Subtle green border
            };
        case 'yellow':
            return {
                backgroundColor: 'rgba(245, 158, 11, 0.15)', // Subtle yellow background
                color: 'white',                              // White text
                border: '1px solid rgba(245, 158, 11, 0.3)'  // Subtle yellow border
            };
        case 'red':
            return {
                backgroundColor: 'rgba(239, 68, 68, 0.15)',  // Subtle red background
                color: 'white',                              // White text
                border: '1px solid rgba(239, 68, 68, 0.3)'   // Subtle red border
            };
        default:
            return {};
    }
}

// Replace lines 135-137 and complete the function:
export function getStatColorClass(statName: string, value: number, position: string): string {
    // Debug logging
    console.log(`🎨 Color check: ${statName}=${value} for ${position}`);

    if (value === null || value === undefined) {
        console.log(`⚠️ No color: value is null/undefined`);
        return '';
    }

    if (value < 0) {
        console.log(`⚠️ No color: negative value`);
        return '';
    }

    // Determine if this is a "reverse" stat (lower is better)
    const reverseStats = ['interceptions', 'sacks', 'fumbles', 'fumbles_lost'];
    const isReverseStat = reverseStats.includes(statName);

    const result = getPerformanceColor(statName, value, position, isReverseStat);
    console.log(`🎨 ${statName}=${value} → ${result.color}`);

    // Return CSS classes (backup method)
    switch (result.color) {
        case 'green':
            return 'bg-green-900/20 text-green-300 border border-green-500/30';
        case 'yellow':
            return 'bg-yellow-900/20 text-yellow-300 border border-yellow-500/30';
        case 'red':
            return 'bg-red-900/20 text-red-300 border border-red-500/30';
        default:
            return '';
    }
}

export { getPerformanceColor, type ColorResult, type PerformanceColor };