import { Clock, TrendingUp, AlertCircle, Users } from 'lucide-react';

interface NewsArticleProps {
    headline: string;
    description: string;
    published: string;
    type: string;
    impact: string;
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'injury':
            return <AlertCircle size={16} className="text-red-400" />;
        case 'trade':
            return <Users size={16} className="text-blue-400" />;
        case 'performance':
            return <TrendingUp size={16} className="text-green-400" />;
        default:
            return <Clock size={16} className="text-gray-400" />;
    }
};

const getImpactColor = (impact: string) => {
    switch (impact) {
        case 'high':
            return 'text-red-400';
        case 'medium':
            return 'text-yellow-400';
        case 'low':
            return 'text-green-400';
        default:
            return 'text-gray-400';
    }
};

export default function NewsArticle({ headline, description, published, type, impact }: NewsArticleProps) {
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

            if (diffInHours < 1) {
                return 'just now';
            } else if (diffInHours < 24) {
                return `${diffInHours}h ago`;
            } else {
                const diffInDays = Math.floor(diffInHours / 24);
                return `${diffInDays}d ago`;
            }
        } catch {
            return 'recently';
        }
    };

    return (
        <div
            className="bg-black border border-white/20 p-6 hover:border-white/40 transition-all duration-200"
            style={{ fontFamily: 'Consolas, monospace' }}
        >
            {/* Header with type and timestamp */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    {getTypeIcon(type)}
                    <span className="text-xs text-gray-400 uppercase">[{type}]</span>
                    <span className={`text-xs uppercase ${getImpactColor(impact)}`}>
                        [{impact} impact]
                    </span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(published)}</span>
            </div>

            {/* Headline */}
            <h3 className="text-lg font-normal text-white mb-3 leading-relaxed">
                {headline}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-400 leading-relaxed">
                    {description}
                </p>
            )}
        </div>
    );
}
