interface Player {
  player_id: string;
  full_name?: string;
  first_name: string;
  last_name: string;
  team: string | null;
  position: string | null;
  number: number | null;
}

interface Players {
  [playerId: string]: Player;
}

let playersCache: Players | null = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

async function fetchAllPlayers(): Promise<Players> {
  const now = Date.now();
  if (playersCache && now - lastFetchTimestamp < CACHE_DURATION) {
    return playersCache;
  }

  try {
    const sleeperBaseUrl =
      process.env.NEXT_PUBLIC_SLEEPER_BASE || 'https://api.sleeper.app/v1';
    const res = await fetch(`${sleeperBaseUrl}/players/nfl`, {
      cache: 'no-store', // Add this to prevent Next.js caching error for large files
    });
    if (!res.ok) {
      throw new Error('Failed to fetch players from Sleeper API');
    }
    const players: Players = await res.json();
    playersCache = players;
    lastFetchTimestamp = now;
    return players;
  } catch (error) {
    console.error('Error fetching all players:', error);
    if (playersCache) {
      return playersCache;
    }
    throw error;
  }
}

export async function getPlayerById(playerId: string): Promise<Player | null> {
  try {
    const players = await fetchAllPlayers();
    return players[playerId] || null;
  } catch (error) {
    console.error(`Error getting player by ID ${playerId}:`, error);
    return null;
  }
}

// Helper function to normalize names for better matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '') // Remove apostrophes and similar characters
    .replace(/[.-]/g, ' ') // Replace dots and dashes with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '') // Remove common suffixes
    .trim();
}

// Simple Levenshtein distance function for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  // Create matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Helper function to check if two normalized names are similar
function isSimilarName(name1: string, name2: string): boolean {
  // If they're exactly the same, they're similar
  if (name1 === name2) return true;

  // Split into words and check if all words from the shorter name are in the longer name
  const words1 = name1.split(' ').filter(word => word.length > 0);
  const words2 = name2.split(' ').filter(word => word.length > 0);

  // Check if all words from the input name are present in the player name
  const allWordsMatch = words1.every(word1 =>
    words2.some(word2 =>
      word2.includes(word1) || word1.includes(word2) ||
      levenshteinDistance(word1, word2) <= 1
    )
  );

  return allWordsMatch;
}

export async function getPlayerByName(name: string): Promise<Player | null> {
  try {
    const players = await fetchAllPlayers();

    // Normalize the input name
    const normalizedInputName = normalizeName(name);

    // First try exact match
    for (const playerId in players) {
      const player = players[playerId];
      const fullName = player.full_name || `${player.first_name} ${player.last_name}`;
      const normalizedFullName = normalizeName(fullName);

      if (normalizedFullName === normalizedInputName) {
        return player;
      }
    }

    // If exact match fails, try fuzzy matching
    for (const playerId in players) {
      const player = players[playerId];
      const fullName = player.full_name || `${player.first_name} ${player.last_name}`;
      const normalizedFullName = normalizeName(fullName);

      // Check if the normalized names are similar (allowing for small differences)
      if (isSimilarName(normalizedInputName, normalizedFullName)) {
        return player;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting player by name ${name}:`, error);
    return null;
  }
} 