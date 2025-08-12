import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log('🧪 Testing simple API route...');
        return NextResponse.json({ message: 'Simple test works!' });
    } catch (error) {
        console.error('❌ Simple test failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
