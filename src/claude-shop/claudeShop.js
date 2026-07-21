import './claudeShop.css'

const BRIEF_OPTIONS = [
  {
    id: 'clean',
    label: 'THE CLEAN BRIEF',
    headline: 'Help new learners finish onboarding.',
    detail: 'Create a calm, mobile-first guide that reduces confusion at the payment step.',
    good: true,
  },
  {
    id: 'literal',
    label: 'THE DATA DUMP',
    headline: 'Include everything from every source.',
    detail: 'Turn all notes, charts, and opinions into one long document.',
    good: false,
  },
  {
    id: 'vague',
    label: 'THE VAGUE ASK',
    headline: 'Make onboarding better and premium.',
    detail: 'Use a modern treatment and make people love it.',
    good: false,
  },
]

const EVIDENCE_FRAGMENTS = [
  { id: 'funnel', label: 'FUNNEL REPORT', value: '67% leave at payment', source: 'Analytics · 14 days', good: true, mark: '67' },
  { id: 'sessions', label: 'SESSION REPLAYS', value: 'Fee field causes repeat taps', source: '38 observed sessions', good: true, mark: '38' },
  { id: 'interviews', label: 'LEARNER INTERVIEWS', value: '“I was unsure what came next.”', source: '8 recorded interviews', good: true, mark: '08' },
  { id: 'trend', label: 'TREND POST', value: 'Everyone uses glassmorphism', source: 'Unrelated social post', good: false, mark: '↗' },
  { id: 'opinion', label: 'TEAM OPINION', value: 'The page feels a bit boring', source: 'No supporting sample', good: false, mark: '?' },
  { id: 'old', label: 'OLD CAMPAIGN', value: 'A 2023 launch headline', source: 'Different audience', good: false, mark: '23' },
]

const ARTIFACT_OPTIONS = [
  { id: 'verified', label: 'BUILD + VERIFY', copy: 'Design the artifact, cite evidence, then run the checklist.', good: true, icon: '✓' },
  { id: 'pretty', label: 'POLISH ONLY', copy: 'Make it beautiful and skip the evidence trail.', good: false, icon: '◇' },
  { id: 'instant', label: 'SHIP FIRST DRAFT', copy: 'Export immediately without checking the result.', good: false, icon: '↗' },
]

const STORAGE_KEY = 'upgradverse-claude-skillshop'

function clampScore(value) {
  return Math.max(0, Math.min(100, value))
}

function briefSourceCards() {
  return `
    <div class="claude-source-card source-mail"><i>✦</i><span><b>PROJECT NOTE</b><small>Reduce onboarding drop-off</small></span></div>
    <div class="claude-source-card source-chart"><i>67</i><span><b>ANALYTICS</b><small>Payment is the friction point</small></span></div>
    <div class="claude-source-card source-voice"><i>“</i><span><b>INTERVIEWS</b><small>Learners need clearer next steps</small></span></div>
    <div class="claude-source-card source-brand"><i>Aa</i><span><b>BRAND GUIDE</b><small>Calm · useful · mobile-first</small></span></div>
  `
}

