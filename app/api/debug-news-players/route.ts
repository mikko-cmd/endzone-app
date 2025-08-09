import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Get players who have news and their names
        const { data: newsWithPlayers, error } = await supabase
            .from('player_news')
            .select(`
                player_sleeper_id,
                headline,
                players!inner(name, position, team)
            `)
            .limit(20);

        if (error) {
            console.error('Error:', error);
            // Fallback: get news IDs and try to match them manually
            const { data: newsIds } = await supabase
                .from('player_news')
                .select('player_sleeper_id, headline')
                .limit(10);

            const playerPromises = newsIds?.map(async (news) => {
                const { data: player } = await supabase
                    .from('players')
                    .select('name, position, team')
                    .eq('sleeper_id', news.player_sleeper_id)
                    .single();

                return {
                    sleeper_id: news.player_sleeper_id,
                    name: player?.name || 'Unknown',
                    position: player?.position || '?',
                    team: player?.team || '?',
                    headline: news.headline
                };
            }) || [];

            const playersWithNews = await Promise.all(playerPromises);

            return NextResponse.json({
                playersWithNews: playersWithNews.filter(p => p.name !== 'Unknown'),
                note: "Fallback method used - foreign key might not be set up"
            });
        }

        // If join worked
        const playersWithNews = newsWithPlayers?.map(item => ({
            sleeper_id: item.player_sleeper_id,
            name: item.players.name,
            position: item.players.position,
            team: item.players.team,
            headline: item.headline
        }));

        return NextResponse.json({ playersWithNews });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
