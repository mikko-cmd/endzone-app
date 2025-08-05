// components/ComparisonResults.tsx
interface ComparisonResultsProps {
    data: any; // Use your ComparisonResult interface
}

export default function ComparisonResults({ data }: ComparisonResultsProps) {
    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Analysis Results</h2>

            {/* Recommendation */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                    📊 Recommendation: Start {data.recommendation.startPlayer}
                </h3>
                <p className="text-green-700 mb-2">
                    Confidence: {data.recommendation.confidence}%
                </p>
                <p className="text-green-700">
                    {data.recommendation.aiAnalysis}
                </p>
            </div>

            {/* Player Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {data.players.map((player: any, index: number) => (
                    <PlayerComparisonCard key={player.playerId} player={player} rank={index + 1} />
                ))}
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(data.rankings.byCategory).map(([category, rankings]: [string, any]) => (
                    <div key={category} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold capitalize mb-2">{category}</h4>
                        {rankings.map((player: any) => (
                            <div key={player.playerId} className="text-sm">
                                {player.rank}. {player.playerName} ({player.score.toFixed(1)})
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlayerComparisonCard({ player, rank }: { player: any; rank: number }) {
    return (
        <div className={`border rounded-lg p-4 ${rank === 1 ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-lg font-semibold">{player.playerName}</h3>
                    <p className="text-gray-600">{player.position}, {player.team}</p>
                </div>
                <div className={`px-2 py-1 rounded text-sm font-semibold ${rank === 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    #{rank}
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <div>Season Fantasy Points: {player.seasonStats.fantasy_points}</div>
                <div>Recent 3-Game Avg: {(player.recentGames.slice(0, 3).reduce((sum: number, game: any) => sum + (game.fantasy_points || 0), 0) / 3).toFixed(1)}</div>
                <div>Weather: {player.weatherImpact?.severity || 'Unknown'}</div>
            </div>
        </div>
    );
}
