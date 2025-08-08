import { redirect } from 'next/navigation';

export default function LeagueRedirectPage({
    params
}: {
    params: { sleeper_league_id: string }
}) {
    // Redirect to the league detail page
    redirect(`/league/${params.sleeper_league_id}`);
}
