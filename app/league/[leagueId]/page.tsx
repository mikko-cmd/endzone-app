import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LeagueDetailClient from './league-detail-client';

interface League {
  id: string;
  sleeper_league_id: string;
  user_email: string;
  league_name: string;
  sleeper_username: string | null;
  created_at: string;
  last_synced_at: string | null;
  rosters_json: any | null;
  matchups_json: any[] | null;
  last_synced_matchups_at: string | null;
  platform?: string; // Add this
  is_manual?: boolean; // Add this
  setup_completed?: boolean; // Add this
  league_settings?: any; // Add this
}

export default async function LeagueDetailPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  console.log(`[LeagueDetailPage] Fetching league data for leagueId: ${params.leagueId}, user: ${user.email}`);
  const startTime = Date.now();

  const { data: league, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('sleeper_league_id', params.leagueId)
    .eq('user_email', user.email)
    .single();

  const duration = Date.now() - startTime;
  console.log(`[LeagueDetailPage] Database query completed in ${duration}ms`);

  if (error || !league) {
    console.error('[LeagueDetailPage] Failed to fetch league or access denied:', error);
    console.error('[LeagueDetailPage] Query params:', { leagueId: params.leagueId, userEmail: user.email });
    return redirect('/dashboard');
  }

  console.log(`[LeagueDetailPage] Successfully found league: ${league.league_name}`);

  // Check if this is a manual league that needs setup
  if (league.is_manual && !league.setup_completed) {
    console.log(`[LeagueDetailPage] Manual league "${league.league_name}" not set up yet, redirecting to setup`);
    return redirect(`/league/${params.leagueId}/setup`);
  }

  // Check if manual league has minimal required data
  if (league.is_manual && (!league.rosters_json || !league.league_settings)) {
    console.log(`[LeagueDetailPage] Manual league "${league.league_name}" missing data, redirecting to setup`);
    return redirect(`/league/${params.leagueId}/setup`);
  }

  return <LeagueDetailClient league={league as League} />;
}
