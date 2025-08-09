import { NextResponse } from 'next/server';
import { z } from 'zod';

interface ADPPlayer {
    name: string;
    team: string;
    position: string;
    byeWeek: number;
    adp: number;
    pprRank: number;
}

const querySchema = z.object({
    position: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().min(1).max(500).default(200),
});

async function loadADPPlayers(): Promise<ADPPlayer[]> {
    const fs = await import('fs');
    const path = await import('path');

    const players: ADPPlayer[] = [];

    try {
        const adpFilePath = path.join(process.cwd(), 'data/adp/2025_sleeper_adp_ppr.csv');
        const adpContent = fs.readFileSync(adpFilePath, 'utf-8');
        const lines = adpContent.split('\n').slice(1); // Skip header

        lines.forEach((line, index) => {
            if (line.trim()) {
                const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
                if (columns.length >= 6) {
                    const name = columns[0];
                    const team = columns[1];
                    const byeWeek = parseInt(columns[2]) || 0;
                    const position = columns[3];
                    const ppr = parseFloat(columns[5]) || (index + 1);

                    if (name && position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) {
                        players.push({
                            name,
                            team,
                            position,
                            byeWeek,
                            adp: ppr,
                            pprRank: index + 1
                        });
                    }
                }
            }
        });
    } catch (error) {
        console.warn('[ADP] Could not load ADP data:', error);
    }

    return players.sort((a, b) => a.adp - b.adp);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            position: searchParams.get('position') ?? undefined,
            search: searchParams.get('search') ?? undefined,
            limit: searchParams.get('limit') ?? undefined,
        });

        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 });
        }

        const { position, search, limit } = parsed.data;

        let players = await loadADPPlayers();

        // Filter by position
        if (position && position !== 'ALL') {
            players = players.filter(player => player.position === position);
        }

        // Filter by search
        if (search && search.length >= 2) {
            const searchLower = search.toLowerCase();
            players = players.filter(player =>
                player.name.toLowerCase().includes(searchLower) ||
                player.team.toLowerCase().includes(searchLower)
            );
        }

        // Limit results
        players = players.slice(0, limit);

        return NextResponse.json({ success: true, data: players });
    } catch (error) {
        console.error('[ADP API] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
