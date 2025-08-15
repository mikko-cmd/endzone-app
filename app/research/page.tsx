import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';

interface ResearchCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const ResearchCard: React.FC<ResearchCardProps> = ({ title, description, href, icon }) => {
  return (
    <Link href={href}>
      <div
        className="cursor-pointer bg-black text-white border border-white/20 p-6 hover:bg-gray-900 hover:border-white/40 transition-all duration-200 ease-in-out h-full"
        style={{ fontFamily: 'Consolas, monospace' }}
      >
        <div className="flex items-center space-x-3 mb-3">
          {icon}
          <h3 className="text-xl font-normal">[{title}]</h3>
        </div>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </Link>
  );
};

export default async function ResearchPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // No authentication required for now

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1
            className="text-4xl font-bold mb-4"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [research hub]
          </h1>
          <p className="text-xl text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
            Advanced analytics and player insights
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <ResearchCard
            title="player analysis"
            description="Comprehensive player statistics, trends, and performance metrics"
            href="/research/players"
            icon={<BarChart3 size={24} />}
          />
          <ResearchCard
            title="adp rankings"
            description="Average Draft Position data and trends across different platforms"
            href="/research/adp"
            icon={<TrendingUp size={24} />}
          />
          <ResearchCard
            title="dfs tools"
            description="Daily Fantasy Sports optimization and lineup construction tools"
            href="/research/dfs"
            icon={<DollarSign size={24} />}
          />
        </div>

        {!user && (
          <div className="mt-12 text-center">
            <div className="bg-gray-900 rounded-lg p-6 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
                Get More Research Tools
              </h3>
              <p className="text-gray-400 mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
                Sign up for advanced analytics, player comparisons, and premium research features
              </p>
              <div className="space-x-4">
                <Link
                  href="/auth/login"
                  className="inline-block px-4 py-2 text-white hover:text-blue-400 transition-colors border border-gray-600 rounded-md hover:border-blue-400"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [login]
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-block px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                  style={{ fontFamily: 'Consolas, monospace' }}
                >
                  [signup]
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
