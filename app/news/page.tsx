import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Newspaper } from 'lucide-react';
import NewsFeed from '@/components/NewsFeed';

interface NewsCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const NewsCard: React.FC<NewsCardProps> = ({ title, description, href, icon }) => {
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

export default async function NewsPage() {
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
          [news & updates]
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <NewsCard
            title="Injury Reports"
            description="Latest injury updates and impact analysis"
            href="/news/injuries"
            icon={<AlertTriangle size={20} />}
          />
          <div
            className="bg-black text-white border border-white/20 p-6 border-green-400"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <Newspaper size={20} />
              <h3 className="text-xl font-normal">[League News]</h3>
            </div>
            <p className="text-sm text-gray-400">Currently viewing - ESPN news feed</p>
          </div>
        </div>

        {/* ESPN News Feed */}
        <NewsFeed />
      </div>
    </div>
  );
}
