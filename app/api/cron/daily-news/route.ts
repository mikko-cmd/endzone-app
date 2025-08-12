import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        console.log('🚀 Running daily news scan...');

        const { stdout, stderr } = await execAsync('npx tsx scripts/dailyNewsScanner.ts');

        console.log('News scan output:', stdout);
        if (stderr) console.warn('News scan warnings:', stderr);

        return NextResponse.json({
            success: true,
            message: 'Daily news scan completed',
            output: stdout
        });

    } catch (error: any) {
        console.error('Daily news scan failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
}
