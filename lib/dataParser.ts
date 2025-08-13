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
    wrPointsPercent?: number;
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

interface ScheduleData {
    team: string;
    week: number;
    opponent: string;
    isHome: boolean;
    isBye: boolean;
}

interface WeekMatchup {
    opponent: string;
    isHome: boolean;
    isBye: boolean;
    opponentDefenseRank?: number;
}

// New: Defensive stats (2024) parsed from data/research/2024_defensive_stats.csv
interface DefenseStats {
    teamAbbr: string;
    teamName: string;
    games: number;
    pointsAllowed: number; // PA
    totalYardsAllowed: number; // Yds (total)
    playsFaced: number; // Ply
    yardsPerPlayAllowed: number; // Y/P
    turnovers: number; // TO
    forcedFumbles: number; // FL
    firstDownsAllowedTotal: number; // 1stD (total)
    passCompletionsAllowed: number; // Cmp
    passAttemptsAllowed: number; // Att (passing)
    passYardsAllowed: number; // Yds (passing)
    passTDsAllowed: number; // TD (passing)
    interceptions: number; // Int
    netYardsPerAttemptAllowed: number; // NY/A
    passFirstDownsAllowed: number; // 1stD (passing)
    rushAttemptsFaced: number; // Att (rushing)
    rushYardsAllowed: number; // Yds (rushing)
    rushTDsAllowed: number; // TD (rushing)
    yardsPerRushAllowed: number; // Y/A
    rushFirstDownsAllowed: number; // 1stD (rushing)
    penalties: number; // Pen
    penaltyYards: number; // Yds (penalties)
    firstDownByPenalty: number; // 1stPy
    scorePct: number; // Sc%
    turnoverPct: number; // TO%
    exp: number; // EXP (EPA-like)
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
    private scheduleData: ScheduleData[] = []; // Add this line
    private defenseStatsByAbbr: Record<string, DefenseStats> = {};

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
                            wrPointsPercent: parseFloat(columns[3]?.replace('%', '')) || 0, // WR PTS%
                            tgtPercent: parseFloat(columns[4]?.replace('%', '')) || 0,      // TGT%
                            recPercent: parseFloat(columns[5]?.replace('%', '')) || 0,      // REC%
                            ydPercent: parseFloat(columns[6]?.replace('%', '')) || 0,       // YD%
                            tdPercent: parseFloat(columns[7]?.replace('%', '')) || 0,       // TD%
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
     * Parse the 2025 NFL Schedule CSV file
     */
    async parseNFLSchedule(): Promise<ScheduleData[]> {
        if (this.scheduleData.length > 0) {
            return this.scheduleData; // Return cached data
        }

        try {
            const filePath = path.join(process.cwd(), 'data/research/2025_nfl_schedule.csv');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());

            // Skip header row
            const dataLines = lines.slice(1);

            this.scheduleData = [];

            dataLines.forEach(line => {
                const columns = line.split(',');
                if (columns.length < 19) return; // Need team + 18 weeks

                const team = columns[0].trim();
                if (!team) return;

                // Parse each week (columns 1-18)
                for (let week = 1; week <= 18; week++) {
                    const matchupStr = columns[week]?.trim();
                    if (!matchupStr) continue;

                    if (matchupStr === 'BYE') {
                        this.scheduleData.push({
                            team,
                            week,
                            opponent: '',
                            isHome: false,
                            isBye: true
                        });
                    } else {
                        const isHome = !matchupStr.startsWith('@');
                        const opponent = isHome ? matchupStr : matchupStr.substring(1);

                        this.scheduleData.push({
                            team,
                            week,
                            opponent: opponent.trim(),
                            isHome,
                            isBye: false
                        });
                    }
                }
            });

            console.log(`✅ Parsed ${this.scheduleData.length} schedule entries`);
            return this.scheduleData;

        } catch (error) {
            console.error('❌ Error parsing NFL schedule:', error);
            return [];
        }
    }

    /**
     * Get matchup data for a specific team and week
     */
    getWeekMatchup(team: string, week: number, position: string = 'QB'): WeekMatchup {
        // Ensure schedule data is loaded
        if (this.scheduleData.length === 0) {
            // Try to load synchronously if not already loaded
            try {
                const filePath = path.join(process.cwd(), 'data/research/2025_nfl_schedule.csv');
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                const dataLines = lines.slice(1);

                dataLines.forEach(line => {
                    const columns = line.split(',');
                    if (columns.length < 19) return;

                    const scheduleTeam = columns[0].trim();
                    if (scheduleTeam !== team) return;

                    const matchupStr = columns[week]?.trim();
                    if (!matchupStr) return;

                    if (matchupStr === 'BYE') {
                        this.scheduleData.push({
                            team: scheduleTeam,
                            week,
                            opponent: '',
                            isHome: false,
                            isBye: true
                        });
                    } else {
                        const isHome = !matchupStr.startsWith('@');
                        const opponent = isHome ? matchupStr : matchupStr.substring(1);

                        this.scheduleData.push({
                            team: scheduleTeam,
                            week,
                            opponent: opponent.trim(),
                            isHome,
                            isBye: false
                        });
                    }
                });
            } catch (error) {
                console.error('❌ Error loading schedule data:', error);
            }
        }

        // Find the matchup for this team and week
        const matchup = this.scheduleData.find(s => s.team === team && s.week === week);

        if (!matchup) {
            return {
                opponent: 'TBD',
                isHome: true,
                isBye: false,
                opponentDefenseRank: 16
            };
        }

        if (matchup.isBye) {
            return {
                opponent: '',
                isHome: false,
                isBye: true,
                opponentDefenseRank: undefined
            };
        }

        // Get defensive ranking for this opponent and position
        const opponentDefenseRank = this.getDefensiveRanking(matchup.opponent, position);

        return {
            opponent: matchup.opponent,
            isHome: matchup.isHome,
            isBye: false,
            opponentDefenseRank
        };
    }

    /**
     * Get defensive ranking for a team vs a specific position (from 2024 data)
     */
    private getDefensiveRanking(team: string, position: string): number {
        // 2024 Final Defensive Rankings (from our defense-rankings API)
        const defenseRankings = {
            QB: { 'LAC': 1, 'PHI': 2, 'DEN': 3, 'KC': 4, 'MIN': 5, 'GB': 6, 'DET': 7, 'PIT': 8, 'BAL': 9, 'MIA': 10, 'BUF': 11, 'SEA': 12, 'CHI': 13, 'HOU': 14, 'ARI': 15, 'TB': 16, 'LAR': 17, 'WAS': 18, 'NO': 19, 'NYJ': 20, 'NYG': 21, 'NE': 22, 'ATL': 23, 'IND': 24, 'CIN': 25, 'LV': 26, 'CLE': 27, 'JAX': 28, 'SF': 29, 'TEN': 30, 'DAL': 31, 'CAR': 32 },
            RB: { 'PHI': 1, 'LAC': 2, 'DEN': 3, 'MIN': 4, 'KC': 5, 'GB': 6, 'PIT': 7, 'DET': 8, 'HOU': 9, 'MIA': 10, 'BAL': 11, 'CHI': 12, 'BUF': 13, 'SEA': 14, 'TB': 15, 'ARI': 16, 'LAR': 17, 'NYJ': 18, 'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24, 'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'DAL': 30, 'JAX': 31, 'CAR': 32 },
            WR: { 'LAC': 1, 'DEN': 2, 'PHI': 3, 'MIN': 4, 'KC': 5, 'PIT': 6, 'GB': 7, 'HOU': 8, 'DET': 9, 'BAL': 10, 'MIA': 11, 'CHI': 12, 'BUF': 13, 'SEA': 14, 'ARI': 15, 'TB': 16, 'NYJ': 17, 'LAR': 18, 'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24, 'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'JAX': 30, 'DAL': 31, 'CAR': 32 },
            TE: { 'LAC': 1, 'PHI': 2, 'DEN': 3, 'KC': 4, 'MIN': 5, 'PIT': 6, 'GB': 7, 'DET': 8, 'HOU': 9, 'BAL': 10, 'MIA': 11, 'CHI': 12, 'BUF': 13, 'SEA': 14, 'ARI': 15, 'NYJ': 16, 'TB': 17, 'LAR': 18, 'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24, 'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'JAX': 30, 'DAL': 31, 'CAR': 32 }
        };

        const positionRankings = defenseRankings[position as keyof typeof defenseRankings];
        return positionRankings?.[team as keyof typeof positionRankings] || 16; // Default to middle ranking
    }

    /**
     * Initialize all data including schedule
     */
    async initializeData(): Promise<void> {
        try {
            await Promise.all([
                this.parseSleeperADP(),
                this.parseRBMarketShare(),
                this.parseAllMarketShareData(), // This handles WR and TE market share
                this.parseRedZoneData(), // This handles RB, WR, QB red zone data
                this.parseNFLSchedule(),
                this.parseDefenseStats()
            ]);
            console.log('✅ All enhanced data sources loaded successfully');
        } catch (error) {
            console.error('❌ Error initializing enhanced data:', error);
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
            rookieAnalyses: this.rookieAnalyses,
            defenseStatsByAbbr: this.defenseStatsByAbbr
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

    // Team full name to abbreviation mapping (align with schedule abbreviations)
    private teamNameToAbbr(name: string): string | undefined {
        const map: Record<string, string> = {
            'Arizona Cardinals': 'ARI',
            'Atlanta Falcons': 'ATL',
            'Baltimore Ravens': 'BAL',
            'Buffalo Bills': 'BUF',
            'Carolina Panthers': 'CAR',
            'Chicago Bears': 'CHI',
            'Cincinnati Bengals': 'CIN',
            'Cleveland Browns': 'CLE',
            'Dallas Cowboys': 'DAL',
            'Denver Broncos': 'DEN',
            'Detroit Lions': 'DET',
            'Green Bay Packers': 'GB',
            'Houston Texans': 'HOU',
            'Indianapolis Colts': 'IND',
            'Jacksonville Jaguars': 'JAX',
            'Kansas City Chiefs': 'KC',
            'Las Vegas Raiders': 'LV',
            'Los Angeles Chargers': 'LAC',
            'Los Angeles Rams': 'LAR',
            'Miami Dolphins': 'MIA',
            'Minnesota Vikings': 'MIN',
            'New England Patriots': 'NE',
            'New Orleans Saints': 'NO',
            'New York Giants': 'NYG',
            'New York Jets': 'NYJ',
            'Philadelphia Eagles': 'PHI',
            'Pittsburgh Steelers': 'PIT',
            'San Francisco 49ers': 'SF',
            'Seattle Seahawks': 'SEA',
            'Tampa Bay Buccaneers': 'TB',
            'Tennessee Titans': 'TEN',
            'Washington Commanders': 'WAS'
        };
        return map[name];
    }

    /**
     * Get position-specific ADP rank (1-based) using PPR ADP
     */
    getPositionRank(playerName: string, position: string): number | null {
        if (!this.adpData || this.adpData.length === 0) return null;
        const pos = position.toUpperCase();
        const filtered = this.adpData
            .filter(p => (p.position || '').toUpperCase() === pos && typeof p.ppr === 'number')
            .sort((a, b) => (a.ppr ?? 999) - (b.ppr ?? 999));
        if (filtered.length === 0) return null;
        const index = filtered.findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (index === -1) return null;
        return index + 1;
    }

    /**
     * Parse 2024 defensive stats from CSV
     */
    async parseDefenseStats(): Promise<void> {
        // Always refresh to avoid stale caches if CSV schema changes
        this.defenseStatsByAbbr = {};
        try {
            const filePath = path.join(process.cwd(), 'data/research/2024_defensive_stats.csv');
            if (!fs.existsSync(filePath)) return;
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const rawLines = fileContent.split('\n');
            // The file starts with a grouping header row, find the real header containing 'Tm'
            const headerLineIndex = rawLines.findIndex(l => /(^|,)Tm(,|$)/.test(l));
            if (headerLineIndex === -1) return;
            const header = rawLines[headerLineIndex].split(',');
            const lines = rawLines.slice(headerLineIndex + 1);

            const idx = (key: string, start = 0) => header.indexOf(key, start);
            const idxNext = (key: string, after: number) => header.slice(after + 1).indexOf(key) + after + 1;

            const idxTeam = idx('Tm');
            const idxG = idx('G');
            const idxPA = idx('PA');
            const idxTotYds = idx('Yds');
            const idxPly = idx('Ply');
            const idxYPP = idx('Y/P');
            const idxTO = idx('TO');
            const idxFL = idx('FL');
            const idx1stDTotal = idx('1stD');

            const idxCmp = idx('Cmp');
            const idxPassAtt = idx('Att');
            const idxPassYds = idxCmp + 2;
            const idxPassTD = idxCmp + 3;
            const idxInt = idx('Int');
            const idxNYA = idx('NY/A');
            const idxPass1stD = idxNYA + 1;

            const idxRushAtt = idxNext('Att', idxPass1stD);
            const idxRushYds = idxRushAtt + 1;
            const idxRushTD = idxRushAtt + 2;
            const idxYARush = idx('Y/A', idxRushTD);
            const idxRush1stD = idxYARush + 1;

            const idxPen = idx('Pen');
            const idxPenYds = idxNext('Yds', idxPen);
            const idx1stPy = idx('1stPy');
            const idxScPct = idx('Sc%');
            const idxToPct = idx('TO%');
            const idxExp = idx('EXP');

            for (const raw of lines) {
                if (!raw || raw.startsWith(',') || /Avg|League Total/i.test(raw)) continue;
                const cols = raw.split(',');
                const teamName = cols[idxTeam]?.trim();
                if (!teamName) continue;
                const abbr = this.teamNameToAbbr(teamName);
                if (!abbr) continue;
                const toNum = (v: string) => {
                    const n = parseFloat((v || '').replace('%', ''));
                    return isNaN(n) ? 0 : n;
                };

                this.defenseStatsByAbbr[abbr] = {
                    teamAbbr: abbr,
                    teamName,
                    games: parseInt(cols[idxG] || '0') || 0,
                    pointsAllowed: toNum(cols[idxPA]),
                    totalYardsAllowed: toNum(cols[idxTotYds]),
                    playsFaced: toNum(cols[idxPly]),
                    yardsPerPlayAllowed: toNum(cols[idxYPP]),
                    turnovers: toNum(cols[idxTO]),
                    forcedFumbles: toNum(cols[idxFL]),
                    firstDownsAllowedTotal: toNum(cols[idx1stDTotal]),
                    passCompletionsAllowed: toNum(cols[idxCmp]),
                    passAttemptsAllowed: toNum(cols[idxPassAtt]),
                    passYardsAllowed: toNum(cols[idxPassYds]),
                    passTDsAllowed: toNum(cols[idxPassTD]),
                    interceptions: toNum(cols[idxInt]),
                    netYardsPerAttemptAllowed: toNum(cols[idxNYA]),
                    passFirstDownsAllowed: toNum(cols[idxPass1stD]),
                    rushAttemptsFaced: toNum(cols[idxRushAtt]),
                    rushYardsAllowed: toNum(cols[idxRushYds]),
                    rushTDsAllowed: toNum(cols[idxRushTD]),
                    yardsPerRushAllowed: toNum(cols[idxYARush]),
                    rushFirstDownsAllowed: toNum(cols[idxRush1stD]),
                    penalties: toNum(cols[idxPen]),
                    penaltyYards: toNum(cols[idxPenYds]),
                    firstDownByPenalty: toNum(cols[idx1stPy]),
                    scorePct: toNum(cols[idxScPct]),
                    turnoverPct: toNum(cols[idxToPct]),
                    exp: toNum(cols[idxExp])
                };
            }

            console.log(`✅ Parsed defensive stats for ${Object.keys(this.defenseStatsByAbbr).length} teams`);
        } catch (error: any) {
            console.error('❌ Error parsing defensive stats:', error);
        }
    }

    getDefenseStats(teamAbbr: string): DefenseStats | undefined {
        if (!teamAbbr) return undefined;
        const key = teamAbbr.toUpperCase();
        return this.defenseStatsByAbbr[key];
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
            } catch (error: any) {
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
        const entries = Array.from(this.expertAnalysisCache.entries());
        for (let i = 0; i < entries.length; i++) {
            const [name, content] = entries[i];
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
export type { ADPData, MarketShareData, RedZoneData, CoachingChange, RookieAnalysis, TargetShareData, ScheduleData, WeekMatchup };
export const dataParser = DataParser.getInstance();
