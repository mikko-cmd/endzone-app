"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const handlePasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent! Please check your email.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg">
        <h1 className="text-2xl font-bold text-center">Forgot Password</h1>
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
        </div>
        <Button
          onClick={handlePasswordReset}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Send Reset Link
        </Button>
      </div>
    </div>
  );
} 