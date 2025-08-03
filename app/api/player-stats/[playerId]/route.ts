import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    const supabase = createClient();
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('week', { ascending: false });

    if (error) {
      console.error('Supabase error fetching player stats:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch player stats.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
