const DEBUG = process.env.NODE_ENV === 'development' && false;
const log = DEBUG ? console.log : () => { };
const warn = DEBUG ? console.warn : () => { };
const error = console.error;

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    extractDraftId,
    fetchDraftPicks,
    fetchDraftInfo,
    SleeperPick,
    SleeperDraftInfo
} from '@/lib/sleeper/draftUtils';

interface UseSleeperDraftMonitorProps {
    onNewPick: (pick: SleeperPick) => void;
    pollInterval?: number; // milliseconds, default 3000
}

export function useSleeperDraftMonitor({
    onNewPick,
    pollInterval = 3000
}: UseSleeperDraftMonitorProps) {
    const [sleeperDraftUrl, setSleeperDraftUrl] = useState('');
    const [sleeperDraftId, setSleeperDraftId] = useState<string>('');
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [lastPickCount, setLastPickCount] = useState(0);
    const [draftInfo, setDraftInfo] = useState<SleeperDraftInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

    const monitoringInterval = useRef<NodeJS.Timeout>();

    // Monitor Sleeper draft progress
    const monitorSleeperDraft = useCallback(async () => {
        if (!sleeperDraftId || !isMonitoring) return;

        setLastCheckTime(new Date()); // Track when we last checked

        try {
            setError(null);
            // log(`🔍 Checking for new picks... [${new Date().toLocaleTimeString()}]`); // Remove this noisy log

            const picks = await fetchDraftPicks(sleeperDraftId);
            // log(`📊 Current picks: ${picks.length}, Last known: ${lastPickCount}`); // Remove this too

            // Always process picks that we haven't seen yet
            if (picks.length > lastPickCount) {
                log(`📈 New picks detected: ${picks.length - lastPickCount}`); // Keep this one

                // Process new picks (from lastPickCount onwards)
                const newPicks = picks.slice(lastPickCount);
                log('New picks to process:', newPicks.map(p => `${p.pick_no}: ${p.player_id}`));

                // Process picks one by one with proper async handling
                for (let i = 0; i < newPicks.length; i++) {
                    const pick = newPicks[i];
                    log(`🏈 Processing pick ${i + 1}/${newPicks.length}: ${pick.pick_no} - Player ${pick.player_id}`);

                    try {
                        // Properly await the async onNewPick call
                        await onNewPick(pick);
                    } catch (error) {
                        console.error('Error processing pick:', error);
                    }

                    // Small delay between picks to make updates visible
                    if (i < newPicks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms between picks
                    }
                }

                setLastPickCount(picks.length);
                log(`✅ Updated lastPickCount to ${picks.length} [${new Date().toLocaleTimeString()}]`);
            } else {
                // Remove the "No new picks found" log - it's too noisy
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('❌ Error monitoring Sleeper draft:', errorMessage); // Keep errors
            setError(errorMessage);
        }
    }, [sleeperDraftId, isMonitoring, lastPickCount, onNewPick]);

    // Handle URL change - don't reset lastPickCount unnecessarily
    const handleUrlChange = useCallback(async (url: string) => {
        setSleeperDraftUrl(url);
        const draftId = extractDraftId(url);
        setSleeperDraftId(draftId || '');
        setError(null);

        // Fetch draft info if we have a valid draft ID
        if (draftId) {
            try {
                const info = await fetchDraftInfo(draftId);
                setDraftInfo(info);

                // Only reset lastPickCount if this is a different draft
                // For the same draft, keep the existing count to avoid reprocessing
                if (draftId !== sleeperDraftId) {
                    log('🔄 New draft detected, resetting pick count to 0');
                    setLastPickCount(0);
                }

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch draft info';
                setError(errorMessage);
                setDraftInfo(null);
                setLastPickCount(0);
            }
        } else {
            setDraftInfo(null);
            setLastPickCount(0);
        }
    }, [sleeperDraftId]); // Add sleeperDraftId to dependency array

    // Start/stop monitoring - don't reset lastPickCount when toggling
    const toggleMonitoring = useCallback(() => {
        if (!sleeperDraftId) return;

        log(`🔄 ${isMonitoring ? 'Stopping' : 'Starting'} monitoring...`);
        setIsMonitoring(prev => !prev);

        // Don't reset lastPickCount here - let it continue from where it left off
    }, [sleeperDraftId, isMonitoring]);

    // Setup polling effect
    useEffect(() => {
        if (isMonitoring && sleeperDraftId) {
            // Initial fetch
            monitorSleeperDraft();

            // Setup polling
            monitoringInterval.current = setInterval(monitorSleeperDraft, pollInterval);
        } else {
            if (monitoringInterval.current) {
                clearInterval(monitoringInterval.current);
            }
        }

        return () => {
            if (monitoringInterval.current) {
                clearInterval(monitoringInterval.current);
            }
        };
    }, [isMonitoring, sleeperDraftId, monitorSleeperDraft, pollInterval]);

    return {
        sleeperDraftUrl,
        sleeperDraftId,
        isMonitoring,
        lastPickCount,
        draftInfo,
        error,
        handleUrlChange,
        toggleMonitoring,
    };
}
