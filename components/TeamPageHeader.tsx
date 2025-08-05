// components/TeamPageHeader.tsx
import { useState } from 'react';
import Link from 'next/link';

interface TeamPageHeaderProps {
    teamId: string;
    teamName: string;
}

export default function TeamPageHeader({ teamId, teamName }: TeamPageHeaderProps) {
    const [aiDropdownOpen, setAiDropdownOpen] = useState(false);
    const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);

    return (
        <div className="team-header-actions flex gap-4 mb-6">
            {/* Primary AI Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setAiDropdownOpen(!aiDropdownOpen)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    🤖 AI Analysis
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>

                {aiDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <Link href={`/team/${teamId}/start-sit`} className="block px-4 py-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <span>⚡</span>
                                <div>
                                    <div className="font-medium">Who Should I Start?</div>
                                    <div className="text-sm text-gray-500">Compare players for optimal lineup</div>
                                </div>
                            </div>
                        </Link>

                        <Link href={`/team/${teamId}/season-outlook`} className="block px-4 py-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <span>📊</span>
                                <div>
                                    <div className="font-medium">Season Outlook</div>
                                    <div className="text-sm text-gray-500">AI-powered season analysis</div>
                                </div>
                            </div>
                        </Link>

                        <Link href={`/team/${teamId}/trade-analyzer`} className="block px-4 py-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <span>🔄</span>
                                <div>
                                    <div className="font-medium">Trade Analyzer</div>
                                    <div className="text-sm text-gray-500">Evaluate potential trades</div>
                                </div>
                            </div>
                        </Link>

                        <Link href={`/team/${teamId}/waiver-wire`} className="block px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <span>📈</span>
                                <div>
                                    <div className="font-medium">Waiver Wire Targets</div>
                                    <div className="text-sm text-gray-500">Find pickup opportunities</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                )}
            </div>

            {/* Secondary Tools Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                    🛠️ Team Tools
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>

                {toolsDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <Link href={`/team/${teamId}/lineup-optimizer`} className="block px-4 py-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <span>🎯</span>
                                <div>
                                    <div className="font-medium">Lineup Optimizer</div>
                                    <div className="text-sm text-gray-500">Optimize your starting lineup</div>
                                </div>
                            </div>
                        </Link>

                        <Link href={`/team/${teamId}/schedule-analysis`} className="block px-4 py-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <span>📅</span>
                                <div>
                                    <div className="font-medium">Schedule Analysis</div>
                                    <div className="text-sm text-gray-500">Analyze upcoming matchups</div>
                                </div>
                            </div>
                        </Link>

                        <Link href={`/team/${teamId}/injury-tracker`} className="block px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <span>🏥</span>
                                <div>
                                    <div className="font-medium">Injury Tracker</div>
                                    <div className="text-sm text-gray-500">Monitor player health status</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
