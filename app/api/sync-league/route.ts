import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Next.js App Router handles method validation. Only POST requests will reach this function.
  // A request with a different method will automatically receive a 405 response.
  
  try {
    const { leagueId, userEmail } = await request.json();

    if (!leagueId || !userEmail) {
      return NextResponse.json({ success: false, error: 'Missing leagueId or userEmail' }, { status: 400 });
    }

    // Fetch all required data from the Sleeper API in parallel
    const [leagueRes, rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    ]);

    // Validate the API responses
    if (!leagueRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league data from Sleeper.' }, { status: leagueRes.status });
    }
    if (!rostersRes.ok) {
        return NextResponse.json({ success: false, error: 'Failed to fetch rosters data from Sleeper.' }, { status: rostersRes.status });
    }
    if (!usersRes.ok) {
        return NextResponse.json({ success: false, error: 'Failed to fetch users data from Sleeper.' }, { status: usersRes.status });
    }
    
    const leagueData = await leagueRes.json();
    const rostersData = await rostersRes.json();
    const usersData = await usersRes.json();

    // Create a map for quick lookup of user display names by their ID
    const usersMap = new Map(usersData.map((user: any) => [user.user_id, user.display_name]));

    // Merge owner names into the roster data
    const mergedRosters = rostersData.map((roster: any) => ({
      ...roster,
      owner_name: usersMap.get(roster.owner_id) || 'Unknown Owner',
    }));

    // Upsert the data into the Supabase 'leagues' table
    const supabase = createClient();
    const { error } = await supabase
      .from('leagues')
      .upsert({
        id: leagueData.league_id,
        user_email: userEmail,
        league_name: leagueData.name,
        rosters: mergedRosters,
      });

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save league data to the database.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 