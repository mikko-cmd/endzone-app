"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import FootballFieldBackground from '@/components/FootballFieldBackground';

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (error: any) {
      setError(`Unexpected error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
                [check your email]
              </p>
            </div>

            <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded">
              <p className="text-green-400 text-sm text-center" style={{ fontFamily: 'Consolas, monospace' }}>
                [password reset link sent to {email}]
              </p>
            </div>

            <div className="text-center space-y-4">
              <Link
                href="/auth/login"
                className="block text-white hover:text-gray-300 transition-colors"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [back to login]
              </Link>

              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="block w-full text-gray-400 hover:text-white transition-colors text-sm"
                style={{ fontFamily: 'Consolas, monospace' }}
              >
                [send another email]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              [forgot password]
            </p>
          </div>

          <form onSubmit={handlePasswordReset} className="space-y-6">
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
                placeholder="[enter your email]"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded">
                <p className="text-red-400 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-gray-200 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              {loading ? "[sending reset link...]" : "[send reset link]"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-gray-400 hover:text-white transition-colors text-sm"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [back to login]
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 