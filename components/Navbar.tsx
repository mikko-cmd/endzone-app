'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, Menu, X, User } from 'lucide-react';

interface NavDropdownProps {
    title: string;
    items: { label: string; href: string }[];
    isOpen: boolean;
    onToggle: () => void;
}

const NavDropdown = ({ title, items, isOpen, onToggle }: NavDropdownProps) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                if (isOpen) onToggle();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onToggle]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={onToggle}
                className="flex items-center space-x-1 px-3 py-2 text-white hover:text-gray-300 transition-colors duration-200"
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                <span>[{title}]</span>
                <ChevronDown
                    size={14}
                    className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-black border border-white shadow-lg z-50">
                    {items.map((item, index) => (
                        <Link
                            key={index}
                            href={item.href}
                            className="block px-4 py-2 text-white hover:bg-gray-900 hover:text-gray-300 transition-colors duration-200"
                            style={{ fontFamily: 'Consolas, monospace' }}
                            onClick={onToggle}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

// Add leagues state and interface
interface League {
    id: string;
    league_name: string;
    sleeper_league_id: string;
}

export default function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userLeagues, setUserLeagues] = useState<League[]>([]);
    const [leaguesLoading, setLeaguesLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserEmail(user?.email || null);
        };
        getUser();
    }, [supabase]);

    // Add new useEffect to fetch leagues
    useEffect(() => {
        const fetchUserLeagues = async () => {
            if (!userEmail) return;

            try {
                const response = await fetch(`/api/leagues/get?user_email=${encodeURIComponent(userEmail)}`);
                const data = await response.json();

                if (data.success) {
                    setUserLeagues(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch user leagues:', error);
            } finally {
                setLeaguesLoading(false);
            }
        };

        fetchUserLeagues();
    }, [userEmail]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    const closeAllDropdowns = () => {
        setOpenDropdown(null);
    };

    // Modify navItems to dynamically generate My Leagues items
    const getMyLeaguesItems = () => {
        const items = [];

        // Add individual leagues
        userLeagues.forEach(league => {
            items.push({
                label: league.league_name,
                href: `/league/${league.sleeper_league_id}`
            });
        });

        // Add separator and static options
        if (userLeagues.length > 0) {
            items.push({ label: '───────────', href: '#', disabled: true });
        }

        items.push({ label: 'View All Leagues', href: '/leagues' });
        items.push({ label: 'Add/Connect League', href: '/leagues/connect' });

        return items;
    };

    const navItems = [
        {
            title: 'Home',
            items: [
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Activity Feed', href: '/dashboard/activity' },
            ]
        },
        {
            title: 'My Leagues',
            items: getMyLeaguesItems()
        },
        {
            title: 'AI Tools',
            items: [
                { label: 'Who Do I Start', href: '/tools/compare' },
                { label: 'Waiver Wire Assistant', href: '/tools/waivers' },
                { label: 'Trade Finder', href: '/tools/trades' },
                { label: 'Draft Assistant', href: '/tools/draft' },
            ]
        },
        {
            title: 'Research',
            items: [
                { label: 'Players', href: '/research/players' },
                { label: 'ADP & Rankings', href: '/research/adp' },
                { label: 'DFS Tools', href: '/research/dfs' },
            ]
        },
        {
            title: 'News',
            items: [
                { label: 'Injury Reports', href: '/news/injuries' },
                { label: 'League News', href: '/news' },
            ]
        },
        {
            title: 'Settings',
            items: [
                { label: 'Account', href: '/settings/account' },
                { label: 'Theme', href: '/settings/theme' },
            ]
        }
    ];

    return (
        <nav className="sticky top-0 w-full bg-black/90 backdrop-blur-sm border-b border-white/10 z-40">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link
                        href="/dashboard"
                        className="text-xl font-normal text-white hover:text-gray-300 transition-colors duration-200"
                        style={{ fontFamily: 'Consolas, monospace' }}
                        onClick={closeAllDropdowns}
                    >
                        [endzone]
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navItems.map((navItem) => (
                            <NavDropdown
                                key={navItem.title}
                                title={navItem.title}
                                items={navItem.items}
                                isOpen={openDropdown === navItem.title}
                                onToggle={() => toggleDropdown(navItem.title)}
                            />
                        ))}
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center space-x-4">
                        {userEmail && (
                            <span
                                className="hidden sm:block text-sm text-gray-400"
                                style={{ fontFamily: 'Consolas, monospace' }}
                            >
                                {userEmail}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="hidden md:block px-3 py-1 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200"
                            style={{ fontFamily: 'Consolas, monospace' }}
                        >
                            [log out]
                        </button>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-white hover:text-gray-300 transition-colors duration-200"
                        >
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-white/10 py-4">
                        <div className="space-y-4">
                            {navItems.map((navItem) => (
                                <div key={navItem.title} className="space-y-2">
                                    <div
                                        className="text-white font-medium border-b border-gray-800 pb-2"
                                        style={{ fontFamily: 'Consolas, monospace' }}
                                    >
                                        [{navItem.title}]
                                    </div>
                                    <div className="pl-4 space-y-2">
                                        {navItem.items.map((item, index) => (
                                            <Link
                                                key={index}
                                                href={item.href}
                                                className="block text-gray-400 hover:text-white transition-colors duration-200"
                                                style={{ fontFamily: 'Consolas, monospace' }}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                {item.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-gray-800">
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-3 py-2 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200"
                                    style={{ fontFamily: 'Consolas, monospace' }}
                                >
                                    [log out]
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
