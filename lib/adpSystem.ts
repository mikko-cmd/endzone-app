// lib/adpSystem.ts
import { dataParser, type ADPData, type MarketShareData } from './dataParser.js';
import fs from 'fs';
import path from 'path';

interface LeagueFormat {
    scoring: 'PPR' | 'Half-PPR' | 'Standard';
    qbFormat: '1QB' | 'Superflex' | '2QB';
    teFormat: 'Standard' | 'TE-Premium';
    leagueSize: 8 | 10 | 12 | 14 | 16;
    positions: {
        QB: number;
        RB: number;
        WR: number;
        TE: number;
        FLEX: number;
        SUPERFLEX?: number;
    };
}

interface PlayerContext {
    name: string;
    position: string;
    team: string;
    adpData?: ADPData;
    marketShare?: MarketShareData;
    expertAnalysis?: string;
    formatAdjustedADP?: number;
}

export class ADPSystem {
    private expertAnalysisCache: Map<string, string> = new Map();

    constructor() {
        // Initialize expert analysis cache
        this.loadExpertAnalysis();
    }

    /**
     * Load expert analysis from text files
     */
    private loadExpertAnalysis() {
        try {
            const analysisFiles = [
                'data/analysis/2025_sleeper_candidates.txt',
                'data/analysis/2025_breakout_candidates.txt',
                'data/analysis/2025_bust_candidates.txt',
                'data/analysis/2025_value_picks.txt'
            ];

            for (const filePath of analysisFiles) {
                const fullPath = path.join(process.cwd(), filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    this.parseExpertAnalysis(content, path.basename(filePath, '.txt'));
                }
            }

            console.log(`✅ Loaded expert analysis for ${this.expertAnalysisCache.size} players`);
        } catch (error: any) {
            console.warn('⚠️ Failed to load expert analysis:', error);
        }
    }

    /**
     * Parse expert analysis text files
     */
    private parseExpertAnalysis(content: string, analysisType: string) {
        const lines = content.split('\n');
        let currentPlayer = '';
        let currentAnalysis = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if this line contains a player name with position
            const playerMatch = trimmedLine.match(/^([^,]+),\s*\((\w+)\)\s*(\w+)/);

            if (playerMatch) {
                // Save previous player's analysis
                if (currentPlayer && currentAnalysis) {
                    const existingAnalysis = this.expertAnalysisCache.get(currentPlayer) || '';
                    this.expertAnalysisCache.set(
                        currentPlayer,
                        existingAnalysis + `\n[${analysisType.toUpperCase()}]: ${currentAnalysis.trim()}`
                    );
                }

                // Start new player
                currentPlayer = playerMatch[1].trim();
                currentAnalysis = '';
            } else if (currentPlayer && trimmedLine) {
                // Add to current player's analysis
                currentAnalysis += ' ' + trimmedLine;
            }
        }

