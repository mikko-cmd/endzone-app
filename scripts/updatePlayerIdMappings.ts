import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

console.log('🔄 Updating Player ID Mappings...');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to normalize player names for matching
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, '') // Remove periods and apostrophes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

async function updatePlayerIdMappings() {
  try {
    console.log('📥 Downloading nflverse player data...');
    
    const response = await axios.get(
      'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv',
      { timeout: 30000 }
    );

    if (!response.data) {
      throw new Error('No data received from nflverse');
    }

    console.log('📊 Parsing CSV data...');
    
    const lines = response.data.split('\n');
    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
    
    // Use the exact column names from the header you provided
    const displayNameIndex = headers.indexOf('display_name');
    const espnIdIndex = headers.indexOf('espn_id');
    const positionIndex = headers.indexOf('position');
    const teamIndex = headers.indexOf('latest_team');

    console.log('📋 Column indices:');
    console.log(`  display_name: ${displayNameIndex}`);
    console.log(`  espn_id: ${espnIdIndex}`);
    console.log(`  position: ${positionIndex}`);
    console.log(`  latest_team: ${teamIndex}`);

    if (displayNameIndex === -1 || espnIdIndex === -1) {
      throw new Error(`Required columns not found. display_name: ${displayNameIndex}, espn_id: ${espnIdIndex}`);
    }

    // Parse nflverse players
    const nflversePlayers = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const row = lines[i].split(',').map((cell: string) => cell.trim().replace(/"/g, ''));
      
      const displayName = row[displayNameIndex];
      const espnId = row[espnIdIndex];
      const position = positionIndex >= 0 ? row[positionIndex] : '';
      const team = teamIndex >= 0 ? row[teamIndex] : '';
      
      if (displayName && espnId && espnId !== '' && espnId !== 'NA') {
        nflversePlayers.push({
          display_name: displayName,
          espn_id: espnId,
          position: position,
          latest_team: team
        });
      }
    }

    console.log(`✅ Found ${nflversePlayers.length} nflverse players with ESPN IDs`);

    // Get all players from your Supabase database
    console.log('📥 Fetching players from Supabase...');
    
    const { data: supabasePlayers, error } = await supabase
      .from('players')
      .select('sleeper_id, name, position, team')
      .not('name', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch players from Supabase: ${error.message}`);
    }

    console.log(`📊 Found ${supabasePlayers?.length || 0} players in Supabase`);

    // Match players by name
    let matched = 0;
    let updated = 0;
    
    for (const supabasePlayer of supabasePlayers || []) {
      const normalizedSupabaseName = normalizePlayerName(supabasePlayer.name);
      
      // Find matching nflverse player
      const nflverseMatch = nflversePlayers.find(nflPlayer => {
        const normalizedNflverseName = normalizePlayerName(nflPlayer.display_name);
        return normalizedSupabaseName === normalizedNflverseName;
      });
      
      if (nflverseMatch) {
        matched++;
        
        try {
          const { error: updateError } = await supabase
            .from('players')
            .update({ espn_id: nflverseMatch.espn_id })
            .eq('sleeper_id', supabasePlayer.sleeper_id);
            
          if (!updateError) {
            updated++;
            if (updated <= 5) { // Show first 5 matches
              console.log(`✅ Matched: ${supabasePlayer.name} → ESPN ID: ${nflverseMatch.espn_id}`);
            }
          }
        } catch (err) {
          console.log(`❌ Error updating ${supabasePlayer.name}`);
        }
      }
    }

    console.log(`🎯 Matched ${matched} players by name`);
    console.log(`✅ Successfully updated ${updated} players with ESPN IDs`);
    console.log('🎉 Player ID mapping update complete!');

  } catch (error: any) {
    console.error('❌ Error updating player ID mappings:', error.message);
  }
}

updatePlayerIdMappings(); 