import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Search, BarChart3, Users, TrendingUp, Target, Database } from 'lucide-react';

interface HubTileProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  status?: 'available' | 'coming_soon';
}

const HubTile: React.FC<HubTileProps> = ({ title, description, href, icon, status = 'available' }) => {
  const isAvailable = status === 'available';

  const content = (
    <div
      className={`cursor-pointer bg-black text-white border border-white/20 p-6 hover:bg-gray-900 hover:border-white/40 transition-all duration-200 ease-in-out h-full ${!isAvailable ? 'opacity-60' : ''
        }`}
      style={{ fontFamily: 'Consolas, monospace' }}
    >
      <div className="flex items-center space-x-3 mb-3">
        {icon}
        <h3 className="text-xl font-normal">[{title}]</h3>
      </div>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      {!isAvailable && (
        <p className="text-xs text-yellow-400">coming soon</p>
      )}
    </div>
  );

  return isAvailable ? (
    <Link href={href}>{content}</Link>
  ) : (
    <div className="cursor-not-allowed">{content}</div>
  );
};

export default async function PlayersPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const playerTools = [
    {
      title: 'Player Search',
      description: 'Search and explore detailed player information, stats, and analysis',
      href: '/research/players/search',
      icon: <Search size={20} />,
      status: 'coming_soon' as const
    },
    {
      title: 'Player Comparisons',
      description: 'Compare multiple players side-by-side across various metrics',
      href: '/research/players/compare',
      icon: <BarChart3 size={20} />,
      status: 'coming_soon' as const
    },
    {
      title: 'Player Stats',
      description: 'Comprehensive statistical analysis and historical performance data',
      href: '/research/players/stats',
      icon: <Database size={20} />,
      status: 'coming_soon' as const
    },
    {
      title: 'Player Profiles',
      description: 'In-depth player profiles with news, injuries, and projections',
      href: '/research/players/profiles',
      icon: <Users size={20} />,
      status: 'coming_soon' as const
    },
    {
      title: 'Trending Players',
      description: 'Discover hot players, breakout candidates, and trending picks',
      href: '/research/players/trending',
      icon: <TrendingUp size={20} />,
      status: 'coming_soon' as const
    },
    {
      title: 'Target Analysis',
      description: 'Advanced target share, air yards, and opportunity analysis',
      href: '/research/players/targets',
      icon: <Target size={20} />,
      status: 'coming_soon' as const
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h1
            className="text-4xl sm:text-5xl font-normal mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [player research]
          </h1>
          <p
            className="text-lg text-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            comprehensive player analysis and research tools
          </p>
        </header>

        {/* Quick Access Tiles */}
        <section className="mb-12">
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [player tools]
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playerTools.map((tool) => (
              <HubTile
                key={tool.title}
                title={tool.title}
                description={tool.description}
                href={tool.href}
                icon={tool.icon}
                status={tool.status}
              />
            ))}
          </div>
        </section>

        {/* Featured Content Placeholder */}
        <section className="mb-12">
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [featured analysis]
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="bg-black border border-white/20 p-6"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <h3 className="text-lg font-normal mb-3">[weekly breakouts]</h3>
              <p className="text-gray-400 text-sm">Identify potential breakout candidates for the upcoming week</p>
            </div>
            <div
              className="bg-black border border-white/20 p-6"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              <h3 className="text-lg font-normal mb-3">[injury impact]</h3>
              <p className="text-gray-400 text-sm">Analysis of how injuries affect player values and opportunities</p>
            </div>
          </div>
        </section>

        {/* Quick Stats Preview */}
        <section>
          <h2
            className="text-2xl font-normal mb-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [quick stats]
          </h2>
          <div
            className="bg-black border border-white/20 p-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <p className="text-gray-400">advanced player statistics and analytics coming soon...</p>
          </div>
        </section>
      </div>
    </div>
  );
}
