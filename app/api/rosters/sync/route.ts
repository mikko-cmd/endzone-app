import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema to validate the incoming request body
const syncRosterSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
  sleeper_username: z.string().nonempty(), // Added sleeper_username
});

export async function POST(request: Request) {
  try {
    // 1. Validate request body
    const body = await request.json();
    const validation = syncRosterSchema.safeParse(body);

    if (!validation.success) {
      console.error('Invalid request body:', validation.error.flatten());
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
    const { sleeper_league_id, user_email, sleeper_username } = validation.data;

    const supabase = createClient();

    // First, ensure the league exists and belongs to the user.
    const { data: existingLeague, error: fetchError } = await supabase
      .from('leagues')
      .select('id')
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .single();

    if (fetchError || !existingLeague) {
      console.error('League not found or access denied:', fetchError);
      return NextResponse.json({ success: false, error: 'League not found or access denied.' }, { status: 404 });
    }

    // Fetch player, roster, and user data from the Sleeper API
    console.log(`Fetching data for league ID: ${sleeper_league_id}`);
    const [playersRes, rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/players/nfl`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`),
    ]);

    if (!playersRes.ok || !rostersRes.ok || !usersRes.ok) {
      console.error('Failed to fetch data from Sleeper.');
      return NextResponse.json({ success: false, error: 'Failed to fetch data from Sleeper.' }, { status: 502 });
    }

    const playersData = await playersRes.json();
    const rostersData = await rostersRes.json();
    const usersData = await usersRes.json();

    // Create a player map for efficient lookup
    const playerMap = new Map<string, string>();
    for (const playerId in playersData) {
      const player = playersData[playerId];
      playerMap.set(playerId, `${player.first_name} ${player.last_name}`);
    }

    // Find the user's ID from their username
    const leagueUser = usersData.find((user: any) => user.display_name === sleeper_username);
    if (!leagueUser) {
        return NextResponse.json({ success: false, error: `Sleeper user "${sleeper_username}" not found in this league.` }, { status: 404 });
    }
    const userId = leagueUser.user_id;

    // Find the user's specific roster
    const userRoster = rostersData.find((roster: any) => roster.owner_id === userId);
    if (!userRoster) {
        return NextResponse.json({ success: false, error: 'Roster not found for this user in the league.' }, { status: 404 });
    }
    
    // Map player IDs to full names
    const starters = userRoster.starters ? userRoster.starters.map((id: string) => playerMap.get(id) || 'Unknown Player') : [];
    const roster = userRoster.players ? userRoster.players.map((id: string) => playerMap.get(id) || 'Unknown Player') : [];

    // Create the final JSON object for this user
    const rosters_json = {
      username: sleeper_username,
      starters,
      roster,
    };

    // Upsert this into the Supabase leagues table
    const { data: updatedRow, error: updateError } = await supabase
      .from('leagues')
      .update({
        rosters_json: rosters_json,
        last_synced_at: new Date().toISOString(),
        sleeper_username: sleeper_username, // Save the username
      })
      .eq('sleeper_league_id', sleeper_league_id)
      .eq('user_email', user_email)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update roster data in the database.' }, { status: 500 });
    }

    // 7. Return a success response with the updated row
    return NextResponse.json({
      message: "Roster sync successful",
      data: updatedRow
    }, { status: 200 });

  } catch (e: any) {
    // 8. Handle any other errors gracefully
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 