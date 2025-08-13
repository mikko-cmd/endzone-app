import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const supabase = createClient();

        // Find all leagues marked as pre-draft
        const { data: preDraftLeagues, error } = await supabase
            .from('leagues')
            .select('*')
            .eq('platform', 'Sleeper')
            .not('rosters_json', 'is', null)
            .filter('rosters_json->isPreDraft', 'eq', true);

        if (error) {
            console.error('Failed to fetch pre-draft leagues:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const results = [];

        for (const league of preDraftLeagues || []) {
            try {
                // Check league status from Sleeper
                const sleeperRes = await fetch(`https://api.sleeper.app/v1/league/${league.sleeper_league_id}`);
                if (!sleeperRes.ok) continue;

                const sleeperData = await sleeperRes.json();

                // If no longer pre-draft, trigger roster sync
                if (sleeperData.status !== 'pre_draft') {
                    console.log(`League ${league.league_name} draft completed, syncing roster...`);

                    // Trigger roster sync
                    const syncRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/rosters/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sleeper_league_id: league.sleeper_league_id,
                            user_email: league.user_email,
                            sleeper_username: league.sleeper_username,
                        }),
                    });

                    results.push({
                        league: league.league_name,
                        status: syncRes.ok ? 'synced' : 'failed',
                    });
                }
            } catch (error: any) {
                console.error(`Failed to check league ${league.league_name}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Checked ${preDraftLeagues?.length || 0} pre-draft leagues`,
            results
        });
    } catch (error: any) {
        console.error('Draft status check failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
