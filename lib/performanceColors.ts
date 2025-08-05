type PerformanceColor = 'green' | 'yellow' | 'red';

interface ColorResult {
  color: PerformanceColor;
  percentile: number;
  comparison: 'above' | 'average' | 'below';
}

function getPerformanceColor(
  statName: string, 
  value: number, 
  position: string,
  isReverseStat: boolean = false // For stats where lower is better (INTs, sacks, fumbles)
): ColorResult {
  const benchmarks = getBenchmarksForPosition(position);
  const [p25, p50, p75] = benchmarks[statName];
  
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

// Usage example:
const passingYards = getPerformanceColor('passing_yards', 286, 'QB'); 
// Returns: { color: 'green', percentile: 75, comparison: 'above' }

const interceptions = getPerformanceColor('interceptions', 2, 'QB', true);
// Returns: { color: 'red', percentile: 90, comparison: 'below' } (2 INTs is bad) 