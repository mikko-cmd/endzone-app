'use client';

import Link from 'next/link';

interface LandingProps { }

export default function Landing({ }: LandingProps) {
  const triggerAnimation = () => {
    document.body.classList.add('field-animation-active');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      {/* Your existing content */}
      <div className="flex flex-col items-center justify-center space-y-8">
        <h1
          className="text-white text-6xl md:text-7xl lg:text-8xl font-normal tracking-normal drop-shadow-2xl"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [endzone]
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <Link
            href="/auth/login"
            onClick={triggerAnimation}
            className="px-8 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 text-lg backdrop-blur-sm bg-black/20"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [log in]
          </Link>

          <Link
            href="/auth/signup"
            onClick={triggerAnimation}
            className="px-8 py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 text-lg backdrop-blur-sm bg-black/20"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [sign up]
          </Link>
        </div>
      </div>
    </div>
  );
}