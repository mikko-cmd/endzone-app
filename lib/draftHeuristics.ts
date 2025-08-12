import { DraftPlayer, DraftState, MyTeam, LeagueSettings, Position } from './types/draft';

export class DraftHeuristics {
    static scoreValue(player: DraftPlayer, pickOverall: number, format: string): {
        reach: number;
        valueScore: number;
        scarcityScore: number;
    } {
        const adp = player.adp[format as keyof typeof player.adp];

        // If ADP is invalid or too late, return poor value score
        if (!adp || adp >= 120) { // Only consider players drafted in first 10 rounds
            return {
                reach: 999,
                valueScore: 0, // Very low value score
                scarcityScore: 0
            };
        }

        const reach = pickOverall - adp;
        const marketShareBonus = this.calculateMarketShareValue(player);

        // Don't give massive bonuses for extreme reaches
        const reachPenalty = Math.max(-25, reach * -2); // Cap the bonus at 25 points
        const valueScore = Math.max(0, 50 + reachPenalty + marketShareBonus);

        return {
            reach,
            valueScore,
            scarcityScore: this.calculateScarcity(player.position, pickOverall)
        };
    }

    static estimateScarcity(
        draft: DraftState,
        available: DraftPlayer[],
        league: LeagueSettings
    ): Record<string, number> {
        const scarcityByPosition: Record<string, number> = {};

        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            const positionPlayers = available.filter(p => p.position === pos);
            const playersToDisappear = this.simulatePicksUntilMyTurn(positionPlayers, draft);
            scarcityByPosition[pos] = Math.min(1, playersToDisappear / Math.max(1, positionPlayers.length));
        });

        return scarcityByPosition;
    }

    static analyzeStacks(myTeam: MyTeam, candidate: DraftPlayer): {
        stackScore: number;
        stackType?: string;
        stackWith?: string;
    } {
        // Look for QB-WR, QB-TE combinations
        const myQBs = myTeam.players.filter(name => this.getPositionFromName(name) === 'QB');

        if (candidate.position === 'WR' || candidate.position === 'TE') {
            const sameTeamQB = myQBs.find(qb => this.getTeamFromName(qb) === candidate.team);
            if (sameTeamQB) {
                return {
                    stackScore: 0.8,
                    stackType: `QB-${candidate.position}`,
                    stackWith: sameTeamQB
                };
            }
        }

        if (candidate.position === 'QB') {
            const sameTeamSkill = myTeam.players.find(player => {
                const pos = this.getPositionFromName(player);
                const team = this.getTeamFromName(player);
                return (pos === 'WR' || pos === 'TE') && team === candidate.team;
            });

            if (sameTeamSkill) {
                return {
                    stackScore: 0.8,
                    stackType: `QB-${this.getPositionFromName(sameTeamSkill)}`,
                    stackWith: sameTeamSkill
                };
            }
        }

        return { stackScore: 0 };
    }

    static calculateByeImpact(myTeam: MyTeam, candidate: DraftPlayer): 'minimal' | 'moderate' | 'heavy' {
        const sameByeWeekPlayers = myTeam.players.filter(playerName => {
            // This would need to lookup the player's bye week
            // For now, simplified logic
            return false; // TODO: Implement actual bye week lookup
        });

        if (sameByeWeekPlayers.length >= 3) return 'heavy';
        if (sameByeWeekPlayers.length >= 2) return 'moderate';
        return 'minimal';
    }

    private static simulatePicksUntilMyTurn(positionPlayers: DraftPlayer[], draft: DraftState): number {
        // Simple simulation: assume teams draft best available at position
        // More sophisticated: weight by team needs, ADP, etc.
        const topPlayers = positionPlayers
            .sort((a, b) => a.adp.PPR - b.adp.PPR) // Use PPR as default
            .slice(0, Math.min(draft.picksUntilMe, positionPlayers.length));

        return topPlayers.length;
    }

    private static calculateScarcity(position: Position, pickOverall: number): number {
        // Position scarcity based on typical draft patterns
        const scarcityFactors = {
            'QB': 0.3, // QBs are less scarce in most formats
            'RB': 0.8, // RBs become scarce quickly
            'WR': 0.6, // Moderate scarcity
            'TE': 0.9, // Very scarce after top tier
            'K': 0.1,
            'DST': 0.1
        };

        const baseScarcity = scarcityFactors[position] || 0.5;
        const roundFactor = Math.min(1, pickOverall / 120); // Increases with later rounds

        return Math.min(1, baseScarcity + roundFactor * 0.3);
    }

    private static calculateMarketShareValue(player: DraftPlayer): number {
        if (!player.marketShare) return 0;

        const { ydPercent = 0, tdPercent = 0, tgtPercent = 0 } = player.marketShare;
        return Math.min(20, (ydPercent + tdPercent + tgtPercent) / 3);
    }

    // Helper methods - these would need to be implemented with actual player data
    private static getPositionFromName(playerName: string): Position {
        // TODO: Implement lookup from player database
        return 'WR'; // Placeholder
    }

    private static getTeamFromName(playerName: string): string {
        // TODO: Implement lookup from player database
        return 'UNK'; // Placeholder
    }
}
