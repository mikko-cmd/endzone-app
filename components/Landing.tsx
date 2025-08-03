'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

// The following imports will likely cause errors as these files don't exist yet.
// We should address these next.
// import matrixBg from "@/assets/matrix-bg.png";
// import { SleeperLeagueModal } from "@/components/SleeperLeagueModal";
// import { RosterPreview, mockRosterData } from "@/components/RosterPreview";

interface LandingProps {}

export default function Landing({}: LandingProps) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          // backgroundImage: `url(${matrixBg})`, // This will need to be fixed
          filter: 'brightness(0.3)',
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background/90" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="space-y-8">
          {/* Hero Title */}
          <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl">
            FANTASY 2024
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-secondary-foreground font-medium max-w-md">
            Build your ultimate team and dominate the league
          </p>

          {/* Action Buttons */}
          <div className="space-y-4 pt-8">
            <Button className="w-full max-w-sm">
              Connect Your Sleeper League
            </Button>

            <Button asChild className="w-full max-w-sm">
              <Link href="/auth/signup">Sign Up & Draft</Link>
            </Button>

            <Button asChild variant="outline" className="w-full max-w-sm">
              <Link href="/auth/login">Log In</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="pt-12 space-y-3 text-secondary-foreground">
            <p className="text-sm">✨ Real-time player stats</p>
            <p className="text-sm">🏆 Compete with friends</p>
            <p className="text-sm">📊 Advanced analytics</p>
          </div>
        </div>
      </div>
    </div>
  );
}
