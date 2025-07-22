"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { z } from "zod";

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
  const supabase = useMemo(() => createClient(), []);

  const handleSignup = async () => {
    const result = signupSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      result.error.errors.forEach((err) => {
        toast.error(err.message);
      });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed up successfully! Please check your email to verify.");
      router.push("/dashboard");
    }
  };

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg">
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="bg-gray-700 border-gray-600"
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
              className="bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-gray-700 border-gray-600"
            />
          </div>
        </div>
        <Button onClick={handleSignup} className="w-full bg-blue-600 hover:bg-blue-700">
          Sign Up
        </Button>
        <Button
          onClick={handleGoogleSignup}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          Sign Up with Google
        </Button>
        <div className="text-center">
          <a href="/auth/login" className="text-sm text-blue-400 hover:underline">
            Already have an account? Login
          </a>
        </div>
      </div>
    </div>
  );
} 