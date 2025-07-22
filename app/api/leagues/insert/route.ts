import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const leagueSchema = z.object({
  sleeper_league_id: z.string(),
  user_email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = leagueSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.errors }, { status: 400 });
    }

    const { sleeper_league_id, user_email } = parsed.data;

    const supabase = createClient();

    const { data, error } = await supabase
      .from('leagues')
      .insert([
        { sleeper_league_id, user_email },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error('API Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 