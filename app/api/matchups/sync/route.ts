import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const syncMatchupsSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    // 1. Validate request body
    const body = await request.json();
    console.log('Incoming request to /api/matchups/sync:', body);

    const validation = syncMatchupsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }
    const { sleeper_league_id, user_email } = validation.data;

    const supabase = createClient();

    // Authorize the request by ensuring the league exists for the user
    const { data: existingLeague, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .single();

    if (leagueError || !existingLeague) {
      return NextResponse.json({ success: false, error: 'League not found or access denied.' }, { status: 404 });
    }

    const WEEKS_TO_FETCH = 18;
    const weekPromises = [];
    for (let week = 1; week <= WEEKS_TO_FETCH; week++) {
      weekPromises.push(fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/matchups/${week}`));
    }

    // 3. Fetch matchups, users, and rosters from Sleeper API
    const [usersRes, rostersRes, ...matchupsResponses] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`),
      ...weekPromises,
    ]);

    const successfulMatchupResponses = matchupsResponses.filter(res => res.ok);

    if (!usersRes.ok || !rostersRes.ok || successfulMatchupResponses.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league data from Sleeper.' }, { status: 502 });
    }

    const usersData: any[] = await usersRes.json();
    const rostersData: any[] = await rostersRes.json();
    const weeklyMatchupsData = await Promise.all(successfulMatchupResponses.map(res => res.json()));
    const matchupsData: any[] = weeklyMatchupsData.flat();

    // 4. Process and combine data
    const usersMap = new Map(usersData.map(user => [user.user_id, user.display_name]));
    const rosterIdToOwnerIdMap = new Map(rostersData.map(roster => [roster.roster_id, roster.owner_id]));

    // Create a map of matchup_id to a list of teams in that matchup
    const matchupsByGroup = new Map<string, any[]>();
    matchupsData.forEach(m => {
      const matchupKey = `${m.week}-${m.matchup_id}`;
      if (!matchupsByGroup.has(matchupKey)) {
        matchupsByGroup.set(matchupKey, []);
      }
      matchupsByGroup.get(matchupKey)!.push(m);
    });

    const matchups_json = matchupsData.map(matchup => {
      const ownerId = rosterIdToOwnerIdMap.get(matchup.roster_id);
      const teamName = usersMap.get(ownerId) || 'Unknown Team';

      const matchupKey = `${matchup.week}-${matchup.matchup_id}`;
      const opponentMatchup = matchupsByGroup.get(matchupKey)?.find(m => m.roster_id !== matchup.roster_id);
      const opponentOwnerId = opponentMatchup ? rosterIdToOwnerIdMap.get(opponentMatchup.roster_id) : null;
      const opponentName = opponentOwnerId ? usersMap.get(opponentOwnerId) : 'No Opponent';

      return {
        week: matchup.week,
        matchup_id: matchup.matchup_id,
        team: teamName,
        opponent: opponentName,
        starters: matchup.starters,
        points: matchup.points,
      };
    });

    // 5. Upsert into Supabase
    const { data: updatedRow, error: updateError } = await supabase
      .from('leagues')
      .update({
        matchups_json,
        last_synced_matchups_at: new Date().toISOString(),
      })
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to save matchups data.' }, { status: 500 });
    }

    // 6. Return success response
    return NextResponse.json({
      message: "Matchup sync successful",
      data: updatedRow,
    });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 