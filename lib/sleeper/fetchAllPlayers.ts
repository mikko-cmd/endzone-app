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

export async function getPlayerByName(name: string): Promise<Player | null> {
  try {
    const players = await fetchAllPlayers();
    const lowerCaseName = name.toLowerCase();
    for (const playerId in players) {
      const player = players[playerId];
      const fullName = (
        player.full_name || `${player.first_name} ${player.last_name}`
      ).toLowerCase();
      if (fullName === lowerCaseName) {
        return player;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error getting player by name ${name}:`, error);
    return null;
  }
} 