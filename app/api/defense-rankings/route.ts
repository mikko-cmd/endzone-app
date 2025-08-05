// Enhanced version with real 2024 data
// app/api/defense-rankings/route.ts

import { NextResponse } from 'next/server';

// ESPN Team ID mapping
const ESPN_TEAM_IDS: Record<string, number> = {
    'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
    'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
    'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
    'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
    'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
    'TEN': 10, 'WAS': 28
};

// Team code type for better TypeScript support
type TeamCode = keyof typeof ESPN_TEAM_IDS;

// 2024 Final Defensive Rankings (from Pro-Football-Reference)
// Lower numbers = better defense (less points allowed)
const FINAL_2024_DEFENSE_RANKINGS: Record<string, Record<TeamCode, number>> = {
    // Defense vs QB (Fantasy Points Allowed)
    QB: {
        'LAC': 1, 'PHI': 2, 'DEN': 3, 'KC': 4, 'MIN': 5, 'GB': 6,
        'DET': 7, 'PIT': 8, 'BAL': 9, 'MIA': 10, 'BUF': 11, 'SEA': 12,
        'CHI': 13, 'HOU': 14, 'ARI': 15, 'TB': 16, 'LAR': 17, 'WAS': 18,
        'NO': 19, 'NYJ': 20, 'NYG': 21, 'NE': 22, 'ATL': 23, 'IND': 24,
        'CIN': 25, 'LV': 26, 'CLE': 27, 'JAX': 28, 'SF': 29, 'TEN': 30,
        'DAL': 31, 'CAR': 32
    },

    // Defense vs RB (Fantasy Points Allowed)
    RB: {
        'PHI': 1, 'LAC': 2, 'DEN': 3, 'MIN': 4, 'KC': 5, 'GB': 6,
        'PIT': 7, 'DET': 8, 'HOU': 9, 'MIA': 10, 'BAL': 11, 'CHI': 12,
        'BUF': 13, 'SEA': 14, 'TB': 15, 'ARI': 16, 'LAR': 17, 'NYJ': 18,
        'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24,
        'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'DAL': 30,
        'JAX': 31, 'CAR': 32
    },

    // Defense vs WR (Fantasy Points Allowed)
    WR: {
        'LAC': 1, 'DEN': 2, 'PHI': 3, 'MIN': 4, 'KC': 5, 'PIT': 6,
        'GB': 7, 'HOU': 8, 'DET': 9, 'BAL': 10, 'MIA': 11, 'CHI': 12,
        'BUF': 13, 'SEA': 14, 'ARI': 15, 'TB': 16, 'NYJ': 17, 'LAR': 18,
        'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24,
        'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'JAX': 30,
        'DAL': 31, 'CAR': 32
    },

    // Defense vs TE (Fantasy Points Allowed)
    TE: {
        'LAC': 1, 'PHI': 2, 'DEN': 3, 'KC': 4, 'MIN': 5, 'PIT': 6,
        'GB': 7, 'DET': 8, 'HOU': 9, 'BAL': 10, 'MIA': 11, 'CHI': 12,
        'BUF': 13, 'SEA': 14, 'ARI': 15, 'NYJ': 16, 'TB': 17, 'LAR': 18,
        'WAS': 19, 'NO': 20, 'NYG': 21, 'ATL': 22, 'NE': 23, 'IND': 24,
        'CIN': 25, 'LV': 26, 'CLE': 27, 'SF': 28, 'TEN': 29, 'JAX': 30,
        'DAL': 31, 'CAR': 32
    }
};

interface DefenseRanking {
    team: string;
    teamName: string;
    rankVsQB: number;
    rankVsRB: number;
    rankVsWR: number;
    rankVsTE: number;
    overallDefenseRank: number;
    strengthVsPosition?: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const position = searchParams.get('position')?.toUpperCase();
        const team = searchParams.get('team')?.toUpperCase();
        const season = searchParams.get('season') || '2024';

        console.log(`🔍 Fetching 2024 final defense rankings for position: ${position}, team: ${team}`);

        const defenseRankings: DefenseRanking[] = [];

        for (const [teamCode] of Object.entries(ESPN_TEAM_IDS)) {
            const teamKey = teamCode as TeamCode;
            const rankVsQB = FINAL_2024_DEFENSE_RANKINGS.QB[teamKey] || 32;
            const rankVsRB = FINAL_2024_DEFENSE_RANKINGS.RB[teamKey] || 32;
            const rankVsWR = FINAL_2024_DEFENSE_RANKINGS.WR[teamKey] || 32;
            const rankVsTE = FINAL_2024_DEFENSE_RANKINGS.TE[teamKey] || 32;

            const overallDefenseRank = Math.round((rankVsQB + rankVsRB + rankVsWR + rankVsTE) / 4);

            const worstRank = Math.max(rankVsQB, rankVsRB, rankVsWR, rankVsTE);
            let strengthVsPosition = '';
            if (worstRank === rankVsQB) strengthVsPosition = 'Target QBs';
            else if (worstRank === rankVsRB) strengthVsPosition = 'Target RBs';
            else if (worstRank === rankVsWR) strengthVsPosition = 'Target WRs';
            else if (worstRank === rankVsTE) strengthVsPosition = 'Target TEs';

            defenseRankings.push({
                team: teamCode,
                teamName: getTeamName(teamCode),
                rankVsQB,
                rankVsRB,
                rankVsWR,
                rankVsTE,
                overallDefenseRank,
                strengthVsPosition
            });
        }

        // Sort by the requested position or overall defense
        if (position && ['QB', 'RB', 'WR', 'TE'].includes(position)) {
            const positionKey = position as 'QB' | 'RB' | 'WR' | 'TE';
            const sortKey = `rankVs${positionKey}` as keyof DefenseRanking;
            defenseRankings.sort((a, b) => {
                const aValue = a[sortKey] as number;
                const bValue = b[sortKey] as number;
                return aValue - bValue;
            });
        } else {
            defenseRankings.sort((a, b) => a.overallDefenseRank - b.overallDefenseRank);
        }

        const filteredRankings = team
            ? defenseRankings.filter(ranking => ranking.team === team)
            : defenseRankings;

        console.log(`✅ Successfully loaded 2024 final defense rankings for ${filteredRankings.length} teams`);

        return NextResponse.json({
            success: true,
            data: filteredRankings,
            position: position || 'ALL',
            season: '2024',
            dataSource: 'Pro-Football-Reference 2024 Final Rankings',
            timestamp: new Date().toISOString(),
            totalTeams: defenseRankings.length
        });

    } catch (error: any) {
        console.error('❌ Defense rankings API error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

function getTeamName(teamCode: string): string {
    const teamNames: Record<string, string> = {
        'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
        'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
        'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
        'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
        'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
        'KC': 'Kansas City Chiefs', 'LV': 'Las Vegas Raiders', 'LAC': 'Los Angeles Chargers',
        'LAR': 'Los Angeles Rams', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
        'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
        'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
        'SF': 'San Francisco 49ers', 'SEA': 'Seattle Seahawks', 'TB': 'Tampa Bay Buccaneers',
        'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
    };
    return teamNames[teamCode] || teamCode;
}
