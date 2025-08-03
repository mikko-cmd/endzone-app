// This interface defines the flattened structure for our stats object.
export interface PlayerStats {
  [key: string]: string | number;
}

// This helper function takes the complex, nested stats object from the API
// and flattens it into a simple key-value pair object suitable for display.
// It also creates more readable names for each stat.
function flattenStats(stats: any): PlayerStats {
  const flattened: PlayerStats = {};
  if (!stats) return flattened;

  // A mapping to make stat keys more user-friendly.
  const friendlyNames: { [key: string]: string } = {
    passAttempts: 'Pass Attempts',
    passTD: 'Passing TDs',
    passYds: 'Passing Yards',
    int: 'Interceptions',
    passCompletions: 'Pass Completions',
    receptions: 'Receptions',
    recTD: 'Receiving TDs',
    targets: 'Targets',
    recYds: 'Receiving Yards',
    fumblesLost: 'Fumbles Lost',
    fumbles: 'Fumbles',
    rushTD: 'Rushing TDs',
    rushYards: 'Rushing Yards',
    carries: 'Carries',
  };

  if (stats.gamesPlayed) {
    flattened['Games Played'] = stats.gamesPlayed;
  }

  // Iterate through categories like 'Passing', 'Receiving', etc.
  for (const category in stats) {
    if (typeof stats[category] === 'object' && stats[category] !== null) {
      for (const statKey in stats[category]) {
        const value = stats[category][statKey];
        // Only include stats with a non-zero value to keep the UI clean.
        if (parseFloat(value) !== 0) {
          flattened[friendlyNames[statKey] || statKey] = value;
        }
      }
    }
  }

  return flattened;
}

// This is the main exported function to be used on the player page.
export async function getPlayerStatsByName(
  name: string,
  apiKey: string | undefined,
  apiHost: string | undefined,
): Promise<PlayerStats | null> {
  if (!apiKey || !apiHost) {
    console.error(
      '[RapidAPI] Credentials were not provided to getPlayerStatsByName function.',
    );
    return null;
  }

  // We now use the player's full name directly in the query.
  const params = new URLSearchParams({
    playerName: name,
    getStats: 'true',
  });

  const url = `https://${apiHost}/getNFLPlayerInfo?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('RapidAPI Error:', errorData);
      return null;
    }

    const data = await response.json();

    if (data.body && Array.isArray(data.body) && data.body.length > 0) {
      // The API may return multiple players for an ambiguous name. We find the
      // best match by comparing the full name.
      const player = data.body.find(
        (p: any) => p.longName?.toLowerCase() === name.toLowerCase(),
      );

      // If we find an exact match, we use it; otherwise, we default to the first result.
      const targetPlayer = player || data.body[0];

      if (targetPlayer && targetPlayer.stats) {
        return flattenStats(targetPlayer.stats);
      }
    }
    return null; // No player or stats were found.
  } catch (error) {
    console.error(`Error fetching player stats for ${name}:`, error);
    return null;
  }
} 