import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

interface GameLogEntry {
  week: number;
  opponent: string;
  date: string;
  // QB stats
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  // RB stats  
  carries?: number;
  // WR/TE stats
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  targets?: number;
  // Universal
  fantasy_points: number;
}

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

    // Get player name from Supabase using correct column names
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: player, error } = await supabase
      .from('players')
      .select('name, position')
      .eq('sleeper_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching player:', error);
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

    console.log(`🏈 Fetching game log for ${player.name} (${player.position})...`);

    // For now, return position-specific mock data
    let mockGameLog: GameLogEntry[] = [];

    if (player.position === 'QB') {
      mockGameLog = [
        {
          week: 1,
          opponent: 'vs DAL',
          date: '2024-09-08',
          passing_yards: 275,
          passing_tds: 2,
          interceptions: 1,
          rushing_yards: 45,
          rushing_tds: 1,
          fantasy_points: 23.5
        },
        {
          week: 2,
          opponent: '@ NYG',
          date: '2024-09-15',
          passing_yards: 310,
          passing_tds: 3,
          interceptions: 0,
          rushing_yards: 32,
          rushing_tds: 0,
          fantasy_points: 26.2
        },
        {
          week: 3,
          opponent: 'vs CIN',
          date: '2024-09-22',
          passing_yards: 290,
          passing_tds: 1,
          interceptions: 2,
          rushing_yards: 28,
          rushing_tds: 1,
          fantasy_points: 19.8
        }
      ];
    } else if (player.position === 'RB') {
      mockGameLog = [
        {
          week: 1,
          opponent: 'vs DAL',
          date: '2024-09-08',
          carries: 18,
          rushing_yards: 95,
          rushing_tds: 1,
          receptions: 4,
          receiving_yards: 32,
          receiving_tds: 0,
          fantasy_points: 18.7
        },
        {
          week: 2,
          opponent: '@ NYG',
          date: '2024-09-15',
          carries: 22,
          rushing_yards: 120,
          rushing_tds: 2,
          receptions: 3,
          receiving_yards: 25,
          receiving_tds: 1,
          fantasy_points: 26.5
        }
      ];
    } else if (['WR', 'TE'].includes(player.position)) {
      mockGameLog = [
        {
          week: 1,
          opponent: 'vs DAL',
          date: '2024-09-08',
          targets: 8,
          receptions: 6,
          receiving_yards: 85,
          receiving_tds: 1,
          fantasy_points: 20.5
        },
        {
          week: 2,
          opponent: '@ NYG',
          date: '2024-09-15',
          targets: 10,
          receptions: 7,
          receiving_yards: 110,
          receiving_tds: 0,
          fantasy_points: 18.0
        }
      ];
    }

    console.log(`✅ Successfully generated mock game log for ${player.name}`);

    return NextResponse.json({
      success: true,
      gameLog: mockGameLog,
      player: {
        name: player.name,
        position: player.position
      }
    });

  } catch (error: any) {
    console.error('Game log API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch game log' },
      { status: 500 }
    );
  }
} 