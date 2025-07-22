"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

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
    <div className="flex items-center justify-center min-h-screen bg-[#1a0033] text-white">
      <div className="w-full max-w-md p-8 space-y-8 bg-[#2c1a4d] rounded-2xl shadow-lg">
        <h1 className="text-4xl font-bold text-center">Sign In to Endzone</h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="bg-[#1a0033] border-purple-800 focus:ring-purple-500 focus:border-purple-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-[#1a0033] border-purple-800 focus:ring-purple-500 focus:border-purple-500"
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#6e00ff] hover:bg-purple-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-purple-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#2c1a4d] text-gray-400">
              OR CONTINUE WITH
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => handleOAuthLogin("google")}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
          >
            Continue with Google
          </Button>
          <Button
            onClick={() => handleOAuthLogin("discord")}
            className="w-full bg-[#5865F2] hover:bg-indigo-500 disabled:opacity-50"
            disabled={loading}
          >
            Continue with Discord
          </Button>
        </div>
        <div className="text-center">
          <a
            href="/auth/signup"
            className="text-sm text-purple-400 hover:underline"
          >
            Don't have an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
} 