        // Save last player
        if (currentPlayer && currentAnalysis) {
            const existingAnalysis = this.expertAnalysisCache.get(currentPlayer) || '';
            this.expertAnalysisCache.set(
                currentPlayer,
                existingAnalysis + `\n[${analysisType.toUpperCase()}]: ${currentAnalysis.trim()}`
            );
        }
    }

    /**
     * Get Sleeper ADP data for a player
     */
    getSleeperADP(playerName: string): ADPData | null {
        return dataParser.getPlayerADP(playerName);
    }

    /**
     * Get market share data for a player
     */
    getMarketShare(playerName: string): MarketShareData | null {
        return dataParser.getPlayerMarketShare(playerName);
    }

    /**
     * Get expert analysis for a player
     */
    getExpertAnalysis(playerName: string): string | null {
        return this.expertAnalysisCache.get(playerName) || null;
    }

    /**
     * Apply format-specific ADP adjustments based on real data differences
     */
    applyFormatAdjustments(
        adpData: ADPData,
        targetFormat: LeagueFormat
    ): number {
        if (!adpData) return 999;

        let adjustedADP: number;

        // Use actual format differences from your data
        switch (targetFormat.scoring) {
            case 'PPR':
                adjustedADP = adpData.ppr;
                break;
            case 'Half-PPR':
                adjustedADP = adpData.half;
                break;
            case 'Standard':
                adjustedADP = adpData.standard;
                break;
            default:
                adjustedADP = adpData.ppr;
        }

        // Apply QB format adjustments
        if (targetFormat.qbFormat === 'Superflex' || targetFormat.qbFormat === '2QB') {
            adjustedADP = adpData.superflex;
        }

        // Apply league size adjustments (more scarcity in larger leagues)
        const sizeAdjustment = (targetFormat.leagueSize - 12) * 0.5;
        adjustedADP += sizeAdjustment;

        // TE-Premium adjustments (roughly 1 round earlier for top TEs)
        if (targetFormat.teFormat === 'TE-Premium' && adpData.position === 'TE') {
            adjustedADP = Math.max(1, adjustedADP - 12);
        }

        return Math.max(1, Math.round(adjustedADP));
    }

    /**
     * Get comprehensive player context
     */
    getPlayerContext(playerName: string, leagueFormat?: LeagueFormat): PlayerContext {
        const adpData = this.getSleeperADP(playerName);
        const marketShare = this.getMarketShare(playerName);
        const expertAnalysis = this.getExpertAnalysis(playerName);

        let formatAdjustedADP: number | undefined;
        if (adpData && leagueFormat) {
            formatAdjustedADP = this.applyFormatAdjustments(adpData, leagueFormat);
        }

        return {
            name: playerName,
            position: adpData?.position || 'Unknown',
            team: adpData?.team || 'Unknown',
            adpData: adpData || undefined, // ✅ Convert null to undefined
            marketShare: marketShare || undefined, // ✅ Convert null to undefined
            expertAnalysis: expertAnalysis || undefined, // ✅ Convert null to undefined
            formatAdjustedADP
        };
    }

    /**
     * Generate enhanced AI prompt with all available data
     */
    generateEnhancedPrompt(
        playerName: string,
        leagueFormat: LeagueFormat,
        stats?: any
    ): string {
        const context = this.getPlayerContext(playerName, leagueFormat);

        // Build system prompt with format awareness
        const systemPrompt = `You are a fantasy football expert writing analysis for:
FORMAT: ${leagueFormat.scoring} scoring, ${leagueFormat.qbFormat}, ${leagueFormat.leagueSize}-team league

RULES:
- Use specific draft round recommendations based on format
- Consider format-specific advantages (PPR helps WRs, Superflex boosts QBs)
- Be realistic about weekly ceiling/floor
- Include value assessment vs. ADP cost`;

        // Build detailed player prompt
        let playerPrompt = `PLAYER: ${context.name} (${context.position}, ${context.team})\n\n`;

        // ADP Information
        if (context.adpData) {
            playerPrompt += `ADP DATA:\n`;
            playerPrompt += `- PPR: ${context.adpData.ppr} | Standard: ${context.adpData.standard} | Superflex: ${context.adpData.superflex}\n`;
            if (context.formatAdjustedADP) {
                const round = Math.ceil(context.formatAdjustedADP / leagueFormat.leagueSize);
                playerPrompt += `- Your Format ADP: ${context.formatAdjustedADP} (Round ${round})\n`;
            }
            playerPrompt += `- Bye Week: ${context.adpData.byeWeek}\n\n`;
        }

        // Market Share Data (for RBs)
        if (context.marketShare && context.position === 'RB') {
            playerPrompt += `2024 USAGE:\n`;
            playerPrompt += `- ${context.marketShare.rbPointsPercent}% of team RB fantasy points\n`;
            playerPrompt += `- ${context.marketShare.attPercent}% of rush attempts\n`;
            playerPrompt += `- ${context.marketShare.tgtPercent}% of RB targets\n`;
            playerPrompt += `- Games played: ${context.marketShare.gamesPlayed}\n\n`;
        }

        // Expert Analysis
        if (context.expertAnalysis) {
            playerPrompt += `EXPERT ANALYSIS:\n`;
            playerPrompt += context.expertAnalysis.trim() + '\n\n';
        }

        // Performance Data
        if (stats) {
            playerPrompt += `2024 STATS:\n`;
            if (context.position === 'QB' && stats.passing_yards) {
                playerPrompt += `- ${stats.passing_yards} pass yards, ${stats.passing_touchdowns || 0} TDs\n`;
                if (stats.rushing_yards) playerPrompt += `- ${stats.rushing_yards} rush yards\n`;
            } else if (context.position === 'RB') {
                playerPrompt += `- ${stats.rushing_yards || 0} rush yards, ${stats.rushing_touchdowns || 0} TDs\n`;
                if (stats.receptions) playerPrompt += `- ${stats.receptions} catches for ${stats.receiving_yards || 0} yards\n`;
            } else if (['WR', 'TE'].includes(context.position)) {
                playerPrompt += `- ${stats.receptions || 0} catches, ${stats.receiving_yards || 0} yards, ${stats.receiving_touchdowns || 0} TDs\n`;
                if (stats.targets) playerPrompt += `- ${stats.targets} targets\n`;
            }
            if (stats.fantasy_points) playerPrompt += `- ${stats.fantasy_points} fantasy points\n`;
            playerPrompt += '\n';
        }

        // Value Analysis
        if (context.adpData && context.marketShare) {
            const isUndervalued = context.marketShare.rbPointsPercent && context.marketShare.rbPointsPercent > 70 && context.adpData.ppr > 24;
            const isOvervalued = context.marketShare.rbPointsPercent && context.marketShare.rbPointsPercent < 50 && context.adpData.ppr < 50;

            if (isUndervalued) {
                playerPrompt += `VALUE SIGNAL: High usage (${context.marketShare.rbPointsPercent}%) but late ADP - potential value\n\n`;
            } else if (isOvervalued) {
                playerPrompt += `VALUE CONCERN: Low usage (${context.marketShare.rbPointsPercent}%) but early ADP - potential overvaluation\n\n`;
            }
        }

        playerPrompt += `Write a concise 2025 fantasy analysis for ${leagueFormat.scoring} ${leagueFormat.qbFormat} format, focusing on draft value and weekly expectations.`;

        return playerPrompt;
    }

    /**
     * Identify value picks based on usage vs ADP
     */
    findValuePicks(position?: string, leagueFormat?: LeagueFormat): PlayerContext[] {
        const valuePicks: PlayerContext[] = [];

        // This would iterate through all players and find discrepancies
        // For now, return players with expert "value" analysis
        for (const [playerName, analysis] of this.expertAnalysisCache) {
            if (analysis.toLowerCase().includes('value') || analysis.toLowerCase().includes('undervalued')) {
                const context = this.getPlayerContext(playerName, leagueFormat);
                if (!position || context.position === position) {
                    valuePicks.push(context);
                }
            }
        }

        return valuePicks.slice(0, 10); // Top 10 value picks
    }

    /**
     * Get format-specific rankings
     */
    getFormatRankings(leagueFormat: LeagueFormat, position?: string): PlayerContext[] {
        // This would return players sorted by format-adjusted ADP
        // Implementation would depend on having all players loaded
        return [];
    }
}

// Export singleton instance
export const adpSystem = new ADPSystem();

// Export types
export type { LeagueFormat, PlayerContext };
