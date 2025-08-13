/*
  SQL for Supabase Table Migration:
  Run these commands in your Supabase SQL editor.

  -- 1. Add the new columns to your 'leagues' table.
  ALTER TABLE leagues ADD COLUMN league_name TEXT;
  ALTER TABLE leagues ADD COLUMN last_synced_at TIMESTAMPTZ;

  -- 2. Make sure the 'id' column (storing sleeper_league_id) is the primary key.
  --    If not, you might need to run:
  --    ALTER TABLE leagues ADD PRIMARY KEY (id);

  -- 3. Backfill the user_email for existing rows if necessary.
  --    Replace 'example_user_email@domain.com' with the actual user's email.
  --    UPDATE leagues SET user_email = 'example_user_email@domain.com' WHERE user_email IS NULL;
*/
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Updated Zod schema - removed user_email since we'll get it from auth
const syncLeagueSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  sleeper_username: z.string().nonempty(),
});

export async function POST(request: Request) {
  try {
    // 1. Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate request body
    const body = await request.json();
    console.log('Incoming request to /api/sync-league:', body);

    const validation = syncLeagueSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }
    const { sleeper_league_id, sleeper_username } = validation.data;

    // 3. Fetch league metadata from Sleeper API
    console.log(`Fetching league data for ID: ${sleeper_league_id}`);
    const sleeperRes = await fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}`);

    if (!sleeperRes.ok) {
      const errorData = await sleeperRes.json();
      console.error('Failed to fetch league data from Sleeper:', errorData);
      return NextResponse.json({ success: false, error: 'Failed to fetch league data from Sleeper.' }, { status: sleeperRes.status });
    }
    const sleeperLeagueData = await sleeperRes.json();
    console.log('Successfully fetched league data:', sleeperLeagueData);

    // 4. UPSERT data into Supabase with all required columns
    const leagueDataToUpsert = {
      sleeper_league_id,
      user_email: user.email!,
      sleeper_username,
      league_name: sleeperLeagueData.name,
      platform: 'Sleeper', // Set platform for Sleeper leagues
      is_manual: false, // Sleeper leagues are not manual
      last_synced_at: new Date().toISOString(),
    };

    // Log the object being upserted
    console.log("Upserting league row:", leagueDataToUpsert);

    // Use sleeper_league_id as primary conflict resolution
    const { data: upsertedData, error: upsertError } = await supabase
      .from('leagues')
      .upsert(leagueDataToUpsert, {
        onConflict: 'sleeper_league_id', // Use single column for conflict resolution
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return NextResponse.json({ success: false, error: 'Failed to save league data to the database.' }, { status: 500 });
    }

    console.log('Supabase upsert successful:', upsertedData);

    // 5. Automatically sync roster data
    console.log('Automatically syncing roster data...');
    try {
      const rosterSyncResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/rosters/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_league_id,
          user_email: user.email!,
          sleeper_username,
        }),
      });

      if (rosterSyncResponse.ok) {
        const rosterResult = await rosterSyncResponse.json();
        console.log('Roster sync successful:', rosterResult);
      } else {
        console.warn('Roster sync failed, but league sync succeeded');
      }
    } catch (rosterError: any) {
      console.warn('Failed to sync roster automatically:', rosterError.message);
      // Don't fail the entire operation if roster sync fails
    }

    // 6. Return the upserted row
    return NextResponse.json({ success: true, data: upsertedData });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 