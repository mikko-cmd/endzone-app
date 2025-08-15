"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import FootballFieldBackground from '@/components/FootballFieldBackground';

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if user has a valid session for password reset
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Invalid or expired reset link. Please request a new password reset.");
      }

      setSessionLoading(false);
    };

    checkSession();
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login?message=Password updated successfully");
        }, 3000);
      }
    } catch (error: any) {
      setError(`Unexpected error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
            [endzone]
          </h1>
          <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
            [verifying reset link...]
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
            [endzone]
          </h1>
          <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
            [password updated]
          </p>
        </div>

        <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded">
          <p className="text-green-400 text-sm text-center" style={{ fontFamily: 'Consolas, monospace' }}>
            [password updated successfully! redirecting to login...]
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-white hover:text-gray-300 transition-colors"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [go to login]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
          [endzone]
        </h1>
        <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
          [reset password]
        </p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-6">
        <div>
          <Label htmlFor="password" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
            [new password]
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 bg-black border-white text-white placeholder-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
            placeholder="[enter new password]"
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
            [confirm new password]
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="mt-2 bg-black border-white text-white placeholder-gray-400"
            style={{ fontFamily: 'Consolas, monospace' }}
            placeholder="[confirm new password]"
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
          {loading ? "[updating password...]" : "[update password]"}
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
  );
}

function ResetPasswordFallback() {
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

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen">
      <FootballFieldBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
