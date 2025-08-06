import { NextResponse } from 'next/server';

// This endpoint can be called by a cron service (like Vercel Cron or external cron)
export async function GET() {
  try {
    console.log('🕐 Cron job: Processing players...');

    // Call the auto-processing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/players/auto-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 20 }) // Process more players in cron jobs
    });

    if (!response.ok) {
      throw new Error(`Auto-processing failed: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Cron job completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Cron job completed successfully',
      ...result
    });

  } catch (error: any) {
    console.error('❌ Cron job failed:', error.message);
    return NextResponse.json(
      { success 