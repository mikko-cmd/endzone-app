import { ChevronLeft } from 'lucide-react';

const SkeletonRow = () => (
    <tr className="border-b border-purple-800 animate-pulse">
        <td className="p-3">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                <div>
                    <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-16"></div>
                </div>
            </div>
        </td>
        <td className="p-3 text-center"><div className="h-4 bg-gray-700 rounded w-8 mx-auto"></div></td>
        <td className="p-3 text-center"><div className="h-4 bg-gray-700 rounded w-8 mx-auto"></div></td>
        <td className="p-3 text-center"><div className="h-4 bg-gray-700 rounded w-8 mx-auto"></div></td>
        <td className="p-3 text-center"><div className="h-4 bg-gray-700 rounded w-8 mx-auto"></div></td>
    </tr>
);

export default function LeagueDetailLoading() {
  return (
    <div className="min-h-screen bg-[#1a0033] text-white p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="inline-flex items-center text-purple-400 mb-6">
          <ChevronLeft size={20} className="mr-2" />
          Back to Dashboard
        </div>
        
        <header className="mb-8 border-b border-purple-800 pb-4 animate-pulse">
            <div className="h-10 bg-purple-800 rounded w-1/2 mb-3"></div>
            <div className="h-6 bg-purple-900 rounded w-1/3"></div>
        </header>

        <section className="bg-[#2c1a4d] rounded-xl shadow-lg mb-8 animate-pulse">
            <h2 className="text-2xl font-bold p-4">Quarterbacks</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-3 w-1/3"></th>
                            <th className="p-3"></th>
                            <th className="p-3"></th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <SkeletonRow />
                        <SkeletonRow />
                    </tbody>
                </table>
            </div>
        </section>
        
        <section className="bg-[#2c1a4d] rounded-xl shadow-lg mb-8 animate-pulse">
            <h2 className="text-2xl font-bold p-4">Running Backs</h2>
             <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-3 w-1/3"></th>
                            <th className="p-3"></th>
                            <th className="p-3"></th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <SkeletonRow />
                        <SkeletonRow />
                    </tbody>
                </table>
            </div>
        </section>
      </div>
    </div>
  );
} 