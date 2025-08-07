'use client';

export default function FootballFieldBackground() {
    console.log('FootballFieldBackground component is rendering');

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to bottom, #1a472a 0%, #0d2e1a 50%, #000000 100%)',
                zIndex: -1
            }}
        >
            {/* Super simple test */}
            <div style={{
                position: 'absolute',
                top: '50px',
                left: '50px',
                width: '100px',
                height: '100px',
                backgroundColor: 'yellow',
                border: '5px solid red'
            }}>
                FOOTBALL FIELD TEST
            </div>
        </div>
    );
}
