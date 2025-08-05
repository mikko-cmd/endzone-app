import { NextResponse } from 'next/server';
import { nflverseData } from '@/lib/nflverseData';

export async function GET() {
  try {
    // Get all 2024 QBs to see how names are formatted
    const allStats = await nflverseData.fetchSeasonStats(2024);
    
    const qbs = allStats
      .filter(p => p.position === 'QB')
      .map(p => ({
        player_name: p.player_name,
        player_display_name: p.player_display_name,
        team: p.team,
        games: p.games
      }))
      .filter(p => p.games > 0) // Only QBs who played
      .sort((a, b) => a.player_name.localeCompare(b.player_name));

    return NextResponse.json({
      success: true,
      totalQBs: qbs.length,
      qbs: qbs
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
} 