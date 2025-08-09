// scripts/testEspnApi.ts
import 'dotenv/config';
import axios from 'axios';

interface ESPNPlayerNews {
  headline: string | null;
  description: string | null;
  published: string | null;
  source: string;
}

async function testESPNEndpoints(playerName: string): Promise<void> {
  console.log(`🔍 Testing multiple ESPN endpoints for: ${playerName}\n`);

  // Test different ESPN API endpoints
  const endpoints = [
    {
      name: 'ESPN Search API v3',
      url: 'https://site.api.espn.com/apis/common/v3/search',
      params: {
        query: `${playerName} NFL`,
        lang: 'en',
        region: 'us',
        limit: 5
      }
    },
    {
      name: 'ESPN Site API v2',
      url: 'https://site.api.espn.com/apis/site/v2/search',
      params: {
        query: `${playerName} NFL`,
        limit: 5
      }
    },
    {
      name: 'ESPN Sports API',
      url: 'https://sports.api.espn.com/v1/sports/football/nfl/athletes',
      params: {
        limit: 10
      }
    },
    {
      name: 'ESPN News API',
      url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news',
      params: {
        limit: 10
      }
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint.name}`);
      console.log(`🔗 URL: ${endpoint.url}`);

      const response = await axios.get(endpoint.url, {
        params: endpoint.params,
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response keys:`, Object.keys(response.data || {}));

      if (response.data) {
        // Log structure
        if (response.data.contents) {
          console.log(`📋 Contents found: ${response.data.contents.length} items`);
        }
        if (response.data.articles) {
          console.log(`📰 Articles found: ${response.data.articles.length} items`);
        }
        if (response.data.headlines) {
          console.log(`📢 Headlines found: ${response.data.headlines.length} items`);
        }
        if (response.data.items) {
          console.log(`📦 Items found: ${response.data.items.length} items`);
        }
        if (response.data.athletes) {
          console.log(`🏃 Athletes found: ${response.data.athletes.length} items`);
        }

        // Show first item structure if available
        const firstItem = response.data.contents?.[0] ||
          response.data.articles?.[0] ||
          response.data.headlines?.[0] ||
          response.data.items?.[0] ||
          response.data.athletes?.[0];

        if (firstItem) {
          console.log(`🔍 First item keys:`, Object.keys(firstItem));
          console.log(`📝 Sample data:`, {
            headline: firstItem.headline || firstItem.title || firstItem.displayName,
            description: firstItem.description || firstItem.summary,
            type: firstItem.type || firstItem.category
          });
        }
      }

    } catch (error) {
      console.log(`❌ ${endpoint.name} failed:`, error.response?.status || error.message);
    }
  }
}

async function testAlternativeAPIs(playerName: string): Promise<void> {
  console.log(`\n🔄 Testing alternative sports news APIs for: ${playerName}\n`);

  // Test other publicly available sports APIs
  const alternatives = [
    {
      name: 'NewsAPI Sports',
      url: 'https://newsapi.org/v2/everything',
      params: {
        q: `"${playerName}" NFL fantasy football`,
        sortBy: 'publishedAt',
        pageSize: 3,
        apiKey: 'demo'  // This will fail but shows the structure
      }
    },
    {
      name: 'SportRadar Free Tier',
      url: 'https://api.sportradar.us/nfl/official/trial/v7/en/players/roster.json',
      params: {
        api_key: 'demo'  // This will fail but shows if endpoint exists
      }
    }
  ];

  for (const api of alternatives) {
    try {
      console.log(`\n📡 Testing: ${api.name}`);

      const response = await axios.get(api.url, {
        params: api.params,
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log(`✅ ${api.name} accessible - Status: ${response.status}`);
      console.log(`📄 Response structure:`, Object.keys(response.data || {}));

    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`🔑 ${api.name} requires API key (endpoint accessible)`);
      } else {
        console.log(`❌ ${api.name} failed:`, error.response?.status || error.message);
      }
    }
  }
}

async function testSimpleWebScraping(playerName: string): Promise<void> {
  console.log(`\n🕷️ Testing web scraping approach for: ${playerName}\n`);

  try {
    // Try to get ESPN's player page directly
    const playerSearchTerm = playerName.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, '-');
    const espnPlayerUrl = `https://www.espn.com/nfl/player/_/name/${playerSearchTerm}`;

    console.log(`🔗 Trying: ${espnPlayerUrl}`);

    const response = await axios.get(espnPlayerUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log(`✅ ESPN player page accessible - Status: ${response.status}`);
    console.log(`📄 Response length: ${response.data.length} characters`);

    // Look for news content in the HTML
    if (response.data.includes('news') || response.data.includes('headlines')) {
      console.log(`📰 Found news content in player page`);
    }

  } catch (error) {
    console.log(`❌ Web scraping failed:`, error.response?.status || error.message);
  }
}

async function testESPNAPI() {
  console.log('🧪 Comprehensive ESPN API Testing...\n');
  console.log('='.repeat(60));

  const testPlayer = 'Josh Allen';

  // Test 1: ESPN API endpoints
  await testESPNEndpoints(testPlayer);

  // Test 2: Alternative APIs
  await testAlternativeAPIs(testPlayer);

  // Test 3: Web scraping approach
  await testSimpleWebScraping(testPlayer);

  console.log('\n🏁 Testing Complete!');
  console.log('\n💡 Recommendations based on results:');
  console.log('1. If any ESPN endpoint works → use that');
  console.log('2. If NewsAPI works → get API key and use that');
  console.log('3. If web scraping works → implement HTML parsing');
  console.log('4. If nothing works → skip external news for now');
}

// Run the comprehensive test
testESPNAPI().catch(console.error); 