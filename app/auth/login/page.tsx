"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import FootballFieldBackground from '@/components/FootballFieldBackground';

// Separate component for handling search params
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Debug: Test if state is updating
  useEffect(() => {
    console.log('🔥 Email state changed:', email);
  }, [email]);

  useEffect(() => {
    console.log('🔥 Password state changed:', password.length, 'characters');
  }, [password]);

  useEffect(() => {
    const messageParam = searchParams.get('message');
    if (messageParam) {
      setMessage(messageParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    console.log('🔥 Form submitted!'); // This should appear immediately
    e.preventDefault();
    console.log('🔥 Default prevented, email:', email, 'password length:', password.length);

    setLoading(true);
    setError("");

    try {
      console.log('🔥 About to call Supabase auth...');

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(), // Remove any whitespace
        password: password,
      });

      console.log('🔥 Supabase response:', { data, authError });

      if (authError) {
        console.error('🔥 Login error:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError("Invalid email or password. Please check your credentials.");
        } else if (authError.message.includes('Email not confirmed')) {
          setError("Please check your email and click the confirmation link before logging in.");
        } else {
          setError(authError.message);
        }
      } else if (data.user) {
        console.log('🔥 Login successful! Redirecting...');
        router.push("/dashboard");
      } else {
        console.log('🔥 No error but no user?');
        setError("Login succeeded but no user data received");
      }
    } catch (error: any) {
      console.error('🔥 Unexpected login error:', error);
      setError(`Unexpected error: ${error.message || "Unknown error"}`);
    } finally {
      console.log('🔥 Setting loading to false');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
          [endzone]
        </h1>
        <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
          [log in]
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500 rounded">
          <p className="text-blue-400 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
            {message}
          </p>
        </div>
      )}

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
          href="/auth/forgot-password"
          className="text-gray-400 hover:text-white transition-colors text-sm"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [forgot password?]
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
  );
}

// Loading fallback component
function LoginFormFallback() {
  return (
    <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
          [endzone]
        </h1>
        <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
          [loading...]
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen">
      <FootballFieldBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
} 