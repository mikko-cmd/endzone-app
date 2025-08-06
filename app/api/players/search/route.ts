import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Function to normalize search terms for better matching
function normalizeSearchTerm(term: string): string {
    return term
        .toLowerCase()
        .replace(/[''`]/g, '') // Remove apostrophes
        .replace(/[-_.]/g, '') // Remove dashes, periods, underscores
        .replace(/\s+/g, '') // Remove spaces
        .trim();
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        console.log('🔍 Search API called with query:', query);

        if (!query || query.trim().length < 2) {
            return NextResponse.json({ players: [] });
        }

        // Use service role client to bypass RLS for player data
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check if we have players in the database
        const { count, error: countError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        console.log('📊 Current player count in database:', count);

        // If we have very few players, populate automatically
        if (!countError && (!count || count < 100)) {
            console.log('🚀 Auto-populating players database...');
            try {
                const populateResponse = await fetch(`${request.nextUrl.origin}/api/players/populate`, {
                    method: 'POST'
                });
                const populateResult = await populateResponse.json();
                console.log('✅ Auto-populate completed:', populateResult);

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (populateError) {
                console.error('❌ Auto-populate failed:', populateError);
            }
        }

        // Normalize the search query
        const normalizedQuery = normalizeSearchTerm(query);
        console.log('🔎 Normalized search query:', normalizedQuery);

        // Debug: Let's see what players with apostrophes/dashes we have
        if (query.toLowerCase() === 'devon') {
            const { data: debugPlayers } = await supabase
                .from('players')
                .select('sleeper_id, name, position, team')
                .ilike('name', '%achane%')
                .in('position', ['QB', 'RB', 'WR', 'TE']);
            console.log('🔍 Debug - Achane search results:', debugPlayers);
        }

        if (query.toLowerCase() === 'jamar') {
            const { data: debugPlayers } = await supabase
                .from('players')
                .select('sleeper_id, name, position, team')
                .ilike('name', '%chase%')
                .in('position', ['QB', 'RB', 'WR', 'TE']);
            console.log('🔍 Debug - Chase search results:', debugPlayers);
        }

        // Get all players to filter manually (for better matching)
        const { data: allPlayers, error } = await supabase
            .from('players')
            .select('sleeper_id, name, position, team')
            .in('position', ['QB', 'RB', 'WR', 'TE'])
            .not('name', 'is', null)
            .not('team', 'is', null)
            .not('position', 'is', null);

        if (error) {
            console.error('❌ Player search error:', error);
            return NextResponse.json({ error: 'Failed to search players' }, { status: 500 });
        }

        // Filter players manually with our normalization logic
        const matchingPlayers = allPlayers?.filter(player => {
            const originalName = player.name.toLowerCase();
            const normalizedName = normalizeSearchTerm(player.name);
            const originalQuery = query.toLowerCase().trim();

            // Check if either the original name or normalized name contains the query
            const exactMatch = originalName.includes(originalQuery);
            const normalizedMatch = normalizedName.includes(normalizedQuery);

            return exactMatch || normalizedMatch;
        }) || [];

        const players = matchingPlayers
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 10);

        console.log(`📊 Found ${players.length} players for query "${query}"`);

        // Debug: Show first few results
        if (players.length > 0) {
            console.log('🎯 Sample results:', players.slice(0, 3).map(p => `${p.name} (${p.position} - ${p.team})`));
        }

        return NextResponse.json({ players: players || [] });
    } catch (error) {
        console.error('❌ Player search API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 