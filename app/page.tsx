'use client'

import { useState } from 'react'

type Mode = 'candidate' | 'recruiter'

type CandidateResult = {
  score: number
  scoreLabel: string
  scoreSummary: string
  matchedSkills: string[]
  partialSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}

type CandidateEntry = { id: number; name: string; cv: string }

type RecruiterResult = {
  name: string
  score: number
  scoreLabel: string
  scoreSummary: string
  matchedSkills: string[]
  partialSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 75 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'
}

function scoreCircleColors(s: number): [string, string, string] {
  return s >= 75
    ? ['var(--green-bg)', 'var(--green-border)', 'var(--green)']
    : s >= 50
    ? ['var(--amber-bg)', 'var(--amber-border)', 'var(--amber)']
    : ['var(--red-bg)', 'var(--red-border)', 'var(--red)']
}

function Spinner({ color = '#fff' }: { color?: string }) {
  return (
    <div style={{
      width: 18, height: 18, flexShrink: 0,
      border: `2.5px solid ${color}55`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

const TA: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6,
  padding: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface)',
  color: 'var(--text)',
  resize: 'vertical',
  minHeight: 200,
  transition: 'border-color .15s',
  outline: 'none',
  width: '100%',
  display: 'block',
}

const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 600,
  color: 'var(--text2)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  display: 'block',
  marginBottom: 6,
}

const SECTION_HEAD: React.CSSProperties = {
  fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--text3)',
  marginBottom: 8,
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MatchIQPage() {
  const [mode, setMode] = useState<Mode>('candidate')

  // Candidate
  const [jd, setJd]                       = useState('')
  const [cv, setCv]                       = useState('')
  const [candLoading, setCandLoading]     = useState(false)
  const [candResult, setCandResult]       = useState<CandidateResult | null>(null)
  const [candError, setCandError]         = useState<string | null>(null)
  const [coverLoading, setCoverLoading]   = useState(false)
  const [coverLetter, setCoverLetter]     = useState<string | null>(null)
  const [coverError, setCoverError]       = useState<string | null>(null)

  // Recruiter
  const [recJd, setRecJd]               = useState('')
  const [candidates, setCandidates]     = useState<CandidateEntry[]>([
    { id: 1, name: '', cv: '' },
    { id: 2, name: '', cv: '' },
  ])
  const [nextId, setNextId]             = useState(3)
  const [recLoading, setRecLoading]     = useState(false)
  const [progress, setProgress]         = useState<{ done: number; total: number; name: string } | null>(null)
  const [recResults, setRecResults]     = useState<RecruiterResult[]>([])
  const [recError, setRecError]         = useState<string | null>(null)
  const [expanded, setExpanded]         = useState<Set<number>>(new Set())

  // ── API call ────────────────────────────────────────────────────────────────

  async function api(body: Record<string, unknown>) {
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }

  // ── Candidate ───────────────────────────────────────────────────────────────

  async function runCandidate() {
    if (!jd.trim() || !cv.trim()) {
      setCandError('Please fill in both the job description and your CV before analysing.')
      return
    }
    setCandError(null)
    setCandLoading(true)
    setCandResult(null)
    setCoverLetter(null)
    setCoverError(null)
    try {
      const d = await api({ mode: 'candidate', jd, cv })
      setCandResult({ ...d, score: Math.round(d.score) })
    } catch (e) {
      const msg = (e as Error).message
      setCandError(msg)
    }
    setCandLoading(false)
  }

  async function genCoverLetter() {
    if (!candResult) return
    setCoverLoading(true)
    setCoverError(null)
    try {
      const d = await api({
        mode: 'cover', jd, cv,
        score: candResult.score,
        matchedSkills: candResult.matchedSkills,
        missingSkills: candResult.missingSkills,
      })
      setCoverLetter(d.coverLetter)
    } catch (e) {
      setCoverError((e as Error).message)
    }
    setCoverLoading(false)
  }

  // ── Recruiter ───────────────────────────────────────────────────────────────

  function addCandidate() {
    if (candidates.length >= 10) return
    setCandidates(p => [...p, { id: nextId, name: '', cv: '' }])
    setNextId(n => n + 1)
  }

  function removeCand(id: number) {
    setCandidates(p => p.filter(c => c.id !== id))
  }

  function updateCand(id: number, field: 'name' | 'cv', val: string) {
    setCandidates(p => p.map(c => c.id === id ? { ...c, [field]: val } : c))
  }

  async function runRecruiter() {
    const valid = candidates.filter(c => c.cv.trim())
    if (!recJd.trim())         { setRecError('Please paste a job description.'); return }
    if (valid.length === 0)    { setRecError('Please add at least one candidate with a CV.'); return }
    setRecError(null)
    setRecLoading(true)
    setRecResults([])
    setExpanded(new Set())

    const results: RecruiterResult[] = []
    for (let i = 0; i < valid.length; i++) {
      const c    = valid[i]
      const name = c.name.trim() || `Candidate ${i + 1}`
      setProgress({ done: i + 1, total: valid.length, name })
      try {
        const d = await api({ mode: 'recruiter', jd: recJd, cv: c.cv, name })
        results.push({ ...d, name, score: Math.round(d.score) })
      } catch (e) {
        results.push({
          name, score: 0, scoreLabel: 'Error',
          scoreSummary: (e as Error).message,
          matchedSkills: [], partialSkills: [], missingSkills: [], suggestions: [],
        })
      }
    }

    results.sort((a, b) => b.score - a.score)
    setRecResults(results)
    setRecLoading(false)
    setProgress(null)
  }

  function toggleRow(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function exportCSV() {
    const header = ['Rank', 'Name', 'Score', 'Label', 'Summary', 'Matched Skills', 'Missing Skills']
    const rows   = recResults.map((r, i) => [
      i + 1, r.name, r.score, r.scoreLabel,
      (r.scoreSummary || '').replace(/,/g, ';'),
      (r.matchedSkills || []).join('; '),
      (r.missingSkills || []).join('; '),
    ])
    const csv  = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'matchiq-ranking.csv',
    })
    a.click()
  }

  const medals = ['🥇', '🥈', '🥉']

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Header ── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 60, display: 'flex', alignItems: 'center', gap: 24,
        }}>
          <div style={{
            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: 18, fontWeight: 500,
            color: 'var(--text)', letterSpacing: '-.02em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--blue)', flexShrink: 0, display: 'inline-block',
            }} />
            MatchIQ
          </div>

          <div style={{
            display: 'flex', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2,
          }}>
            {(['candidate', 'recruiter'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                padding: '5px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
                transition: 'all .15s',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? (m === 'candidate' ? 'var(--blue)' : 'var(--green)') : 'var(--text2)',
                boxShadow: mode === m ? 'var(--shadow)' : 'none',
              }}>
                {m === 'candidate' ? 'Candidate' : 'Recruiter'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* ──────────── CANDIDATE ──────────── */}
        {mode === 'candidate' && (
          <div>
            {candError && <Alert msg={candError} />}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Job description</label>
                <textarea
                  value={jd} onChange={e => setJd(e.target.value)}
                  placeholder="Paste the full job posting here…"
                  style={TA}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--blue)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={LABEL}>Your CV / skills summary</label>
                <textarea
                  value={cv} onChange={e => setCv(e.target.value)}
                  placeholder="Paste your CV, skills, or experience summary here…"
                  style={TA}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--blue)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>

            <button onClick={runCandidate} disabled={candLoading} style={{
              width: '100%', padding: 14,
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius)',
              cursor: candLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--blue)', color: '#fff',
              opacity: candLoading ? .55 : 1, transition: 'all .2s', marginTop: 4,
            }}>
              {candLoading ? <><Spinner />Analysing…</> : 'Analyse match'}
            </button>

            {candResult && (
              <div style={{ marginTop: 28, animation: 'fadeUp .25s ease' }}>

                {/* Score card */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: 24,
                  display: 'flex', alignItems: 'center', gap: 24,
                  marginBottom: 16, boxShadow: 'var(--shadow)',
                }}>
                  <ScoreCircle score={candResult.score} label={candResult.scoreLabel} />
                  <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>
                    {candResult.scoreSummary}
                  </p>
                </div>

                {/* Skill grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { title: 'Matched skills',         skills: candResult.matchedSkills, cls: 'matched', c: 'var(--green)' },
                    { title: 'Partial / transferable',  skills: candResult.partialSkills,  cls: 'partial', c: 'var(--amber)' },
                    { title: 'Gaps to address',         skills: candResult.missingSkills,  cls: 'missing', c: 'var(--red)' },
                  ].map(({ title, skills, cls, c }) => (
                    <div key={title} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: 16, boxShadow: 'var(--shadow)',
                    }}>
                      <h4 style={{ ...SECTION_HEAD, color: c }}>{title}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {skills.length > 0
                          ? skills.map(s => <span key={s} className={`tag ${cls}`}>{s}</span>)
                          : <span style={{ fontSize: 13, color: 'var(--text3)' }}>None identified</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: 20,
                  boxShadow: 'var(--shadow)', marginBottom: 16,
                }}>
                  <h4 style={{ ...SECTION_HEAD, color: 'var(--text2)' }}>Tailored suggestions</h4>
                  {candResult.suggestions.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, padding: '10px 0',
                      borderBottom: i < candResult.suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 14, color: 'var(--text2)', lineHeight: 1.5,
                    }}>
                      <span style={{ color: 'var(--blue)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>→</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                {/* Cover letter */}
                <button onClick={genCoverLetter} disabled={coverLoading} style={{
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  padding: '10px 20px',
                  border: '1px solid var(--blue-border)', borderRadius: 8,
                  color: 'var(--blue)', background: 'var(--blue-bg)',
                  cursor: coverLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: coverLoading ? .5 : 1, transition: 'all .15s',
                }}>
                  {coverLoading
                    ? <><Spinner color="var(--blue)" />Generating…</>
                    : (coverLetter ? '↻ Regenerate cover letter' : '✦ Generate cover letter')
                  }
                </button>

                {coverError && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--red)' }}>{coverError}</p>}

                {coverLetter && (
                  <pre style={{
                    marginTop: 14, fontSize: 14, color: 'var(--text2)',
                    lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: 20, boxShadow: 'var(--shadow)',
                  }}>
                    {coverLetter}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──────────── RECRUITER ──────────── */}
        {mode === 'recruiter' && (
          <div>
            {recError && <Alert msg={recError} />}

            {/* JD */}
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Job description</label>
              <textarea
                value={recJd} onChange={e => setRecJd(e.target.value)}
                placeholder="Paste the job description here…"
                style={{ ...TA, minHeight: 140 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>

            {/* Candidates */}
            <h3 style={{ ...SECTION_HEAD, marginBottom: 10 }}>Candidates</h3>
            {candidates.map((c) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr auto',
                gap: 10, alignItems: 'start', marginBottom: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: 14, boxShadow: 'var(--shadow)',
              }}>
                <input
                  type="text" placeholder="Candidate name"
                  value={c.name} onChange={e => updateCand(c.id, 'name', e.target.value)}
                  style={{
                    fontFamily: 'inherit', fontSize: 14, padding: '9px 12px',
                    border: '1px solid var(--border)', borderRadius: 8,
                    outline: 'none', color: 'var(--text)', background: 'var(--bg)', width: '100%',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <textarea
                  value={c.cv} onChange={e => updateCand(c.id, 'cv', e.target.value)}
                  placeholder="Paste CV or skills summary…"
                  style={{ ...TA, minHeight: 90, fontSize: 13 }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                {candidates.length > 1 && (
                  <button onClick={() => removeCand(c.id)} style={{
                    fontSize: 20, color: 'var(--text3)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '4px 6px', borderRadius: 6, lineHeight: 1,
                    transition: 'all .15s', alignSelf: 'flex-start', marginTop: 2,
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)' }}
                  onMouseOut={e =>  { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'none' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button onClick={addCandidate} style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              padding: '9px 18px',
              border: '1.5px dashed var(--border)', borderRadius: 8,
              background: 'none', color: 'var(--text2)', cursor: 'pointer',
              transition: 'all .15s', marginBottom: 16, display: 'block',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'var(--green-bg)' }}
            onMouseOut={e =>  { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'none' }}
            >
              + Add candidate
            </button>

            <button onClick={runRecruiter} disabled={recLoading} style={{
              width: '100%', padding: 14,
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius)',
              cursor: recLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--green)', color: '#fff',
              opacity: recLoading ? .55 : 1, transition: 'all .2s',
            }}>
              {recLoading ? <><Spinner />Ranking…</> : 'Rank candidates'}
            </button>

            {/* Progress */}
            {progress && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 12, color: 'var(--text2)', marginBottom: 8,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                }}>
                  Analysing {progress.name} ({progress.done} of {progress.total})…
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: 'var(--green)', borderRadius: 4,
                    width: `${(progress.done / progress.total) * 100}%`,
                    transition: 'width .3s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {recResults.length > 0 && (
              <div style={{ marginTop: 28, animation: 'fadeUp .25s ease' }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)', marginBottom: 16,
                }}>
                  {/* LB header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '48px 1fr 90px 1fr 1fr 80px',
                    padding: '10px 20px',
                    background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '.06em', color: 'var(--text3)',
                  }}>
                    {['Rank', 'Name', 'Score', 'Top strengths', 'Key gaps', ''].map(h => (
                      <span key={h}>{h}</span>
                    ))}
                  </div>

                  {/* LB rows */}
                  {recResults.map((r, i) => {
                    const isTop  = i === 0
                    const isOpen = expanded.has(i)
                    const top3   = (r.matchedSkills || []).slice(0, 3)
                    const top2   = (r.missingSkills  || []).slice(0, 2)
                    const isLast = i === recResults.length - 1
                    return (
                      <div key={i}>
                        <div
                          onClick={() => toggleRow(i)}
                          style={{
                            display: 'grid', gridTemplateColumns: '48px 1fr 90px 1fr 1fr 80px',
                            padding: '14px 20px', alignItems: 'center', cursor: 'pointer',
                            background: isTop ? 'var(--green-bg)' : 'var(--surface)',
                            borderBottom: (!isOpen && !isLast) ? '1px solid var(--border)' : 'none',
                            transition: 'background .1s',
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = isTop ? '#d1fae5' : 'var(--bg)' }}
                          onMouseOut={e =>  { e.currentTarget.style.background = isTop ? 'var(--green-bg)' : 'var(--surface)' }}
                        >
                          <span style={{
                            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: 13,
                            fontWeight: i === 0 ? 700 : 500,
                            color: i === 0 ? '#b45309' : 'var(--text2)',
                          }}>
                            {medals[i] ?? i + 1}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                          <span style={{
                            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: 15, fontWeight: 600,
                            color: scoreColor(r.score),
                          }}>
                            {r.score}%
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {top3.length > 0
                              ? top3.map(s => <span key={s} className="lb-tag pos">{s}</span>)
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {top2.length > 0
                              ? top2.map(s => <span key={s} className="lb-tag neg">{s}</span>)
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); toggleRow(i) }}
                            style={{
                              fontFamily: 'inherit', fontSize: 12, padding: '5px 12px',
                              border: '1px solid var(--border)', borderRadius: 6,
                              background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer',
                              transition: 'all .15s',
                            }}
                          >
                            {isOpen ? 'Close' : 'Details'}
                          </button>
                        </div>

                        {isOpen && (
                          <div style={{
                            background: 'var(--surface2)',
                            borderTop: '1px solid var(--border)',
                            borderBottom: !isLast ? '1px solid var(--border)' : 'none',
                            padding: '16px 20px', animation: 'fadeUp .2s ease',
                          }}>
                            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                              {r.scoreSummary}
                            </p>
                            <p style={SECTION_HEAD}>Matched skills</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                              {(r.matchedSkills || []).map(s => <span key={s} className="tag matched">{s}</span>)}
                              {(r.matchedSkills || []).length === 0 && <span style={{ color: 'var(--text3)' }}>—</span>}
                            </div>
                            <p style={SECTION_HEAD}>Gaps</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                              {(r.missingSkills || []).map(s => <span key={s} className="tag missing">{s}</span>)}
                              {(r.missingSkills || []).length === 0 && <span style={{ color: 'var(--text3)' }}>—</span>}
                            </div>
                            <p style={SECTION_HEAD}>Suggestions</p>
                            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                              {(r.suggestions || []).map((s, si) => (
                                <div key={si}>• {s}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button onClick={exportCSV} style={{
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#fff' }}
                onMouseOut={e =>  { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  Export to CSV
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Alert({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 14,
      border: '1px solid var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)',
    }}>
      {msg}
    </div>
  )
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const [bg, border, color] = scoreCircleColors(score)
  return (
    <div style={{
      width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, background: bg, border: `2px solid ${border}`, color,
    }}>
      <span style={{ fontSize: 28, lineHeight: 1, fontFamily: 'var(--font-dm-mono, monospace)' }}>
        {score}%
      </span>
      <span style={{ fontSize: 11, marginTop: 2, fontWeight: 500, opacity: .8 }}>
        {label}
      </span>
    </div>
  )
}
