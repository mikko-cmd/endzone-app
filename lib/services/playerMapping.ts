import { createClient } from '@supabase/supabase-js';

export class PlayerMappingService {
    private static instance: PlayerMappingService;
    private supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    static getInstance(): PlayerMappingService {
        if (!PlayerMappingService.instance) {
            PlayerMappingService.instance = new PlayerMappingService();
        }
        return PlayerMappingService.instance;
    }

    // Get ESPN athlete ID from existing database
    async getESPNAthleteId(sleeperName: string): Promise<string | undefined> {
        try {
            // Try exact match first
            const { data: exactMatch } = await this.supabase
                .from('players')
                .select('espn_id')
                .eq('name', sleeperName)
                .maybeSingle();

            if (exactMatch?.espn_id) {
                return exactMatch.espn_id;
            }

            // Try normalized search
            const normalizedTarget = this.normalizePlayerName(sleeperName);

            const { data: allPlayers } = await this.supabase
                .from('players')
                .select('name, espn_id')
                .not('espn_id', 'is', null);

            const match = allPlayers?.find(player =>
                this.normalizePlayerName(player.name) === normalizedTarget
            );

            return match?.espn_id || undefined;
        } catch (error: any) {
            console.warn(`Error getting ESPN ID for ${sleeperName}:`, error);
            return undefined;
        }
    }

    // Get Sleeper ID from player name (for reverse lookup)
    async getSleeperPlayerId(playerName: string): Promise<string | undefined> {
        try {
            const { data: player } = await this.supabase
                .from('players')
                .select('sleeper_id')
                .eq('name', playerName)
                .maybeSingle();

            return player?.sleeper_id || undefined;
        } catch (error: any) {
            console.warn(`Error getting Sleeper ID for ${playerName}:`, error);
            return undefined;
        }
    }

    private normalizePlayerName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

export const playerMapping = PlayerMappingService.getInstance();
