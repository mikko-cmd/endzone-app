"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { z } from "zod";
import Link from "next/link";

const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleSignup = async () => {
    const result = signupSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      result.error.errors.forEach((err) => {
        toast.error(err.message);
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed up successfully! Please check your email to verify.");
      router.push("/dashboard");
    }
  };

  const handleOAuthSignup = async (provider: "google" | "discord") => {
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
          [sign up]
        </h1>

        {/* Signup Form */}
        <div className="space-y-6">
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
              disabled={loading}
            />
          </div>

          <div>
            <Label
              htmlFor="confirmPassword"
              className="text-white text-sm mb-2 block"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black border border-white text-white placeholder-gray-500 focus:ring-1 focus:ring-white focus:border-white rounded-none"
              style={{ fontFamily: 'Consolas, monospace' }}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleSignup}
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            {loading ? "[creating account...]" : "[create account]"}
          </button>
        </div>

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
            onClick={() => handleOAuthSignup("google")}
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            [sign up with google]
          </button>

          <button
            onClick={() => handleOAuthSignup("discord")}
            className="w-full py-3 text-white border border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Consolas, monospace' }}
            disabled={loading}
          >
            [sign up with discord]
          </button>
        </div>

        {/* Login Link */}
        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-gray-400 hover:text-white transition-colors text-sm"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            already have an account? [log in]
          </Link>
        </div>
      </div>
    </div>
  );
} 