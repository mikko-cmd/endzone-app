import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const syncRosterSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = syncRosterSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
    const { sleeper_league_id, user_email } = validation.data;

    const supabase = createClient();

    // First, ensure the league exists and belongs to the user.
    const { data: existingLeague, error: fetchError } = await supabase
      .from('leagues')
      .select('id')
      .eq('id', sleeper_league_id)
      .eq('user_email', user_email)
      .single();

    if (fetchError || !existingLeague) {
      return NextResponse.json({ success: false, error: 'League not found or access denied.' }, { status: 404 });
    }
    
    // 1. Fetch roster and user data from the Sleeper API in parallel.
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}/users`),
    ]);

    if (!rostersRes.ok || !usersRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch data from Sleeper.' }, { status: 502 });
    }
    
    const rostersData = await rostersRes.json();
    const usersData = await usersRes.json();

    // 2. Combine datasets: Attach usernames to each roster.
    //    This creates the 'rosters_json' object you described.
    const usersMap = new Map(usersData.map((user: any) => [user.user_id, user.display_name]));
    const mergedRosters = rostersData.map((roster: any) => ({
      ...roster,
      owner_name: usersMap.get(roster.owner_id) || 'Unknown Owner',
    }));

    // 3. Update the existing league record in Supabase with the new data.
    //    I'm using `update` here since we've already confirmed the league exists.
    const { data: updatedLeague, error: updateError } = await supabase
      .from('leagues')
      .update({
        rosters: mergedRosters, // Storing the combined data in the 'rosters' column.
        last_synced_at: new Date().toISOString(), // Updating the timestamp.
      })
      .eq('id', sleeper_league_id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update roster data.' }, { status: 500 });
    }

    // 4. Return the updated league data.
    return NextResponse.json({ success: true, data: updatedLeague });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
} 