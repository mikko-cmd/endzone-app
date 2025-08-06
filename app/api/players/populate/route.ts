import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SleeperPlayer {
    player_id: string;
    full_name?: string;
    first_name: string;
    last_name: string;
    team: string | null;
    position: string | null;
    number: number | null;
}

interface SleeperPlayers {
    [playerId: string]: SleeperPlayer;
}

export async function POST() {
    try {
        console.log('🚀 Starting player population from Sleeper API...');

        // Use service role to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check if we already have players
        const { count, error: countError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error checking existing players:', countError);
        } else if (count && count > 500) {
            console.log(`✅ Already have ${count} players, skipping population`);
            return NextResponse.json({
                success: true,
                message: `Already populated with ${count} players`,
                totalPlayers: count
            });
        }

        console.log(`📊 Current player count: ${count}, proceeding with population...`);

        // Fetch all players from Sleeper
        const sleeperBaseUrl = process.env.NEXT_PUBLIC_SLEEPER_BASE || 'https://api.sleeper.app/v1';
        const response = await fetch(`${sleeperBaseUrl}/players/nfl`);

        if (!response.ok) {
            throw new Error('Failed to fetch players from Sleeper API');
        }

        const allPlayers: SleeperPlayers = await response.json();
        console.log(`📊 Fetched ${Object.keys(allPlayers).length} players from Sleeper`);

        // Filter for skill positions only and active players
        const skillPlayers = Object.entries(allPlayers)
            .filter(([_, player]) => {
                return (
                    player.position &&
                    ['QB', 'RB', 'WR', 'TE'].includes(player.position) &&
                    player.team && // Must have a team
                    (player.full_name || (player.first_name && player.last_name)) // Must have a name
                );
            })
            .map(([playerId, player]) => ({
                sleeper_id: playerId,
                name: player.full_name || `${player.first_name} ${player.last_name}`,
                position: player.position,
                team: player.team,
            }));

        console.log(`🎯 Filtered to ${skillPlayers.length} skill position players`);

        // Show sample data
        console.log('🔍 Sample players:', skillPlayers.slice(0, 3).map(p => `${p.name} (${p.position} - ${p.team})`));

        // Insert in batches to avoid timeout
        const batchSize = 100;
        let inserted = 0;

        for (let i = 0; i < skillPlayers.length; i += batchSize) {
            const batch = skillPlayers.slice(i, i + batchSize);

            const { error } = await supabase
                .from('players')
                .upsert(batch, {
                    onConflict: 'sleeper_id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`❌ Error inserting batch ${i}-${i + batch.length}:`, error);
                throw error;
            }

            inserted += batch.length;
            console.log(`✅ Inserted batch: ${inserted}/${skillPlayers.length} players`);
        }

        return NextResponse.json({
            success: true,
            message: `Successfully populated ${inserted} players`,
            totalPlayers: inserted
        });

    } catch (error: any) {
        console.error('❌ Player population failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
} 