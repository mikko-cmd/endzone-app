'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface MainWrapperProps {
    children: React.ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const supabase = createClient();

    // Routes where we never want to show the navbar (even if authenticated)
    const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/auth-code-error'];

    // Check if current route is a public route
    const isPublicRoute = publicRoutes.includes(pathname);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setIsAuthenticated(!!user);
            } catch (error) {
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

    // Determine if we need navbar padding
    const needsNavbarPadding = !isPublicRoute && !isLoading && isAuthenticated;

    return (
        <main className={needsNavbarPadding ? 'pt-16' : ''}>
            {children}
        </main>
    );
}
