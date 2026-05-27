import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const CANDIDATE_SYSTEM = `You are an expert HR analyst. Analyse the fit between a job description and a candidate's CV.

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "score": number (0–100),
  "scoreLabel": "Excellent" | "Strong" | "Good" | "Fair" | "Weak",
  "scoreSummary": string (2 sentences summarising overall fit),
  "matchedSkills": string[],
  "partialSkills": string[],
  "missingSkills": string[],
  "suggestions": string[] (4 specific, actionable suggestions)
}

Thresholds: 0–39 Weak · 40–59 Fair · 60–74 Good · 75–89 Strong · 90–100 Excellent.`

const RECRUITER_SYSTEM = `You are an expert HR analyst. Evaluate the fit between a job description and a candidate's CV.

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "score": number (0–100),
  "scoreLabel": "Excellent" | "Strong" | "Good" | "Fair" | "Weak",
  "scoreSummary": string (2 sentences),
  "matchedSkills": string[],
  "partialSkills": string[],
  "missingSkills": string[],
  "suggestions": string[] (3 suggestions)
}

Thresholds: 0–39 Weak · 40–59 Fair · 60–74 Good · 75–89 Strong · 90–100 Excellent.`

function parseResult(text: string) {
  const clean = text.trim()
  try { return JSON.parse(clean) } catch { /* try extraction */ }
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* fall through */ } }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, jd, cv, name, score, matchedSkills, missingSkills } = body

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not set in the environment.' },
      { status: 500 },
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── Cover letter ────────────────────────────────────────────────────────────
  if (mode === 'cover') {
    const prompt = `Write a professional 3-paragraph cover letter for this candidate.
Match score: ${score}%. Top matched skills: ${(matchedSkills ?? []).slice(0, 5).join(', ')}. Gaps to address: ${(missingSkills ?? []).slice(0, 3).join(', ')}.
Return only the three paragraphs — no subject line, no salutation, no sign-off.

JOB DESCRIPTION:
${jd}

CANDIDATE CV:
${cv}`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return Response.json({ coverLetter: text })
  }

  // ── Match analysis ──────────────────────────────────────────────────────────
  if (!jd?.trim() || !cv?.trim()) {
    return Response.json({ error: 'Missing job description or CV.' }, { status: 400 })
  }

  const userMsg = `Job Description:\n${jd}\n\nCandidate CV${name ? ` (${name})` : ''}:\n${cv}`

  const msg = await client.messages.create({
    model: mode === 'recruiter' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: mode === 'recruiter' ? RECRUITER_SYSTEM : CANDIDATE_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const text   = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const result = parseResult(text)
  if (result) return Response.json(result)

  return Response.json({ error: 'Failed to parse AI response.' }, { status: 500 })
}
