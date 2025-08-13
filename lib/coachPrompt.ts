import OpenAI from 'openai';
import { DraftRecommendation } from './types/draft';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCoachRecommendation(context: any): Promise<DraftRecommendation> {
    const systemPrompt = `You are a seasoned, old-school American football coach providing draft advice.
Stoic, direct, a little dry humor. Short sentences. No fluff. No condescension.
Use coachisms sparingly and only when they fit the logic (e.g., "Next man up", "Play the hand you're dealt", "Don't overthink it").
Decide first. Explain second. 140–200 words total. No lists in prose.
Return ONLY valid JSON per the provided schema. No extra text before or after.`;

    const userPrompt = buildDraftContextPrompt(context);

    try {
        console.log('🤖 Calling OpenAI for draft recommendation...');

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.6,
            max_tokens: 800,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        });

        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('Empty response from OpenAI');
        }

        // Parse JSON response
        const recommendation = JSON.parse(response);
        console.log('✅ AI recommendation generated successfully');

        return recommendation;

    } catch (error: any) {
        console.error('🚨 OpenAI error:', error);
        // Deterministic fallback
        return generateFallbackRecommendation(context);
    }
}

function buildDraftContextPrompt(context: any): string {
    const { league, draft, myTeam, scarcity } = context;
    const available = draft.available.slice(0, 10); // Top 10 candidates

    return `
DRAFT CONTEXT:
League: ${league.teams}-team ${league.format}
Roster: QB${league.roster.QB}/RB${league.roster.RB}/WR${league.roster.WR}/TE${league.roster.TE}/FLEX${league.roster.FLEX}
Pick: Round ${draft.round}, Pick ${draft.pickOverall} (${draft.picksUntilMe} picks until my next turn)

MY TEAM: ${myTeam.players.length > 0 ? myTeam.players.join(', ') : 'Empty (first pick)'}

POSITION SCARCITY (0-1, higher = scarcer):
- QB: ${scarcity.QB?.toFixed(2) || '0.00'}
- RB: ${scarcity.RB?.toFixed(2) || '0.00'} 
- WR: ${scarcity.WR?.toFixed(2) || '0.00'}
- TE: ${scarcity.TE?.toFixed(2) || '0.00'}

TOP AVAILABLE PLAYERS:
${available.map((p: any, i: number) =>
        `${i + 1}. ${p.name} (${p.position}, ${p.team}) - ADP: ${p.adp[league.format]}, Reach: ${p.draftContext.reach > 0 ? '+' : ''}${p.draftContext.reach}, Value: ${p.draftContext.valueScore}`
    ).join('\n')}

RESPONSE FORMAT (JSON only):
{
  "decision": "pick",
  "primary": {
    "playerId": "player_name",
    "reason": "2-3 sentence coach explanation with concrete reasoning",
    "fit": {
      "positionalNeed": "QB|RB|WR|TE|BPA",
      "byeImpact": "minimal|moderate|heavy"
    },
    "value": {
      "rank": number,
      "adp": number, 
      "reach": number,
      "scarcityScore": 0.0-1.0
    },
    "riskFlags": ["array", "of", "risk", "factors"],
    "coachism": "optional coach saying if it fits"
  },
  "alternates": [
    {"playerId": "backup_option", "reason": "brief explanation", "value": {"reach": number}, "riskFlags": []}
  ],
  "strategyNotes": ["brief strategy guidance for next picks"],
  "confidence": 50-95
}

Provide a decisive recommendation with concrete reasoning. Focus on value, scarcity, and team building.`;
}

function generateFallbackRecommendation(context: any): DraftRecommendation {
    const { draft } = context;
    const available = draft.available;

    if (!available || available.length === 0) {
        return {
            decision: 'pick',
            primary: {
                playerId: 'unknown',
                reason: 'No players available for analysis.',
                fit: { positionalNeed: 'BPA', byeImpact: 'minimal' },
                value: { rank: 0, adp: 0, reach: 0, scarcityScore: 0 },
                riskFlags: ['no_data'],
            },
            alternates: [],
            strategyNotes: ['System fallback engaged'],
            confidence: 50
        };
    }

    // Simple fallback: best value player
    const bestValue = available.sort((a: any, b: any) =>
        b.draftContext.valueScore - a.draftContext.valueScore
    )[0];

    return {
        decision: 'pick',
        primary: {
            playerId: bestValue.name,
            reason: `Best available value. Solid pick at this spot. Next man up.`,
            fit: {
                positionalNeed: bestValue.position,
                byeImpact: bestValue.draftContext.byeImpact || 'minimal'
            },
            value: {
                rank: 0,
                adp: bestValue.adp[context.league.format] || 0,
                reach: bestValue.draftContext.reach || 0,
                scarcityScore: bestValue.draftContext.scarcityScore || 0
            },
            riskFlags: ['fallback_mode'],
            coachism: 'Play the hand you\'re dealt.'
        },
        alternates: [],
        strategyNotes: ['System fallback - manual review recommended'],
        confidence: 60
    };
}
