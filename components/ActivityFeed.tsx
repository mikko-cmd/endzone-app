'use client';

import { useState, useEffect } from 'react';
import { Clock, Users, TrendingUp, ArrowRightLeft } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'trade' | 'waiver_add' | 'free_agent_add' | 'drop';
    timestamp: number;
    league_name: string;
    league_id: string;
    description: string;
    teams_involved: string[];
    players_involved: { name: string; action: 'added' | 'dropped' | 'traded' }[];
}

interface ActivityFeedProps {
    className?: string;
}

export default function ActivityFeed({ className = "" }: ActivityFeedProps) {
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchActivity();
    }, []);

    const fetchActivity = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/activity');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch activity');
            }

            setActivity(data.activity || []);
        } catch (err: any) {
            console.error('Failed to fetch activity:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'trade':
                return <ArrowRightLeft size={16} className="text-blue-400" />;
            case 'waiver_add':
                return <TrendingUp size={16} className="text-green-400" />;
            case 'free_agent_add':
                return <Users size={16} className="text-yellow-400" />;
            default:
                return <Clock size={16} className="text-gray-400" />;
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        } else if (days < 7) {
            return `${days}d ago`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    };

    if (loading) {
        return (
            <div
                className={`bg-black border border-white/20 p-6 ${className}`}
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                <p className="text-gray-400">loading activity...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`bg-black border border-white/20 p-6 ${className}`}
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                <p className="text-red-400">failed to load activity: {error}</p>
            </div>
        );
    }

    if (activity.length === 0) {
        return (
            <div
                className={`bg-black border border-white/20 p-6 ${className}`}
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                <p className="text-gray-400">no recent activity in your leagues</p>
            </div>
        );
    }

    return (
        <div
            className={`bg-black border border-white/20 p-6 space-y-4 ${className}`}
            style={{ fontFamily: 'Consolas, monospace' }}
        >
            {activity.map((item) => (
                <div key={item.id} className="flex items-start space-x-3 text-sm">
                    <div className="flex-shrink-0 mt-0.5">
                        {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 break-words">
                            {item.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">
                                {formatTimeAgo(item.timestamp)}
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-400">
                                {item.league_name}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
