// lib/dataParser.ts
import fs from 'fs';
import path from 'path';

interface ADPData {
    name: string;
    team: string;
    byeWeek: string;
    position: string;
    half: number;
    ppr: number;
    standard: number;
    superflex: number;
}

interface MarketShareData {
    name: string;
    team: string;
    gamesPlayed: number;
    rbPointsPercent?: number;
    attPercent?: number;
    ydPercent?: number;
    tdPercent?: number;
    tgtPercent?: number;
    recPercent?: number;
}

// NEW DATA INTERFACES
interface RedZoneData {
    name: string;
    team: string;
    position: string;
    rzAttempts: number;
    rzAttPercent: number;
    rzTouchdowns: number;
    rzTdPercent: number;
    teamTdPercent: number;
    glAttempts?: number;  // Goal line (inside 5 yard line)
    glAttPercent?: number;
    glTouchdowns?: number;
    glTdPercent?: number;
    glTeamPercent?: number;
}

interface CoachingChange {
    team: string;
    newCoach: string;
    position: string; // "Head Coach" or "OC" or "DC"
    analysis: string;
    fantasyImpact: string;
}

interface RookieAnalysis {
    name: string;
    position: string;
    team: string;
    draftRound: number;
    draftPick: number;
    analysis: string;
    dynastyOutlook: string;
}

interface TargetShareData {
    name: string;
    team: string;
    position: string;
    targetShare: number;
    projectedTargets: number;
    competition: string[];
}

export class DataParser {
    private static instance: DataParser;
    private adpData: ADPData[] = [];
    private marketShareRB: MarketShareData[] = [];
    private marketShareWR: MarketShareData[] = [];
    private marketShareTE: MarketShareData[] = [];
    private redZoneRB: RedZoneData[] = [];
    private redZoneWR: RedZoneData[] = [];
    private redZoneQB: RedZoneData[] = [];
    private coachingChanges: CoachingChange[] = [];
    private rookieAnalyses: RookieAnalysis[] = [];
    private targetShares: TargetShareData[] = [];
    private expertAnalysisCache: Map<string, string> = new Map();

    static getInstance(): DataParser {
        if (!DataParser.instance) {
            DataParser.instance = new DataParser();
        }
        return DataParser.instance;
    }

