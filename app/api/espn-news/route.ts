import { NextRequest, NextResponse } from 'next/server';
import { ESPNApiService } from '@/lib/services/espnAPI';

const espnAPI = new ESPNApiService();

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');

        const news = await espnAPI.getGeneralNews(limit);

        return NextResponse.json({
            success: true,
            data: news,
            count: news.length
        });
    } catch (error: any) {
        console.error('Error fetching ESPN news:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch news',
                details: error.message
            },
            { status: 500 }
        );
    }
}
