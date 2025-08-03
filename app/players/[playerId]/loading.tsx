import { ChevronLeft } from 'lucide-react';

export default function PlayerDetailLoading() {
  return (
    <div className="min-h-screen bg-[#1a0033] text-white p-4 sm:p-8 animate-pulse">
      <div className="w-full max-w-4xl mx-auto">
        {/* Back Button Placeholder */}
        <div className="inline-flex items-center text-purple-400 mb-6">
          <ChevronLeft size={20} className="mr-2" />
          <div className="h-4 bg-purple-800 rounded w-16"></div>
        </div>

        {/* Header Placeholder */}
        <header className="mb-8 border-b border-purple-800 pb-4">
          <div className="h-10 bg-purple-800 rounded w-3/4 mb-3"></div>
          <div className="flex items-center space-x-4">
            <div className="h-4 bg-purple-900 rounded w-24"></div>
            <div className="h-4 bg-purple-900 rounded w-24"></div>
            <div className="h-4 bg-purple-900 rounded w-24"></div>
          </div>
        </header>

        {/* Stats Section Placeholder */}
        <section className="bg-[#2c1a4d] p-6 rounded-xl shadow-lg">
          <div className="h-7 bg-purple-900 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-center">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-purple-900/50 p-3 rounded-lg">
                <div className="h-4 bg-purple-800 rounded w-full mb-2"></div>
                <div className="h-6 bg-purple-800 rounded w-1/2 mx-auto"></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
} 