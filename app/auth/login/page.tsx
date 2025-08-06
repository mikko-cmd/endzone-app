"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/dashboard");
      }
    };
    checkSession();
  }, [router, supabase.auth]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logged in successfully!");
      router.push("/dashboard");
    }
  };

  const handleOAuthLogin = async (provider: "google" | "discord") => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {/* Back to Home */}
      <div className="absolute top-8 left-8">
        <Link
          href="/"
          className="text-white hover:text-gray-300 transition-colors"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          ← [back]
        </Link>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md space-y-8">
        {/* Title */}
        <h1
          className="text-white text-4xl font-normal text-center"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [log in]
        </h1>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label
              htmlFor="email"
              className="text-white text-sm mb-2 block"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
              style={{ fontFamily: 'Consolas, monospace' }}
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label
              htmlFor="password"
              className="text-white text-sm mb-2 block"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
              style={{ fontFamily: 'Consolas, monospace' }}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            {loading ? "[signing in...]" : "[sign in]"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className="px-4 bg-black text-gray-500"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              or
            </span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => handleOAuthLogin("google")}
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            [continue with google]
          </button>

          <button
            onClick={() => handleOAuthLogin("discord")}
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            [continue with discord]
          </button>
        </div>

        {/* Sign Up Link */}
        <div className="text-center">
          <Link
            href="/auth/signup"
            className="text-gray-400 hover:text-white transition-colors text-sm"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            need an account? [sign up]
          </Link>
        </div>
      </div>
    </div>
  );
} 