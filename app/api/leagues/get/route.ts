import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_email = searchParams.get('user_email');

    if (!user_email) {
      return NextResponse.json({ success: false, error: 'user_email query parameter is required.' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: leagues, error } = await supabase
      .from('leagues')
      .select('*') // Fetches all columns, including rosters_json
      .eq('user_email', user_email)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch leagues from the database.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: leagues,
    });

  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 