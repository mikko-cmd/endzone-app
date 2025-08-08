import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Brain, TrendingUp, Users, Target, ChevronRight } from 'lucide-react';

interface ToolCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    status: 'active' | 'coming-soon';
    href?: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon, status, href }) => {
    const content = (
        <div
            className={`bg-black border border-white/20 p-6 h-full transition-all duration-200 ${status === 'active' ? 'hover:border-white/40 hover:bg-gray-900 cursor-pointer' : 'opacity-60'
                }`}
            style={{ fontFamily: 'Consolas, monospace' }}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                    {icon}
                    <h3 className="text-lg font-normal text-white">[{title}]</h3>
                </div>
                {status === 'active' && href && <ChevronRight size={20} className="text-gray-600" />}
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                {description}
            </p>
            <div className="mt-auto">
                {status === 'coming-soon' ? (
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-none">
                        coming soon
                    </span>
                ) : (
                    <span className="text-xs text-white bg-green-900 px-2 py-1 rounded-none">
                        available
                    </span>
                )}
            </div>
        </div>
    );

    if (status === 'active' && href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
};

export default async function ToolsPage() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1
                        className="text-4xl font-normal mb-4"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [ai tools]
                    </h1>
                    <p
                        className="text-lg text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        ai-powered fantasy football decision making
                    </p>
                </header>

                {/* Tools Grid */}
                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ToolCard
                            title="who do i start"
                            description="Compare players and get AI-powered start/sit recommendations with advanced analytics and matchup analysis."
                            icon={<Brain size={20} />}
                            status="active"
                            href="/tools/compare"
                        />
                        <ToolCard
                            title="waiver wire assistant"
                            description="Get personalized waiver wire recommendations based on your roster needs, league availability, and AI projections."
                            icon={<TrendingUp size={20} />}
                            status="active"
                            href="/tools/waivers"
                        />
                        <ToolCard
                            title="trade finder"
                            description="Discover optimal trade opportunities by analyzing team needs and player values across your league."
                            icon={<Users size={20} />}
                            status="active"
                            href="/tools/trades"
                        />
                        <ToolCard
                            title="draft assistant"
                            description="Live draft helper with tier-based rankings, ADP analysis, and positional scarcity alerts."
                            icon={<Target size={20} />}
                            status="coming-soon"
                        />
                    </div>
                </section>

                {/* Quick Navigation */}
                <section className="pt-8 border-t border-white/20">
                    <h3
                        className="text-lg font-normal mb-4"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [need league-specific tools?]
                    </h3>
                    <p
                        className="text-gray-400 mb-4"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        visit your team roster for league-specific waiver and trade recommendations
                    </p>
                    <Link
                        href="/leagues"
                        className="inline-block px-4 py-2 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [view my leagues]
                    </Link>
                </section>
            </div>
        </div>
    );
}
