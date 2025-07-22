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

// Zod schema for request body validation
const syncLeagueSchema = z.object({
  sleeper_league_id: z.string().nonempty(),
  user_email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    // 1. Validate request body
    const body = await request.json();
    console.log('Incoming request to /api/sync-league:', body);

    const validation = syncLeagueSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }
    const { sleeper_league_id, user_email } = validation.data;

    // 2. Fetch league metadata from Sleeper API
    console.log(`Fetching league data for ID: ${sleeper_league_id}`);
    const sleeperRes = await fetch(`https://api.sleeper.app/v1/league/${sleeper_league_id}`);

    if (!sleeperRes.ok) {
      const errorData = await sleeperRes.json();
      console.error('Failed to fetch league data from Sleeper:', errorData);
      return NextResponse.json({ success: false, error: 'Failed to fetch league data from Sleeper.' }, { status: sleeperRes.status });
    }
    const sleeperLeagueData = await sleeperRes.json();
    console.log('Successfully fetched league data:', sleeperLeagueData);

    // 3. UPSERT data into Supabase
    const supabase = createClient();
    const leagueDataToUpsert = {
      sleeper_league_id,
      user_email,
      league_name: sleeperLeagueData.name,
      last_synced_at: new Date().toISOString(),
    };

    // Log the object being upserted, as requested
    console.log("Upserting league row:", leagueDataToUpsert);

    const { data: upsertedData, error: upsertError } = await supabase
      .from('leagues')
      .upsert(leagueDataToUpsert, {
        onConflict: 'sleeper_league_id', // Use the new unique column to resolve conflicts
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return NextResponse.json({ success: false, error: 'Failed to save league data to the database.' }, { status: 500 });
    }

    console.log('Supabase upsert successful:', upsertedData);

    // 4. Return the upserted row
    return NextResponse.json({ success: true, data: upsertedData });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 