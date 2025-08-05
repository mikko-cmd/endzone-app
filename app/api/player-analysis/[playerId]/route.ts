import { NextResponse } from 'next/server';
import { dataAggregator } from '@/lib/dataAggregator';
import { NFLWeekDetector } from '@/lib/nflWeek';

export async function GET(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    console.log(`🔍 Starting player analysis for ${playerId}`);

    // Get current NFL week if not specified
    const currentWeek = week ? parseInt(week) : NFLWeekDetector.getCurrentNFLWeek().week;
    
    // Aggregate all player data
    const playerData = await dataAggregator.aggregatePlayerData(playerId, currentWeek);
    
    console.log(`✅ Successfully aggregated data for ${playerData.playerName}`);

    return NextResponse.json({
      success: true,
      data: playerData,
      week: currentWeek,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Player analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
} 