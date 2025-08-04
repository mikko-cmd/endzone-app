import 'dotenv/config';
import { PlayerSummaryGenerator } from './generatePlayerSummaries.js';

function getCurrentNFLWeek(): number {
  // NFL 2025 season starts approximately in September
  // This is a simplified calculation - you may want to use a more accurate NFL schedule API
  const now = new Date();
  const seasonStart = new Date('2025-09-04'); // Approximate NFL 2025 season start
  
  if (now < seasonStart) {
    return 0; // Preseason
  }
  
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(weeksSinceStart + 1, 18); // NFL regular season is 18 weeks
}

function isTuesday(): boolean {
  return new Date().getDay() === 2; // Tuesday = 2
}

async function main() {
  const args = process.argv.slice(2);
  const forceWeek = args.find(arg => arg.startsWith('--week'))?.split('=')[1] || 
                   args[args.indexOf('--week') + 1];
  
  if (forceWeek) {
    console.log(`🏈 Forced update for Week ${forceWeek}`);
    const generator = new PlayerSummaryGenerator();
    await generator.generateSummaries(true);
    return;
  }

  const currentWeek = getCurrentNFLWeek();
  
  if (currentWeek === 0) {
    console.log('🏈 Currently in preseason - no weekly updates needed');
    return;
  }

  if (!isTuesday()) {
    console.log('📅 Weekly updates only run on Tuesdays');
    return;
  }

  console.log(`🏈 Starting Week ${currentWeek} player summary updates...`);
  
  const generator = new PlayerSummaryGenerator();
  await generator.generateSummaries(true);
  
  console.log(`✅ Week ${currentWeek} updates complete!`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
