import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase with service role key for API routes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🔍 Fetching outlook for player ID: ${playerId}`);

    // Fetch player summary using correct column names
    const { data: player, error } = await supabase
      .from('players')
      .select('summary_2025, name, position, team')
      .eq('sleeper_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      );
    }

    if (!player) {
      console.log(`❌ Player not found for ID: ${playerId}`);
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Return the player's AI-generated summary
    const outlook = player.summary_2025 || 
      `${player.name} summary not yet available. Please run the summary generation script.`;

    console.log(`✅ Successfully fetched outlook for ${player.name}`);

    return NextResponse.json({ 
      success: true, 
      outlook,
      player: {
        name: player.name,
        position: player.position,
        team: player.team
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
