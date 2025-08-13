import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: user,
            profile: profile
        });

    } catch (e: any) {
        return NextResponse.json({
            success: false,
            error: e.message || 'Failed to get user profile'
        }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { first_name, last_name } = body;

        const { data: profile, error: updateError } = await supabase
            .from('profiles')
            .update({
                first_name,
                last_name,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            profile: profile
        });

    } catch (e: any) {
        return NextResponse.json({
            success: false,
            error: e.message || 'Failed to update profile'
        }, { status: 500 });
    }
}
