'use client';

import Link from 'next/link';

interface LandingProps { }

export default function Landing({ }: LandingProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center space-y-8">
        {/* Hero Title - Consolas Font */}
        <h1
          className="text-white text-6xl md:text-7xl lg:text-8xl font-normal tracking-normal"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [endzone]
        </h1>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <Link
            href="/auth/login"
            className="px-8 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 text-lg"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [log in]
          </Link>

          <Link
            href="/auth/signup"
            className="px-8 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 text-lg"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [sign up]
          </Link>
        </div>
      </div>
    </div>
  );
}
