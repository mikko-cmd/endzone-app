import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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
  
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 
          className="text-4xl font-normal mb-8"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [research]
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ResearchCard
            title="Players"
            description="Player stats, game logs, and analysis"
            href="/research/players"
            icon={<BarChart3 size={20} />}
          />
          <ResearchCard
            title="ADP & Rankings"
            description="Draft rankings and ADP trends"
            href="/research/adp"
            icon={<TrendingUp size={20} />}
          />
          <ResearchCard
            title="DFS Tools"
            description="Daily fantasy projections and optimization"
            href="/research/dfs"
            icon={<DollarSign size={20} />}
          />
        </div>
      </div>
    </div>
  );
}
