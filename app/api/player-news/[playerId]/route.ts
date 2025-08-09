// app/api/player-news/[playerId]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
    request: Request,
    { params }: { params: { playerId: string } }
) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        console.log(`🔍 API: Looking for player news with ID: ${params.playerId}`);

        // First try exact ID match
        let { data: news, error } = await supabase
            .from('player_news')
            .select('*')
            .eq('player_sleeper_id', params.playerId)
            .order('published_at', { ascending: false })
            .limit(25);

        // If no news found, try to find player by the ID and get their actual sleeper_id
        if (!news || news.length === 0) {
            console.log(`🔍 No news found for ID ${params.playerId}, checking player table...`);

            const { data: player } = await supabase
                .from('players')
                .select('sleeper_id, name')
                .eq('sleeper_id', params.playerId)
                .single();

            if (player) {
                console.log(`🎯 Found player: ${player.name} with sleeper_id: ${player.sleeper_id}`);

                // Try again with confirmed sleeper_id
                const { data: newsRetry } = await supabase
                    .from('player_news')
                    .select('*')
                    .eq('player_sleeper_id', player.sleeper_id)
                    .order('published_at', { ascending: false })
                    .limit(25);

                news = newsRetry;
                console.log(`📊 Retry found ${news?.length || 0} news items`);
            }
        }

        console.log(`📊 API: Found ${news?.length || 0} news items for player ${params.playerId}`);

        if (error) {
            console.error('❌ API: Error fetching player news:', error);
            return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
        }

        const lastUpdated = news && news.length
            ? new Date(Math.max(...news.map((n: any) => new Date(n.published_at).getTime()))).toISOString()
            : null;

        const result = {
            playerId: params.playerId,
            news: news || [],
            count: news?.length || 0,
            lastUpdated
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('❌ API: Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


