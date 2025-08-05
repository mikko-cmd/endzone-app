import { NextResponse } from 'next/server';
import axios from 'axios';
import { parse } from 'csv-parse';

export async function GET() {
  try {
    console.log('🔍 Debugging NFLverse CSV structure...');
    
    // Download the CSV
    const url = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_2024.csv';
    const response = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const csvData = response.data;
    
    // Parse just the first few rows to inspect structure
    return new Promise((resolve) => {
      parse(csvData, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) {
          resolve(NextResponse.json({
            success: false,
            error: err.message
          }));
          return;
        }
        
        // Get sample data
        const sampleRecord = records[0] || {};
        const columnNames = Object.keys(sampleRecord);
        
        // Find some QBs for testing
        const qbSamples = records
          .filter((r: any) => r.position === 'QB' && parseInt(r.games || 0) > 0)
          .slice(0, 5)
          .map((r: any) => ({
            player_name: r.player_name,
            player_display_name: r.player_display_name,
            position: r.position,
            team: r.recent_team || r.team,
            games: r.games,
            passing_yards: r.passing_yards
          }));
        
        resolve(NextResponse.json({
          success: true,
          totalRecords: records.length,
          columnNames: columnNames,
          sampleRecord: sampleRecord,
          qbSamples: qbSamples,
          csvSizeKB: Math.round(csvData.length / 1024)
        }));
      });
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
} 