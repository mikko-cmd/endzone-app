import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema to validate the incoming request body
const syncRosterSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
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
    const { sleeper_league_id, user_email } = validation.data;

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

    // 2 & 3. Fetch roster and user data from the Sleeper API
    console.log(`Fetching rosters and users for league ID: ${sleeper_league_id}`);
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`),
    ]);

    if (!rostersRes.ok || !usersRes.ok) {
      console.error('Failed to fetch data from Sleeper.');
      return NextResponse.json({ success: false, error: 'Failed to fetch roster or user data from Sleeper.' }, { status: 502 });
    }

    const rostersData = await rostersRes.json();
    const usersData = await usersRes.json();

    // 4. Match owner_id to usernames and build the teams array
    const usersMap = new Map(usersData.map((user: any) => [user.user_id, user.display_name]));
    const teams = rostersData.map((roster: any) => ({
      owner: usersMap.get(roster.owner_id) || 'Unknown Owner',
      starters: roster.starters || [],
      players: roster.players || [],
    }));

    // 5. Create the rosters_json object
    const rosters_json = {
      teams: teams,
    };

    // 6. Upsert the new data into the Supabase leagues table
    const { data: updatedRow, error: updateError } = await supabase
      .from('leagues')
      .update({
        rosters: rosters_json, // Using 'rosters' column as per schema
        last_synced_at: new Date().toISOString(),
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