    /**
     * Parse the main Sleeper ADP CSV file
     */
    async parseSleeperADP(): Promise<ADPData[]> {
        if (this.adpData.length > 0) {
            return this.adpData; // Return cached data
        }

        try {
            const filePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n');

            // Skip header row
            const dataLines = lines.slice(1).filter(line => line.trim());

            this.adpData = dataLines.map(line => {
                // Parse CSV line (handle quoted values)
                const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!matches || matches.length < 8) return null;

                const [name, team, byeWeek, pos, half, ppr, standard, superflex] = matches.map(m => m.replace(/"/g, ''));

                return {
                    name: name.trim(),
                    team: team.trim(),
                    byeWeek: byeWeek.trim(),
                    position: pos.trim(),
                    half: parseFloat(half) || 999,
                    ppr: parseFloat(ppr) || 999,
                    standard: parseFloat(standard) || 999,
                    superflex: parseFloat(superflex) || 999,
                };
            }).filter(Boolean) as ADPData[];

            console.log(`✅ Parsed ${this.adpData.length} players from Sleeper ADP`);
            return this.adpData;

        } catch (error) {
            console.error('❌ Error parsing Sleeper ADP:', error);
            return [];
        }
    }

    /**
     * Get ADP data for a specific player
     */
    getPlayerADP(playerName: string): ADPData | null {
        return this.adpData.find(player =>
            player.name.toLowerCase() === playerName.toLowerCase()
        ) || null;
    }

    /**
     * Parse RB Market Share data
     */
    async parseRBMarketShare(): Promise<MarketShareData[]> {
        if (this.marketShareRB.length > 0) {
            return this.marketShareRB;
        }

        try {
            const filePath = path.join(process.cwd(), 'data/research/2024_marketshare_rb.csv');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n');

            const dataLines = lines.slice(1).filter(line => line.trim());

            this.marketShareRB = dataLines.map(line => {
                const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!matches || matches.length < 10) return null;

                const [name, team, games, rbPts, att, yd, td, tgt, rec, recYd, recTd] = matches.map(m => m.replace(/"/g, ''));

                return {
                    name: name.trim(),
                    team: team.trim(),
                    gamesPlayed: parseInt(games) || 0,
                    rbPointsPercent: parseFloat(rbPts) || 0,
                    attPercent: parseFloat(att) || 0,
                    ydPercent: parseFloat(yd) || 0,
                    tdPercent: parseFloat(td) || 0,
                    tgtPercent: parseFloat(tgt) || 0,
                    recPercent: parseFloat(rec) || 0,
                };
            }).filter(Boolean) as MarketShareData[];

            console.log(`✅ Parsed ${this.marketShareRB.length} RBs from market share data`);
            return this.marketShareRB;

        } catch (error) {
            console.error('❌ Error parsing RB market share:', error);
            return [];
        }
    }

    /**
     * Get market share data for a specific player
     */
    getPlayerMarketShare(playerName: string): MarketShareData | null {
        return this.marketShareRB.find(player =>
            player.name.toLowerCase() === playerName.toLowerCase()
        ) || null;
    }

    /**
     * Parse Red Zone data for all positions
     */
    async parseRedZoneData(): Promise<void> {
        const positions = ['rb', 'wr', 'qb'];

        for (const pos of positions) {
            try {
                const filePath = path.join(process.cwd(), `data/research/2024_redzone_report_${pos}.csv`);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const lines = fileContent.split('\n').filter(line => line.trim());

                const data: RedZoneData[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    const columns = this.parseCSVLine(line);

                    if (columns.length >= 6) {
                        const redZoneEntry: RedZoneData = {
                            name: columns[0],
                            team: columns[1],
                            position: pos.toUpperCase(),
                            rzAttempts: parseInt(columns[2]) || 0,
                            rzAttPercent: parseFloat(columns[3]?.replace('%', '')) || 0,
                            rzTouchdowns: parseInt(columns[4]) || 0,
                            rzTdPercent: parseFloat(columns[5]?.replace('%', '')) || 0,
                            teamTdPercent: parseFloat(columns[6]?.replace('%', '')) || 0,
                        };

                        // Goal line data (if available - columns 7-11)
                        if (columns.length >= 12) {
                            redZoneEntry.glAttempts = parseInt(columns[7]) || 0;
                            redZoneEntry.glAttPercent = parseFloat(columns[8]?.replace('%', '')) || 0;
                            redZoneEntry.glTouchdowns = parseInt(columns[9]) || 0;
                            redZoneEntry.glTdPercent = parseFloat(columns[10]?.replace('%', '')) || 0;
                            redZoneEntry.glTeamPercent = parseFloat(columns[11]?.replace('%', '')) || 0;
                        }

                        data.push(redZoneEntry);
                    }
                }

                // Store by position
                if (pos === 'rb') this.redZoneRB = data;
                else if (pos === 'wr') this.redZoneWR = data;
                else if (pos === 'qb') this.redZoneQB = data;

            } catch (error) {
                console.error(`Error parsing red zone data for ${pos}:`, error);
            }
        }
    }

    /**
     * Parse coaching changes analysis
     */
    async parseCoachingChanges(): Promise<void> {
        try {
            const filePath = path.join(process.cwd(), 'data/analysis/2025_head_coaching_changes.txt');
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            // Parse coaching changes text file
            const sections = fileContent.split(/Head Coach/i).filter(s => s.trim());

            for (const section of sections) {
                const lines = section.split('\n').filter(l => l.trim());
                if (lines.length >= 2) {
                    const coachLine = lines[0].trim();
                    const analysis = lines.slice(1).join('\n').trim();

                    // Extract coach name and team (format: "Ben Johnson, CHI")
                    const match = coachLine.match(/(.+),\s*([A-Z]{2,3})/);
                    if (match) {
                        const [, coachName, team] = match;

                        this.coachingChanges.push({
                            team: team,
                            newCoach: coachName.trim(),
                            position: 'Head Coach',
                            analysis: analysis,
                            fantasyImpact: this.extractFantasyImpact(analysis)
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing coaching changes:', error);
        }
    }

    /**
     * Parse rookie analysis
     */
    async parseRookieAnalysis(): Promise<void> {
        try {
            const filePath = path.join(process.cwd(), 'data/analysis/2025_rookie_report.txt');
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            // Split by player entries (usually start with name, position, team)
            const playerSections = fileContent.split(/\n(?=[A-Z][a-z]+ [A-Z][a-z]+, \([A-Z]{2,3}\) [A-Z]{2,3})/);

            for (const section of playerSections) {
                const lines = section.split('\n').filter(l => l.trim());
                if (lines.length >= 2) {
                    const headerLine = lines[0].trim();

                    // Parse header: "Cam Ward, (QB) TEN"
                    const match = headerLine.match(/(.+?),\s*\(([A-Z]{2,3})\)\s*([A-Z]{2,3})/);
                    if (match) {
                        const [, name, position, team] = match;

                        // Extract draft info if available
                        const draftMatch = section.match(/Round (\d+), Pick (\d+)/i);
                        const round = draftMatch ? parseInt(draftMatch[1]) : 0;
                        const pick = draftMatch ? parseInt(draftMatch[2]) : 0;

                        const analysis = lines.slice(1).join('\n').trim();
                        const dynastyIndex = analysis.indexOf('Dynasty Outlook');

                        this.rookieAnalyses.push({
                            name: name.trim(),
                            position: position,
                            team: team,
                            draftRound: round,
                            draftPick: pick,
                            analysis: dynastyIndex > -1 ? analysis.substring(0, dynastyIndex).trim() : analysis,
                            dynastyOutlook: dynastyIndex > -1 ? analysis.substring(dynastyIndex).trim() : ''
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing rookie analysis:', error);
        }
    }

    /**
     * Parse additional market share data (WR, TE)
     */
    async parseAllMarketShareData(): Promise<void> {
        const positions = ['wr', 'te'];

        for (const pos of positions) {
            try {
                const filePath = path.join(process.cwd(), `data/research/2024_marketshare_${pos}.csv`);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const lines = fileContent.split('\n').filter(line => line.trim());

                const data: MarketShareData[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const columns = this.parseCSVLine(lines[i]);

                    if (columns.length >= 8) {
                        data.push({
                            name: columns[0],
                            team: columns[1],
                            gamesPlayed: parseInt(columns[2]) || 0,
                            tgtPercent: parseFloat(columns[3]?.replace('%', '')) || 0,
                            recPercent: parseFloat(columns[4]?.replace('%', '')) || 0,
                            ydPercent: parseFloat(columns[5]?.replace('%', '')) || 0,
                            tdPercent: parseFloat(columns[6]?.replace('%', '')) || 0,
                        });
                    }
                }

                if (pos === 'wr') this.marketShareWR = data;
                else if (pos === 'te') this.marketShareTE = data;

            } catch (error) {
                console.error(`Error parsing ${pos} market share data:`, error);
            }
        }
    }

    /**
     * Helper to extract fantasy impact from coaching analysis
     */
    private extractFantasyImpact(analysis: string): string {
        // Look for key fantasy-related phrases
        const fantasyKeywords = [
            'offense', 'passing', 'rushing', 'targets', 'touches',
            'fantasy', 'production', 'volume', 'ceiling', 'floor'
        ];

        const sentences = analysis.split(/[.!?]+/);
        const fantasyRelevant = sentences.filter(sentence =>
            fantasyKeywords.some(keyword =>
                sentence.toLowerCase().includes(keyword)
            )
        );

        return fantasyRelevant.slice(0, 2).join('. ').trim();
    }

    /**
     * Initialize all data (call this on startup)
     */
    async initializeData(): Promise<void> {
        console.log('🔄 Initializing enhanced data parser...');

        try {
            // Existing data
            await this.parseSleeperADP();
            await this.parseRBMarketShare();

            // NEW enhanced data
            await this.parseRedZoneData();
            await this.parseCoachingChanges();
            await this.parseRookieAnalysis();
            await this.parseAllMarketShareData();
            await this.loadExpertAnalysis();

            console.log(`✅ Parsed ${this.adpData.length} players from Sleeper ADP`);
            console.log(`✅ Parsed ${this.marketShareRB.length} RBs from market share data`);
            console.log(`✅ Parsed ${this.marketShareWR.length} WRs from market share data`);
            console.log(`✅ Parsed ${this.marketShareTE.length} TEs from market share data`);
            console.log(`✅ Parsed ${this.redZoneRB.length + this.redZoneWR.length + this.redZoneQB.length} players from red zone data`);
            console.log(`✅ Parsed ${this.coachingChanges.length} coaching changes`);
            console.log(`✅ Parsed ${this.rookieAnalyses.length} rookie analyses`);
            console.log('✅ Enhanced data parser initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing enhanced data parser:', error);
            throw error;
        }
    }

    // NEW GETTER METHODS
    getRedZoneData(playerName: string, position?: string): RedZoneData | undefined {
        const pos = position?.toLowerCase();
        let dataset: RedZoneData[] = [];

        if (pos === 'rb') dataset = this.redZoneRB;
        else if (pos === 'wr') dataset = this.redZoneWR;
        else if (pos === 'qb') dataset = this.redZoneQB;
        else {
            // Search all positions
            dataset = [...this.redZoneRB, ...this.redZoneWR, ...this.redZoneQB];
        }

        return dataset.find(player =>
            player.name.toLowerCase().includes(playerName.toLowerCase()) ||
            playerName.toLowerCase().includes(player.name.toLowerCase())
        );
    }

    getCoachingChange(team: string): CoachingChange | undefined {
        return this.coachingChanges.find(change =>
            change.team.toLowerCase() === team.toLowerCase()
        );
    }

    getRookieAnalysis(playerName: string): RookieAnalysis | undefined {
        return this.rookieAnalyses.find(rookie =>
            rookie.name.toLowerCase().includes(playerName.toLowerCase()) ||
            playerName.toLowerCase().includes(rookie.name.toLowerCase())
        );
    }

    getMarketShareByPosition(playerName: string, position: string): MarketShareData | undefined {
        const pos = position.toLowerCase();
        let dataset: MarketShareData[] = [];

        if (pos === 'rb') dataset = this.marketShareRB;
        else if (pos === 'wr') dataset = this.marketShareWR;
        else if (pos === 'te') dataset = this.marketShareTE;

        return dataset.find(player =>
            player.name.toLowerCase().includes(playerName.toLowerCase()) ||
            playerName.toLowerCase().includes(player.name.toLowerCase())
        );
    }

    getAllData() {
        return {
            adpData: this.adpData,
            marketShareRB: this.marketShareRB,
            marketShareWR: this.marketShareWR,
            marketShareTE: this.marketShareTE,
            redZoneRB: this.redZoneRB,
            redZoneWR: this.redZoneWR,
            redZoneQB: this.redZoneQB,
            coachingChanges: this.coachingChanges,
            rookieAnalyses: this.rookieAnalyses
        };
    }

    // ADD THESE MISSING HELPER METHODS:

    /**
     * Helper method to parse CSV lines with quoted values
     */
    private parseCSVLine(line: string): string[] {
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(m => m.replace(/"/g, '').trim()) : [];
    }

    /**
     * Load expert analysis from text files
     */
    async loadExpertAnalysis(): Promise<void> {
        const analysisFiles = [
            'data/analysis/2025_sleeper_candidates.txt',
            'data/analysis/2025_breakout_candidates.txt',
            'data/analysis/2025_bust_candidates.txt',
            'data/analysis/2025_value_picks.txt'
        ];

        for (const filePath of analysisFiles) {
            try {
                const fullPath = path.join(process.cwd(), filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    this.parseExpertAnalysisFile(content, filePath);
                }
            } catch (error) {
                console.error(`Error loading ${filePath}:`, error);
            }
        }

        console.log(`✅ Loaded expert analysis for ${this.expertAnalysisCache.size} players`);
    }

    /**
     * Parse individual expert analysis file
     */
    private parseExpertAnalysisFile(content: string, filePath: string): void {
        const fileName = path.basename(filePath, '.txt').toUpperCase();

        // Split by player entries (look for patterns like "Player Name:")
        const playerEntries = content.split(/\n(?=[A-Z][a-z]+ [A-Z])/);

        for (const entry of playerEntries) {
            const lines = entry.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                const firstLine = lines[0].trim();

                // Extract player name (before any colon or comma)
                const nameMatch = firstLine.match(/^([A-Za-z\s'.-]+?)[\s:,]/);
                if (nameMatch) {
                    const playerName = nameMatch[1].trim();
                    const analysis = `[${fileName}]: ${entry.trim()}`;

                    // Store in cache (append if already exists)
                    const existing = this.expertAnalysisCache.get(playerName) || '';
                    this.expertAnalysisCache.set(playerName, existing + '\n\n' + analysis);
                }
            }
        }
    }

    /**
     * Get expert analysis for a player
     */
    getExpertAnalysis(playerName: string): string | undefined {
        // Direct match first
        let analysis = this.expertAnalysisCache.get(playerName);
        if (analysis) return analysis.trim();

        // Fuzzy search
        for (const [name, content] of this.expertAnalysisCache.entries()) {
            if (name.toLowerCase().includes(playerName.toLowerCase()) ||
                playerName.toLowerCase().includes(name.toLowerCase())) {
                return content.trim();
            }
        }

        return undefined;
    }

    /**
     * Updated parseMarketShareRB method name for consistency
     */
    async parseMarketShareRB(): Promise<MarketShareData[]> {
        return this.parseRBMarketShare();
    }
}

// Export types and singleton
export type { ADPData, MarketShareData, RedZoneData, CoachingChange, RookieAnalysis, TargetShareData };
export const dataParser = DataParser.getInstance();
