"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, Loader } from 'lucide-react';
import NewsArticle from './NewsArticle';

interface NewsItem {
    headline: string;
    description: string;
    published: string;
    type: string;
    impact: string;
    playerId?: string;
}

export default function NewsFeed() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNews = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError(null);

            const response = await fetch('/api/espn-news?limit=25');
            const data = await response.json();

            if (data.success) {
                setNews(data.data);
            } else {
                setError(data.error || 'Failed to fetch news');
            }
        } catch (err: any) {
            setError('Network error - please try again');
            console.error('Error fetching news:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const handleRefresh = () => {
        fetchNews(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                    <Loader className="animate-spin" size={20} />
                    <span
                        className="text-gray-400"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        [loading latest news...]
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="bg-black border border-red-500/20 p-6 text-center"
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                <p className="text-red-400 mb-4">[error loading news]</p>
                <p className="text-gray-400 text-sm mb-4">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="bg-white text-black px-4 py-2 hover:bg-gray-200 transition-colors"
                >
                    [try again]
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
                <h2
                    className="text-2xl font-normal"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    [latest nfl news]
                </h2>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center space-x-2 bg-black border border-white/20 px-4 py-2 hover:border-white/40 transition-colors disabled:opacity-50"
                    style={{ fontFamily: 'Consolas, monospace' }}
                >
                    <RefreshCw
                        size={16}
                        className={refreshing ? 'animate-spin' : ''}
                    />
                    <span>{refreshing ? '[refreshing...]' : '[refresh]'}</span>
                </button>
            </div>

            {/* News count */}
            <p
                className="text-sm text-gray-400"
                style={{ fontFamily: 'Consolas, monospace' }}
            >
                showing {news.length} recent articles
            </p>

            {/* News articles */}
            <div className="space-y-4">
                {news.length > 0 ? (
                    news.map((article, index) => (
                        <NewsArticle
                            key={index}
                            headline={article.headline}
                            description={article.description}
                            published={article.published}
                            type={article.type}
                            impact={article.impact}
                        />
                    ))
                ) : (
                    <div
                        className="bg-black border border-white/20 p-6 text-center"
                        style={{ fontFamily: 'Consolas, monospace' }}
                    >
                        <p className="text-gray-400">[no news available at the moment]</p>
                    </div>
                )}
            </div>
        </div>
    );
}
