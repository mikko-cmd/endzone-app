import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            user: user
        });

    } catch (e: any) {
        return NextResponse.json({
            success: false,
            error: e.message || 'Failed to get user'
        }, { status: 500 });
    }
}
