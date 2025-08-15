import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Brain, TrendingUp, Users, Target } from 'lucide-react'

export default async function ToolsPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const isAuthenticated = !!user

    const tools = [
        {
            title: 'Who Do I Start?',
            description: 'Compare players and get AI-powered start/sit recommendations with advanced analytics and matchup analysis.',
            href: '/tools/compare',
            available: true, // Free for everyone
            icon: <Brain size={20} />
        },
        {
            title: 'Draft Assistant',
            description: 'Live draft helper with tier-based rankings, ADP analysis, and positional scarcity alerts.',
            href: '/tools/draft',
            available: true, // Free for everyone
            icon: <Target size={20} />
        },
        {
            title: 'Trade Finder',
            description: 'Discover optimal trade opportunities by analyzing team needs and player values across your league.',
            href: '/tools/trades',
            available: isAuthenticated, // Requires login
            icon: <Users size={20} />
        },
        {
            title: 'Waiver Wire Assistant',
            description: 'Get personalized waiver wire recommendations based on your roster needs, league availability, and AI projections.',
            href: '/tools/waivers',
            available: isAuthenticated, // Requires login
            icon: <TrendingUp size={20} />
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-normal mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
                        [ai tools]
                    </h1>
                    <p className="text-lg text-gray-400" style={{ fontFamily: 'Consolas, monospace' }}>
                        ai-powered fantasy football decision making
                    </p>
                </header>

                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {tools.map((tool) => (
                            <div key={tool.title} className="relative">
                                {tool.available ? (
                                    <Link href={tool.href}>
                                        <div className="bg-black border border-white/20 p-6 hover:border-white/40 hover:bg-gray-900 cursor-pointer transition-all duration-200">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center space-x-3">
                                                    {tool.icon}
                                                    <h3 className="text-lg font-normal text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                                        [{tool.title.toLowerCase()}]
                                                    </h3>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-4 leading-relaxed" style={{ fontFamily: 'Consolas, monospace' }}>
                                                {tool.description}
                                            </p>
                                            <span className="text-xs text-white bg-green-900 px-2 py-1 rounded-none" style={{ fontFamily: 'Consolas, monospace' }}>
                                                available
                                            </span>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="bg-black border border-white/20 p-6 opacity-75 relative">
                                        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                                            <div className="text-center">
                                                <p className="text-white font-semibold mb-3" style={{ fontFamily: 'Consolas, monospace' }}>
                                                    Premium Feature
                                                </p>
                                                <div className="space-x-3">
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
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center space-x-3">
                                                {tool.icon}
                                                <h3 className="text-lg font-normal text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                                                    [{tool.title.toLowerCase()}]
                                                </h3>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-4 leading-relaxed" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {tool.description}
                                        </p>
                                        <span className="text-xs text-yellow-400 bg-yellow-900 px-2 py-1 rounded-none" style={{ fontFamily: 'Consolas, monospace' }}>
                                            premium
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Quick Navigation */}
                <section className="pt-8 border-t border-white/20">
                    <h3 className="text-lg font-normal mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
                        [need league-specific tools?]
                    </h3>
                    <p className="text-gray-400 mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
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
