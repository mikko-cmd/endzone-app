'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PersistentFieldBackground() {
    const [isActive, setIsActive] = useState(false);
    const pathname = usePathname();

    // Activate animation when user navigates to auth pages
    useEffect(() => {
        if (pathname.includes('/auth/')) {
            setIsActive(true);
        }
    }, [pathname]);

    // Global trigger function that can be called from anywhere
    useEffect(() => {
        const handleStartAnimation = () => setIsActive(true);

        // Listen for custom event
        window.addEventListener('startFieldAnimation', handleStartAnimation);

        return () => {
            window.removeEventListener('startFieldAnimation', handleStartAnimation);
        };
    }, []);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[-1] pointer-events-none">
            {/* Your Figma animation here */}
            <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
            >
                <source src="/videos/football-field-bg.mp4" type="video/mp4" />
            </video>

            {/* Fallback for browsers that don't support video */}
            <div className="absolute inset-0 bg-black field-animation-fallback" />
        </div>
    );
}
