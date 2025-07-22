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

    // 2. Fetch current NFL week
    const nflStateRes = await fetch('https://api.sleeper.app/v1/state/nfl');
    if (!nflStateRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch NFL state from Sleeper.' }, { status: 502 });
    }
    const nflState = await nflStateRes.json();
    const week = nflState.week;
    console.log(`Current NFL week: ${week}`);

    // 3. Fetch matchups, users, and rosters from Sleeper API
    const [matchupsRes, usersRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/matchups/${week}`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`),
    ]);

    if (!matchupsRes.ok || !usersRes.ok || !rostersRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league data from Sleeper.' }, { status: 502 });
    }

    const matchupsData: any[] = await matchupsRes.json();
    const usersData: any[] = await usersRes.json();
    const rostersData: any[] = await rostersRes.json();
    
    // 4. Process and combine data
    const usersMap = new Map(usersData.map(user => [user.user_id, user.display_name]));
    const rosterIdToOwnerIdMap = new Map(rostersData.map(roster => [roster.roster_id, roster.owner_id]));
    
    // Create a map of matchup_id to a list of teams in that matchup
    const matchupsByGroup = new Map<number, any[]>();
    matchupsData.forEach(m => {
        if (!matchupsByGroup.has(m.matchup_id)) {
            matchupsByGroup.set(m.matchup_id, []);
        }
        matchupsByGroup.get(m.matchup_id)!.push(m);
    });

    const matchups_json = matchupsData.map(matchup => {
        const ownerId = rosterIdToOwnerIdMap.get(matchup.roster_id);
        const teamName = usersMap.get(ownerId) || 'Unknown Team';

        const opponentMatchup = matchupsByGroup.get(matchup.matchup_id)?.find(m => m.roster_id !== matchup.roster_id);
        const opponentOwnerId = opponentMatchup ? rosterIdToOwnerIdMap.get(opponentMatchup.roster_id) : null;
        const opponentName = opponentOwnerId ? usersMap.get(opponentOwnerId) : 'No Opponent';

        return {
            week: week,
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