'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from './Navbar';

export default function NavbarWrapper() {
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

    // Don't show navbar on public routes or while loading
    if (isPublicRoute || isLoading || !isAuthenticated) {
        return null;
    }

    return <Navbar />;
}
