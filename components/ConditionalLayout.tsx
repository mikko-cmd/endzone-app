'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from './Navbar';

interface ConditionalLayoutProps {
    children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const supabase = createClient();

    // Routes where we never want to show the navbar
    const noNavbarRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/auth-code-error'];

    // Check if current route should hide navbar
    const shouldHideNavbar = noNavbarRoutes.includes(pathname);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setIsAuthenticated(!!user);
            } catch (error: any) {
                console.error('Auth check failed:', error);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session?.user);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    // Show navbar everywhere except auth pages, and only when not loading
    const showNavbar = !shouldHideNavbar && !isLoading;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white" style={{ fontFamily: 'Consolas, monospace' }}>
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <>
            {showNavbar && <Navbar />}
            <main className={showNavbar ? 'pt-16' : ''}>
                {children}
            </main>
        </>
    );
}
