// Core draft assistant types
export type ScoringFormat = 'PPR' | 'Half' | 'Std' | '2QB' | 'Dynasty';
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'BPA';

export interface DraftPlayer {
    name: string;
    team: string;
    position: Position;
    byeWeek: number;
    adp: Record<ScoringFormat, number>;
    age?: number; // For dynasty
    marketShare?: {
        attPercent?: number;
        ydPercent?: number;
        tdPercent?: number;
        tgtPercent?: number;
        recPercent?: number;
    };
    redZone?: {
        rzTouchdowns?: number;
        rzAttempts?: number;
        rzTdPercent?: number;
    };
}

export interface LeagueSettings {
    teams: number;
    format: ScoringFormat;
    roster: {
        QB: number;
        RB: number;
        WR: number;
        TE: number;
        FLEX: number;
        BENCH: number;
        K?: number;
        DST?: number;
    };
}

export interface DraftState {
    round: number;
    pickOverall: number;
    pickInRound: number;
    snake: boolean;
    myTeamIndex: number;
    picksUntilMe: number;
    board: string[]; // Array of player names that have been drafted
    available: DraftPlayer[];
}

export interface MyTeam {
    players: string[];
    needs: Record<Position, number>;
    stacks: Array<{
        type: 'QB-WR' | 'QB-TE' | 'Team';
        players: string[];
        strength: 'weak' | 'medium' | 'strong';
    }>;
    byes: Record<Position, number[]>;
}

export interface DraftRecommendation {
    decision: 'pick' | 'queue' | 'trade_down_hint';
    primary: {
        playerId: string;
        reason: string;
        fit: {
            positionalNeed: Position;
            stack?: { with: string; type: string; strength: string };
            byeImpact: 'minimal' | 'moderate' | 'heavy';
        };
        value: {
            rank: number;
            adp: number;
            reach: number;
            scarcityScore: number;
        };
        riskFlags: string[];
        coachism?: string;
    };
    alternates: Array<{
        playerId: string;
        reason: string;
        value: { reach: number };
        riskFlags: string[];
    }>;
    strategyNotes: string[];
    confidence: number;
}
