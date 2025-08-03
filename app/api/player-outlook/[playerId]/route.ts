import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // In a real app, you would use the playerId to look up the player
    // and then generate an outlook using an AI service.
    // For now, we'll return a hardcoded outlook.

    const mockOutlook = "After a somewhat disappointing 2023 season, Trevor Lawrence enters 2024 with a revamped receiving corps, including rookie Brian Thomas Jr. and Gabe Davis. While his fantasy production has been inconsistent, his talent remains undeniable. For 2024, Lawrence is best viewed as a high-upside QB2. If he can reduce turnovers and take advantage of his new weapons, he has the potential to creep into the low-end QB1 conversation. He's a strong bye-week fill-in and a worthy gamble as a second quarterback in Superflex leagues.";

    return NextResponse.json({ success: true, outlook: mockOutlook }, { status: 200 });
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
