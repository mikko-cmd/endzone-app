import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const syncRosterSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
  sleeper_username: z.string().nonempty(),
});

// Add timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, timeoutMs: number = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = syncRosterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { sleeper_league_id, user_email, sleeper_username } = validation.data;

    const supabase = createClient();

    const { data: existingLeague, error: fetchError } = await supabase
      .from('leagues')
      .select('id')
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .single();

    if (fetchError || !existingLeague) {
      return NextResponse.json(
        { success: false, error: 'League not found or access denied.' },
        { status: 404 }
      );
    }

    console.log(`[RosterSync] Starting sync for league ${sleeper_league_id}`);
    const startTime = Date.now();

    // Only fetch essential data with timeouts
    const [rostersRes, usersRes] = await Promise.all([
      fetchWithTimeout(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`, 15000),
      fetchWithTimeout(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`, 15000),
    ]);

    if (!rostersRes.ok || !usersRes.ok) {
      console.error('[RosterSync] Failed to fetch essential data from Sleeper');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data from Sleeper.' },
        { status: 502 }
      );
    }

    const [rostersData, usersData] = await Promise.all([
      rostersRes.json(),
      usersRes.json(),
    ]);

    console.log(`[RosterSync] Essential data fetched in ${Date.now() - startTime}ms`);

    // Try to fetch player data and stats, but don't fail if they timeout
    let playersData = {};
    let statsData = {};

    try {
      const [playersRes, statsRes] = await Promise.all([
        fetchWithTimeout(`https://api.sleeper.app/v1/players/nfl`, 20000),
        fetchWithTimeout(`https://api.sleeper.app/v1/stats/nfl/2023/1`, 15000),
      ]);

      if (playersRes.ok && statsRes.ok) {
        [playersData, statsData] = await Promise.all([
          playersRes.json(),
          statsRes.json(),
        ]);
        console.log(`[RosterSync] Additional data fetched in ${Date.now() - startTime}ms`);
      } else {
        console.warn('[RosterSync] Failed to fetch additional data, continuing with basic data');
      }
    } catch (error) {
      console.warn('[RosterSync] Timeout or error fetching additional data, continuing with basic data:', error);
    }

    // Create player map
    const playerMap = new Map<string, any>();
    for (const playerId in playersData) {
      playerMap.set(playerId, playersData[playerId]);
    }

    // Create points map
    const pointsMap = new Map<string, number>();
    if (statsData && typeof statsData === 'object') {
      for (const playerId of Object.keys(statsData)) {
        const playerStats = statsData[playerId];
        if (playerStats?.pts_half_ppr) {
          pointsMap.set(playerId, playerStats.pts_half_ppr);
        }
      }
    }

    const leagueUser = usersData.find(
      (user: any) => user.display_name === sleeper_username
    );
    if (!leagueUser) {
      return NextResponse.json(
        {
          success: false,
          error: `Sleeper user "${sleeper_username}" not found in this league.`,
        },
        { status: 404 }
      );
    }
    const userId = leagueUser.user_id;

    const userRoster = rostersData.find(
      (roster: any) => roster.owner_id === userId
    );
    if (!userRoster) {
      return NextResponse.json(
        { success: false, error: 'Roster not found for this user in the league.' },
        { status: 404 }
      );
    }

    const mapPlayer = (id: string) => {
      const playerDetails = playerMap.get(id);
      return {
        id,
        name:
          playerDetails?.full_name ||
          `${playerDetails?.first_name} ${playerDetails?.last_name}` ||
          'Unknown Player',
        points: pointsMap.get(id) || 0,
        position: playerDetails?.position || 'N/A',
        team: playerDetails?.team || 'N/A',
      };
    };

    const starterIds = userRoster.starters || [];
    const playerIds = userRoster.players || [];

    const starters = starterIds.map(mapPlayer);
    const roster = playerIds.map(mapPlayer);

    const rosterData = {
      username: sleeper_username,
      starters,
      roster,
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from('leagues')
      .update({
        rosters_json: rosterData,
        last_synced_at: new Date().toISOString(),
      })
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update roster data in the database.',
        },
        { status: 500 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[RosterSync] Completed sync for league ${sleeper_league_id} in ${totalTime}ms`);

    return NextResponse.json(
      {
        message: 'Roster sync successful',
        data: updatedRow,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
