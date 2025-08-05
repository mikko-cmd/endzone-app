import 'dotenv/config';
import axios from 'axios';

// Test ESPN's free NFL API
async function testEspnApi() {
  try {
    // ESPN has player game logs - let's test with a known player
    console.log('🔍 Testing ESPN API...');
    
    // ESPN Player Game Log format: 
    // https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/{playerId}/gamelog
    
    // First, let's search for Jayden Daniels on ESPN
    const searchResponse = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes',
      { timeout: 10000 }
    );
    
    console.log('✅ ESPN API is accessible');
    console.log('Sample response structure:', Object.keys(searchResponse.data));
    
  } catch (error: any) {
    console.error('❌ ESPN API error:', error.message);
  }
}

testEspnApi(); 