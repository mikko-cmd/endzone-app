import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import TradeFinder from '@/components/TradeFinder';

export default async function LeagueTradesPage({ params }: { params: { leagueId: string } }) {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Verify league access
    const { data: league, error } = await supabase
        .from('leagues')
        .select('league_name')
        .eq('sleeper_league_id', params.leagueId)
        .eq('user_email', user.email)
        .single();

    if (error || !league) {
        redirect('/leagues');
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <Link
                    href={`/league/${params.leagueId}`}
                    className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    <ChevronLeft size={20} className="mr-2" />
                    [back to team page]
                </Link>

                <header className="mb-8">
                    <h1
                        className="text-3xl sm:text-4xl font-normal mb-2"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [{league.league_name}]
                    </h1>
                    <p
                        className="text-lg text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        ai-powered trade suggestions
                    </p>
                </header>

                <TradeFinder leagueId={params.leagueId} />
            </div>
        </div>
    );
}
