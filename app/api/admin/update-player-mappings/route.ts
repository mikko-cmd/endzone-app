import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePlayerName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function POST(): Promise<NextResponse> {
    try {
        console.log('📥 Downloading nflverse player data...');

        const response = await axios.get(
            'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv',
            { timeout: 30000 }
        );

        if (!response.data) {
            throw new Error('No data received from nflverse');
        }

        const lines = response.data.split('\n');
        const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));

        const displayNameIndex = headers.indexOf('display_name');
        const espnIdIndex = headers.indexOf('espn_id');
        const positionIndex = headers.indexOf('position');
        const teamIndex = headers.indexOf('latest_team');

        if (displayNameIndex === -1 || espnIdIndex === -1) {
            throw new Error(`Required columns not found`);
        }

        // Parse nflverse players
        const nflversePlayers: Array<{
            display_name: string;
            espn_id: string;
            position: string;
            latest_team: string;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const row = lines[i].split(',').map((cell: string) => cell.trim().replace(/"/g, ''));

            const displayName = row[displayNameIndex];
            const espnId = row[espnIdIndex];
            const position = positionIndex >= 0 ? row[positionIndex] : '';
            const team = teamIndex >= 0 ? row[teamIndex] : '';

            if (displayName && espnId && espnId !== '' && espnId !== 'NA') {
                nflversePlayers.push({
                    display_name: displayName,
                    espn_id: espnId,
                    position: position,
                    latest_team: team
                });
            }
        }

        // Get players from Supabase
        const { data: supabasePlayers, error } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .not('name', 'is', null);

        if (error) {
            throw new Error(`Failed to fetch players: ${error.message}`);
        }

        // Match and update
        let matched = 0;
        let updated = 0;
        const sampleMatches: Array<{ name: string; espnId: string }> = [];

        for (const supabasePlayer of supabasePlayers || []) {
            const normalizedSupabaseName = normalizePlayerName(supabasePlayer.name);

            const nflverseMatch = nflversePlayers.find(nflPlayer => {
                const normalizedNflverseName = normalizePlayerName(nflPlayer.display_name);
                return normalizedSupabaseName === normalizedNflverseName;
            });

            if (nflverseMatch) {
                matched++;

                try {
                    const { error: updateError } = await supabase
                        .from('players')
                        .update({ espn_id: nflverseMatch.espn_id })
                        .eq('sleeper_id', supabasePlayer.sleeper_id);

                    if (!updateError) {
                        updated++;
                        if (sampleMatches.length < 5) {
                            sampleMatches.push({
                                name: supabasePlayer.name,
                                espnId: nflverseMatch.espn_id
                            });
                        }
                    }
                } catch (err: any) {
                    console.log(`❌ Error updating ${supabasePlayer.name}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            stats: {
                nflversePlayersFound: nflversePlayers.length,
                supabasePlayersTotal: supabasePlayers?.length || 0,
                matched,
                updated
            },
            sampleMatches,
            message: `Successfully updated ${updated} players with ESPN IDs`
        });

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update player mappings',
                details: error.message
            },
            { status: 500 }
        );
    }
}

export async function GET(): Promise<NextResponse> {
    try {
        const { data: playersWithEspnIds, error } = await supabase
            .from('players')
            .select('name, espn_id, position, team')
            .not('espn_id', 'is', null)
            .limit(10);

        if (error) {
            throw new Error(`Failed to fetch players: ${error.message}`);
        }

        const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .not('espn_id', 'is', null);

        return NextResponse.json({
            success: true,
            stats: {
                totalPlayersWithEspnIds: count || 0,
                samplePlayers: playersWithEspnIds || []
            },
            message: 'Current mapping status'
        });

    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to check mapping status',
                details: error.message
            },
            { status: 500 }
        );
    }
}
