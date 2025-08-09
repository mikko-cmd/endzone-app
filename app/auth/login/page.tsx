"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import FootballFieldBackground from '@/components/FootballFieldBackground';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // no toast
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      // no toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <FootballFieldBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
              [endzone]
            </h1>
            <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
              [log in]
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                [email]
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 bg-black border-white text-white placeholder-gray-400"
                style={{ fontFamily: 'Consolas, monospace' }}
                placeholder="[enter email]"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                [password]
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 bg-black border-white text-white placeholder-gray-400"
                style={{ fontFamily: 'Consolas, monospace' }}
                placeholder="[enter password]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-gray-200 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              {loading ? "[logging in...]" : "[log in]"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/signup"
              className="text-white hover:text-gray-300 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [need an account? sign up]
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-sm"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [back to home]
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 