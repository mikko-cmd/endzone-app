"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import FootballFieldBackground from '@/components/FootballFieldBackground';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      });

      if (error) {
        setErrors({ submit: error.message });
      } else {
        setSuccess(true);
        // User will be redirected to email confirmation or dashboard
        setTimeout(() => {
          router.push("/auth/login?message=Check your email to confirm your account");
        }, 2000);
      }
    } catch (error: any) {
      setErrors({ submit: error.message || "An unexpected error occurred" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative min-h-screen">
        <FootballFieldBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm text-center">
            <h1 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
              [account created!]
            </h1>
            <p className="text-gray-300 mb-4" style={{ fontFamily: 'Consolas, monospace' }}>
              [check your email to confirm your account]
            </p>
            <p className="text-gray-400 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
              [redirecting to login...]
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <FootballFieldBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-md p-8 bg-black/80 border border-white rounded-lg backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Consolas, monospace' }}>
              [endzone]
            </h1>
            <p className="text-gray-300" style={{ fontFamily: 'Consolas, monospace' }}>
              [create account]
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                  [first name]
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={`mt-1 bg-black border-white text-white placeholder-gray-400 ${errors.firstName ? 'border-red-500' : ''
                    }`}
                  style={{ fontFamily: 'Consolas, monospace' }}
                  placeholder="[first]"
                />
                {errors.firstName && (
                  <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                  [last name]
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={`mt-1 bg-black border-white text-white placeholder-gray-400 ${errors.lastName ? 'border-red-500' : ''
                    }`}
                  style={{ fontFamily: 'Consolas, monospace' }}
                  placeholder="[last]"
                />
                {errors.lastName && (
                  <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                [email]
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`mt-1 bg-black border-white text-white placeholder-gray-400 ${errors.email ? 'border-red-500' : ''
                  }`}
                style={{ fontFamily: 'Consolas, monospace' }}
                placeholder="[enter email]"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                [password]
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={`mt-1 bg-black border-white text-white placeholder-gray-400 ${errors.password ? 'border-red-500' : ''
                  }`}
                style={{ fontFamily: 'Consolas, monospace' }}
                placeholder="[enter password]"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                [confirm password]
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className={`mt-1 bg-black border-white text-white placeholder-gray-400 ${errors.confirmPassword ? 'border-red-500' : ''
                  }`}
                style={{ fontFamily: 'Consolas, monospace' }}
                placeholder="[confirm password]"
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Consolas, monospace' }}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded">
                <p className="text-red-400 text-sm" style={{ fontFamily: 'Consolas, monospace' }}>
                  {errors.submit}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-gray-200 transition-colors mt-6"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              {loading ? "[creating account...]" : "[sign up]"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-white hover:text-gray-300 transition-colors"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [already have an account? log in]
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