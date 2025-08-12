import { DraftPlayer, ScoringFormat, Position } from './types/draft';
import { dataParser } from './dataParser';
import fs from 'fs';
import path from 'path';

export class DraftDataService {
    private static cache: Map<ScoringFormat, DraftPlayer[]> = new Map();
    private static initialized = false;

    static async getAllPlayersForFormat(format: ScoringFormat): Promise<DraftPlayer[]> {
        // Initialize dataParser first time
        if (!this.initialized) {
            await dataParser.initializeData();
            this.initialized = true;
        }

        if (this.cache.has(format)) {
            return this.cache.get(format)!;
        }

        const players = await this.loadAndEnrichPlayers(format);
        this.cache.set(format, players);
        return players;
    }

    private static async loadAndEnrichPlayers(format: ScoringFormat): Promise<DraftPlayer[]> {
        // Load main ADP data or dynasty data based on format
        const adpData = format === 'Dynasty'
            ? await this.loadDynastyData()
            : await this.loadMainADPData();

        // Enrich with your existing market share and red zone data
        return adpData.map(player => ({
            ...player,
            marketShare: dataParser.getMarketShareByPosition(player.name, player.position),
            redZone: dataParser.getRedZoneData(player.name, player.position)
        }));
    }

    private static async loadMainADPData(): Promise<DraftPlayer[]> {
        const filePath = path.join(process.cwd(), 'data', 'adp', '2025_sleeper_adp_ppr.csv');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n').slice(1); // Skip header

        return lines
            .filter(line => line.trim())
            .map(line => {
                const [name, team, byeWeek, pos, half, ppr, std, twoQB] = line
                    .split(',')
                    .map(field => field.replace(/"/g, '').trim());

                return {
                    name,
                    team,
                    position: pos as Position,
                    byeWeek: parseInt(byeWeek),
                    adp: {
                        'Half': this.parseADP(half),
                        'PPR': this.parseADP(ppr),
                        'Std': this.parseADP(std),
                        '2QB': this.parseADP(twoQB),
                        'Dynasty': 999 // Not applicable for main file
                    }
                };
            });
    }

    private static async loadDynastyData(): Promise<DraftPlayer[]> {
        const filePath = path.join(process.cwd(), 'data', 'adp', '2025_dynasty_superflex_startup_adp.csv');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n').slice(1); // Skip header

        return lines
            .filter(line => line.trim())
            .map(line => {
                const [rank, name, team, pos, age] = line
                    .split(',')
                    .map(field => field.replace(/"/g, '').trim());

                const dynastyADP = parseInt(rank);

                return {
                    name,
                    team,
                    position: pos as Position,
                    byeWeek: 0, // Dynasty doesn't care about bye weeks as much
                    age: parseFloat(age),
                    adp: {
                        'Dynasty': dynastyADP,
                        'Half': 999,
                        'PPR': 999,
                        'Std': 999,
                        '2QB': 999
                    }
                };
            });
    }

    private static parseADP(adpString: string): number {
        // Handle missing or invalid ADP values
        if (!adpString || adpString === '' || adpString === '-' || adpString === 'undefined') {
            return 999; // Push to end of rankings
        }

        const parts = adpString.split('.');
        if (parts.length !== 2) return 999;

        const round = parseInt(parts[0]);
        const pick = parseInt(parts[1]);

        // Validate the numbers make sense
        if (isNaN(round) || isNaN(pick) || round < 1 || pick < 1 || pick > 12) {
            return 999;
        }

        // Convert to overall pick (assuming 12-team league)
        return (round - 1) * 12 + pick;
    }

    static getAvailablePlayers(allPlayers: DraftPlayer[], draftedNames: string[]): DraftPlayer[] {
        return allPlayers.filter(player => !draftedNames.includes(player.name));
    }

    static getPlayerByName(allPlayers: DraftPlayer[], name: string): DraftPlayer | undefined {
        return allPlayers.find(player => player.name === name);
    }
}