export function createClaudeSkillShop({ onExit = () => {}, onReward = () => {}, onHaptic = () => {} } = {}) {
  const root = document.createElement('section')
  root.className = 'claude-shop'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="claude-shop-grain"></div>
    <div class="claude-shop-sun sun-a"></div><div class="claude-shop-sun sun-b"></div>
    <div class="claude-shop-shell">
      <header class="claude-shop-header">
        <div class="claude-shop-brand"><i><span></span><span></span><span></span></i><div><b>CLAUDE</b><small>ARTIFACT STUDIO / SHOP 02</small></div></div>
        <div class="claude-shop-score"><span>CRAFT SCORE</span><strong data-score>000</strong></div>
        <button class="claude-shop-close" type="button" data-action="exit" aria-label="Exit Claude Skill Shop">×</button>
      </header>
      <div class="claude-shop-progress" aria-label="Claude Skill Shop progress">
        <div data-progress="0"><i>1</i><span>SYNTHESIZE</span></div><b></b>
        <div data-progress="1"><i>2</i><span>GROUND</span></div><b></b>
        <div data-progress="2"><i>3</i><span>CRAFT</span></div>
      </div>
      <main class="claude-shop-stage" aria-live="polite"></main>
      <footer class="claude-shop-footer"><span>D-PAD <b>MOVE</b> · CROSS <b>SELECT</b> · CIRCLE <b>EXIT</b></span><span>SIMULATED LEARNING EXPERIENCE · NO EXTERNAL API</span></footer>
    </div>
  `

  const mount = document.querySelector('#world-shell') || document.body
  mount.appendChild(root)

  const stage = root.querySelector('.claude-shop-stage')
  const scoreNode = root.querySelector('[data-score]')
  const progressNodes = [...root.querySelectorAll('[data-progress]')]
  const progressLines = [...root.querySelectorAll('.claude-shop-progress > b')]

  let open = false
  let screen = 'intro'
  let score = 0
  let synthesisAnswer = null
  let evidenceSelected = new Set()
  let evidenceSubmitted = false
  let artifactAnswer = null
  let gamepadIndex = 0
  let timers = []
  let rewardSent = false

  function schedule(callback, delay) {
    const timer = window.setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout)
    timers = []
  }

  function updateChrome(step = 0) {
    scoreNode.textContent = String(clampScore(score)).padStart(3, '0')
    progressNodes.forEach((node, index) => {
      node.classList.toggle('is-active', index <= step)
      node.classList.toggle('is-current', index === step)
    })
    progressLines.forEach((line, index) => line.classList.toggle('is-active', index < step))
  }

  function getGamepadControls() {
    return [...stage.querySelectorAll('[data-gamepad]:not([disabled])')]
  }

  function syncGamepadFocus(reset = false) {
    const controls = getGamepadControls()
    if (reset) gamepadIndex = 0
    gamepadIndex = Math.max(0, Math.min(gamepadIndex, Math.max(0, controls.length - 1)))
    controls.forEach((control, index) => control.classList.toggle('is-controller-focus', index === gamepadIndex))
    return controls
  }

  function renderIntro() {
    screen = 'intro'
    updateChrome(0)
    stage.innerHTML = `
      <div class="claude-intro">
        <section class="claude-intro-copy">
          <div class="claude-eyebrow"><span>02 MINUTE STUDIO</span><i></i><small>ONE BRIEF → ONE ARTIFACT</small></div>
          <h1>Turn scattered thinking<br />into something <em>clear.</em></h1>
          <p>Feed the studio. Keep the evidence. Craft the final artifact.</p>
          <div class="claude-intro-steps">
            <div><i>01</i><span><b>COMBINE</b><small>many sources</small></span></div>
            <b>→</b><div><i>02</i><span><b>GROUND</b><small>in evidence</small></span></div>
            <b>→</b><div><i>03</i><span><b>CREATE</b><small>and verify</small></span></div>
          </div>
          <button class="claude-primary" type="button" data-action="start" data-gamepad>ENTER ARTIFACT STUDIO <span>→</span></button>
        </section>
        <section class="claude-intro-machine" aria-hidden="true">
          <div class="intro-paper-stack">${briefSourceCards()}</div>
          <div class="intro-thread"><i></i><i></i><i></i></div>
          <div class="intro-artifact"><header><i></i><span></span></header><b></b><p></p><p></p><footer><span></span><span></span><span></span></footer></div>
          <div class="intro-seal">READY</div>
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function synthesisMachine(resolved, correct) {
    return `
      <div class="synthesis-machine ${resolved ? (correct ? 'is-clean' : 'is-corrected') : ''}">
        <div class="source-rail">${briefSourceCards()}</div>
        <div class="synthesis-core"><i></i><span>${resolved ? (correct ? 'SIGNAL LOCKED' : 'NOISE REMOVED') : 'SYNTHESIZING'}</span><b></b></div>
        <div class="brief-page">
          <span>CREATIVE BRIEF</span><h4>Clearer learner onboarding</h4>
          <div><i></i><i></i><i></i></div><p></p><p></p><small>${resolved ? 'OBJECTIVE · AUDIENCE · CONSTRAINT' : 'WAITING FOR YOUR DIRECTION'}</small>
        </div>
        <div class="moving-thread"><i></i><i></i><i></i><i></i></div>
      </div>
    `
  }

  function renderSynthesis() {
    screen = 'synthesis'
    updateChrome(0)
    const chosen = BRIEF_OPTIONS.find((option) => option.id === synthesisAnswer)
    const correct = chosen?.good === true
    stage.innerHTML = `
      <div class="claude-game-layout">
        <section class="claude-game-copy">
          <span class="claude-stage-number">STAGE 01 <b>SYNTHESIZE</b></span>
          <h2>Four sources.<br />One clear brief.</h2>
          <p>The studio has read the project note, analytics, interviews, and brand guide.</p>
          <div class="claude-move"><small>YOUR MOVE</small><strong>Choose the brief that preserves the shared signal.</strong></div>
          ${synthesisAnswer ? `<div class="claude-feedback ${correct ? 'is-good' : 'is-corrected'}"><i>${correct ? '✓' : '↻'}</i><span><b>${correct ? 'SIGNAL PRESERVED' : 'BRIEF REFINED'}</b><small>${correct ? 'The sources now point to one useful outcome.' : 'A strong synthesis is specific without becoming a data dump.'}</small></span></div>` : ''}
        </section>
        <section class="claude-game-board">
          ${synthesisMachine(Boolean(synthesisAnswer), correct)}
          ${synthesisAnswer ? `
            <div class="claude-resolution">
              <div><small>CLEAN BRIEF</small><strong>Help new learners finish onboarding.</strong><p>Build a calm, mobile-first guide focused on payment-step clarity.</p></div>
              <button class="claude-primary" type="button" data-action="next-evidence" data-gamepad>OPEN EVIDENCE DESK <span>→</span></button>
            </div>
          ` : `<div class="brief-options">${BRIEF_OPTIONS.map((option, index) => `
            <button type="button" data-brief="${option.id}" data-option data-gamepad><i>0${index + 1}</i><span><b>${option.label}</b><strong>${option.headline}</strong><small>${option.detail}</small></span></button>
          `).join('')}</div>`}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function evidenceDesk() {
    const selected = [...evidenceSelected]
    return `
      <div class="evidence-desk ${evidenceSubmitted ? 'is-running' : ''}">
        <div class="evidence-scale">
          <div class="scale-pan pan-signal"><i></i><span>SIGNAL</span><b>${selected.filter((id) => EVIDENCE_FRAGMENTS.find((item) => item.id === id)?.good).length}</b></div>
          <div class="scale-arm"><i></i><b></b></div>
          <div class="scale-pan pan-noise"><i></i><span>NOISE</span><b>${selected.filter((id) => !EVIDENCE_FRAGMENTS.find((item) => item.id === id)?.good).length}</b></div>
        </div>
        <div class="evidence-orbit">${selected.map((id, index) => {
          const item = EVIDENCE_FRAGMENTS.find((fragment) => fragment.id === id)
          return `<i class="${item.good ? 'is-signal' : 'is-noise'}" style="--slot:${index}">${item.mark}</i>`
        }).join('')}</div>
        <small>${evidenceSubmitted ? 'EVIDENCE WEIGHT CALCULATED' : `${selected.length}/3 FRAGMENTS PINNED`}</small>
      </div>
    `
  }

  function renderEvidence() {
    screen = 'evidence'
    updateChrome(1)
    const selected = [...evidenceSelected]
    const correctCount = selected.filter((id) => EVIDENCE_FRAGMENTS.find((item) => item.id === id)?.good).length
    const exact = correctCount === 3 && selected.length === 3
    stage.innerHTML = `
      <div class="claude-game-layout evidence-layout">
        <section class="claude-game-copy">
          <span class="claude-stage-number">STAGE 02 <b>GROUND</b></span>
          <h2>Keep proof.<br />Drop distraction.</h2>
          <p>Pin three fragments that directly support the brief.</p>
          <div class="claude-move"><small>YOUR MOVE</small><strong>Choose exactly three pieces of evidence.</strong></div>
          ${evidenceSubmitted ? `<div class="claude-feedback ${exact ? 'is-good' : 'is-corrected'}"><i>${exact ? '✓' : '↻'}</i><span><b>${exact ? 'EVIDENCE LOCKED' : 'NOISE FILTERED'}</b><small>${exact ? 'Every claim now has an observable source.' : `${correctCount}/3 selections were evidence. The studio removed unsupported fragments.`}</small></span></div>` : ''}
        </section>
        <section class="claude-game-board">
          ${evidenceDesk()}
          ${evidenceSubmitted ? `
            <div class="evidence-result">
              <div class="proof-chain"><i>67%</i><b></b><i>38</i><b></b><i>08</i><span>BRIEF GROUNDED</span></div>
              <button class="claude-primary" type="button" data-action="next-artifact" data-gamepad>CRAFT THE ARTIFACT <span>→</span></button>
            </div>
          ` : `
            <div class="fragment-grid">${EVIDENCE_FRAGMENTS.map((item) => `
              <button type="button" class="${evidenceSelected.has(item.id) ? 'is-selected' : ''}" data-evidence="${item.id}" data-option data-gamepad>
                <i>${item.mark}</i><span><b>${item.label}</b><strong>${item.value}</strong><small>${item.source}</small></span>
              </button>
            `).join('')}</div>
            <button class="claude-primary evidence-submit ${selected.length === 3 ? '' : 'is-disabled'}" type="button" data-action="submit-evidence" data-gamepad ${selected.length === 3 ? '' : 'disabled'}>WEIGH THE EVIDENCE <span>⌁</span></button>
          `}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function artifactPreview(resolved, correct) {
    return `
      <div class="artifact-workbench ${resolved ? (correct ? 'is-verified' : 'is-repaired') : ''}">
        <div class="workbench-brief"><span>BRIEF</span><h4>Clear payment steps</h4><i></i><i></i><i></i></div>
        <div class="workbench-engine"><i></i><b>${resolved ? (correct ? 'VERIFIED' : 'QA ADDED') : 'CRAFTING'}</b><span></span></div>
        <div class="workbench-artifact">
          <header><i>●</i><span>LEARNER GUIDE</span><b>01 / 03</b></header>
          <div class="artifact-hero"><small>NEXT STEP</small><h3>Review your fees.<br />Then confirm.</h3><button type="button" tabindex="-1">CONTINUE →</button></div>
          <div class="artifact-proof"><i>✓</i><span><b>Source-linked guidance</b><small>Analytics · sessions · interviews</small></span></div>
          <div class="artifact-checks"><i></i><i></i><i></i></div>
          ${resolved ? '<div class="verified-stamp">QA<br />PASS</div>' : ''}
        </div>
        <div class="craft-particles">${'<i></i>'.repeat(9)}</div>
      </div>
    `
  }

  function renderArtifact() {
    screen = 'artifact'
    updateChrome(2)
    const chosen = ARTIFACT_OPTIONS.find((option) => option.id === artifactAnswer)
    const correct = chosen?.good === true
    stage.innerHTML = `
      <div class="claude-game-layout artifact-layout">
        <section class="claude-game-copy">
          <span class="claude-stage-number">STAGE 03 <b>CRAFT</b></span>
          <h2>Make it useful.<br />Then prove it.</h2>
          <p>The brief is ready to become a polished learner artifact.</p>
          <div class="claude-move"><small>YOUR MOVE</small><strong>Choose the final production route.</strong></div>
          ${artifactAnswer ? `<div class="claude-feedback ${correct ? 'is-good' : 'is-corrected'}"><i>${correct ? '✓' : '↻'}</i><span><b>${correct ? 'ARTIFACT VERIFIED' : 'QA LOOP ADDED'}</b><small>${correct ? 'Craft and evidence survived the final check.' : 'Polish is not done until the output is checked against the brief.'}</small></span></div>` : ''}
        </section>
        <section class="claude-game-board">
          ${artifactPreview(Boolean(artifactAnswer), correct)}
          ${artifactAnswer ? `<button class="claude-primary finish-button" type="button" data-action="finish" data-gamepad>REVEAL CRAFT SCORE <span>→</span></button>` : `
            <div class="artifact-options">${ARTIFACT_OPTIONS.map((option, index) => `
              <button type="button" data-artifact="${option.id}" data-option data-gamepad><i>${option.icon}</i><span><b>${option.label}</b><small>${option.copy}</small></span><em>0${index + 1}</em></button>
            `).join('')}</div>
          `}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function renderResult() {
    screen = 'result'
    updateChrome(2)
    score = clampScore(score)
    const badge = score >= 85 ? 'ARTIFACT ARCHITECT' : score >= 60 ? 'SIGNAL EDITOR' : 'BRIEF APPRENTICE'
    const saved = { completed: true, score, badge, completedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    if (!rewardSent) {
      rewardSent = true
      onReward(saved)
    }
    stage.innerHTML = `
      <div class="claude-result">
        <div class="result-canvas">
          <div class="result-pages"><i></i><i></i><div><span>CLAUDE SKILL CORE</span><b>CA</b><small>BRIEF → EVIDENCE → ARTIFACT</small></div></div>
          <div class="result-orbit"><i></i><i></i><i></i></div>
          <div class="result-seal">VERIFIED</div>
        </div>
        <span class="claude-stage-number">SKILL CORE UNLOCKED</span>
        <h1>${badge}</h1>
        <p>You turned scattered sources into a focused brief, grounded it in evidence, and verified the finished artifact.</p>
        <div class="claude-final-score"><strong>${String(score).padStart(3, '0')}</strong><span>/ 100<br /><b>ARTIFACT CRAFT</b></span></div>
        <div class="claude-result-actions"><button class="claude-primary" type="button" data-action="return" data-gamepad>RETURN TO UPGRADVERSE <span>→</span></button><button class="claude-secondary" type="button" data-action="replay" data-gamepad>REPLAY STUDIO</button></div>
      </div>
    `
    onHaptic('success')
    syncGamepadFocus(true)
  }

  function chooseBrief(id) {
    if (synthesisAnswer) return
    synthesisAnswer = id
    const correct = BRIEF_OPTIONS.find((option) => option.id === id)?.good === true
    score += correct ? 35 : 12
    onHaptic(correct ? 'success' : 'impact')
    renderSynthesis()
  }

  function toggleEvidence(id) {
    if (evidenceSubmitted) return
    if (evidenceSelected.has(id)) evidenceSelected.delete(id)
    else if (evidenceSelected.size < 3) evidenceSelected.add(id)
    onHaptic('select')
    renderEvidence()
  }

  function submitEvidence() {
    if (evidenceSelected.size !== 3 || evidenceSubmitted) return
    const correctCount = [...evidenceSelected].filter((id) => EVIDENCE_FRAGMENTS.find((item) => item.id === id)?.good).length
    score += correctCount === 3 ? 30 : correctCount === 2 ? 18 : 8
    evidenceSubmitted = true
    onHaptic(correctCount === 3 ? 'success' : 'impact')
    renderEvidence()
  }

  function chooseArtifact(id) {
    if (artifactAnswer) return
    artifactAnswer = id
    const correct = ARTIFACT_OPTIONS.find((option) => option.id === id)?.good === true
    score += correct ? 35 : 12
    onHaptic(correct ? 'success' : 'impact')
    renderArtifact()
  }

  function reset() {
    clearTimers()
    screen = 'intro'
    score = 0
    synthesisAnswer = null
    evidenceSelected = new Set()
    evidenceSubmitted = false
    artifactAnswer = null
    gamepadIndex = 0
    rewardSent = false
  }

  function exit() {
    if (!open) return
    clearTimers()
    open = false
    root.classList.remove('is-visible')
    root.setAttribute('aria-hidden', 'true')
    schedule(() => { root.style.visibility = 'hidden' }, 420)
    onExit()
  }

  function launch() {
    reset()
    open = true
    root.style.visibility = 'visible'
    root.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => root.classList.add('is-visible'))
    renderIntro()
    onHaptic('success')
  }

  root.addEventListener('click', (event) => {
    const control = event.target.closest('button')
    if (!control || !root.contains(control)) return
    if (control.dataset.brief) chooseBrief(control.dataset.brief)
    else if (control.dataset.evidence) toggleEvidence(control.dataset.evidence)
    else if (control.dataset.artifact) chooseArtifact(control.dataset.artifact)
    else if (control.dataset.action === 'start') renderSynthesis()
    else if (control.dataset.action === 'next-evidence') renderEvidence()
    else if (control.dataset.action === 'submit-evidence') submitEvidence()
    else if (control.dataset.action === 'next-artifact') renderArtifact()
    else if (control.dataset.action === 'finish') renderResult()
    else if (control.dataset.action === 'return' || control.dataset.action === 'exit') exit()
    else if (control.dataset.action === 'replay') { reset(); renderIntro() }
  })

  function moveGamepadFocus(direction) {
    const controls = syncGamepadFocus()
    if (!controls.length) return
    gamepadIndex = (gamepadIndex + direction + controls.length) % controls.length
    syncGamepadFocus()
    onHaptic('select')
  }

  function handleGamepad(event) {
    if (!open) return false
    if ([12, 14].includes(event.index)) moveGamepadFocus(-1)
    else if ([13, 15].includes(event.index)) moveGamepadFocus(1)
    else if (event.index === 0) syncGamepadFocus()[gamepadIndex]?.click()
    else if (event.index === 1) exit()
    return true
  }

  function handleKey(event) {
    if (!open) return false
    if (event.code === 'Escape') exit()
    else if (['ArrowLeft', 'ArrowUp'].includes(event.code)) moveGamepadFocus(-1)
    else if (['ArrowRight', 'ArrowDown', 'Tab'].includes(event.code)) moveGamepadFocus(1)
    else if (event.code === 'Enter' || event.code === 'Space') syncGamepadFocus()[gamepadIndex]?.click()
    else if (/^Digit[1-6]$/.test(event.code)) stage.querySelectorAll('[data-option]')[Number(event.code.slice(-1)) - 1]?.click()
    event.preventDefault()
    return true
  }

  return { launch, exit, isOpen: () => open, handleGamepad, handleKey }
}
