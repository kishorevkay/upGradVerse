import './skillshop.css'

const MODELS = [
  { id: 'sol', name: 'SOL', slug: 'gpt-5.6-sol', role: 'DEEPEST THINKING', copy: 'Complex reasoning + coding', tone: '#f4f1eb' },
  { id: 'terra', name: 'TERRA', slug: 'gpt-5.6-terra', role: 'BALANCED BUILDER', copy: 'Strong quality + sensible cost', tone: '#10a37f' },
  { id: 'luna', name: 'LUNA', slug: 'gpt-5.6-luna', role: 'FAST AT SCALE', copy: 'Efficient repetitive workloads', tone: '#9f8cff' },
]

const ROUTING_MISSIONS = [
  {
    tag: 'LAUNCH BLOCKER',
    title: 'A checkout is broken across four repositories.',
    copy: 'This task has unknowns, connected systems, and production risk.',
    question: 'Pick the deepest problem-solver.',
    visual: 'repo',
    correct: 'sol',
    terminal: ['scanning 4 repositories', 'reasoning across payment boundaries', 'frontier execution selected'],
  },
  {
    tag: 'PRODUCT SPRINT',
    title: 'A clear dashboard brief needs a polished build.',
    copy: 'The direction is known. Strong quality and sensible everyday cost both matter.',
    question: 'Pick the balanced builder.',
    visual: 'dashboard',
    correct: 'terra',
    terminal: ['loading product brief', 'balancing quality and throughput', 'balanced builder selected'],
  },
  {
    tag: 'SCALE JOB',
    title: '8,000 clean rows need the same simple decision.',
    copy: 'The rules are fixed. Speed, volume, and efficiency matter most.',
    question: 'Pick the high-volume engine.',
    visual: 'rows',
    correct: 'luna',
    terminal: ['validating fixed schema', 'batch workload detected', 'efficient high-volume lane selected'],
  },
]

const CONTEXT_TILES = [
  { id: 'objective', label: 'OBJECTIVE', copy: 'What must be delivered', good: true, icon: '01' },
  { id: 'files', label: 'RELEVANT FILES', copy: 'Where the work lives', good: true, icon: '02' },
  { id: 'success', label: 'SUCCESS TEST', copy: 'How done is verified', good: true, icon: '03' },
  { id: 'history', label: 'EVERY CHAT LOG', copy: 'Noise without routing', good: false, icon: '×' },
  { id: 'secret', label: 'RAW API KEY', copy: 'Never place secrets in context', good: false, icon: '!' },
]

const TERMINAL_ACTIONS = [
  { id: 'ship', label: 'SHIP ANYWAY', copy: 'Ignore the red test', good: false },
  { id: 'patch', label: 'PATCH + RETEST', copy: 'Repair the failing path', good: true },
  { id: 'rewrite', label: 'REWRITE ALL', copy: 'Discard working code', good: false },
]

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
}

function missionVisual(mission, resolved = false, correct = false) {
  const scenes = {
    repo: `
      <div class="visual-repos"><i>cart</i><i>pay</i><i>tax</i><i>test</i><b>!</b></div>
      <div class="visual-caption"><span>4 CONNECTED SYSTEMS</span><strong>HIGH COMPLEXITY</strong></div>`,
    dashboard: `
      <div class="visual-dashboard"><i></i><i></i><i></i><b><span></span><span></span><span></span><span></span></b></div>
      <div class="visual-caption"><span>CLEAR PRODUCT BRIEF</span><strong>BALANCE QUALITY + COST</strong></div>`,
    rows: `
      <div class="visual-rows"><b>8,000</b><span>${'<i></i>'.repeat(18)}</span></div>
      <div class="visual-caption"><span>ONE FIXED RULE</span><strong>HIGH VOLUME</strong></div>`,
  }
  return `<div class="mission-visual visual-${mission.visual} ${resolved ? (correct ? 'is-routed' : 'is-corrected') : ''}">
    <div class="visual-scan"></div>${scenes[mission.visual]}
    ${resolved ? `<div class="route-beam"><i></i><span>${correct ? 'BEST ROUTE' : 'ROUTE CORRECTED'}</span></div>` : ''}
  </div>`
}

export function createChatGPTSkillShop({ onExit = () => {}, onReward = () => {}, onHaptic = () => {} } = {}) {
  const root = document.createElement('section')
  root.className = 'gpt-shop'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="gpt-shop-noise"></div>
    <div class="gpt-shop-orbit orbit-one"></div><div class="gpt-shop-orbit orbit-two"></div>
    <div class="gpt-shop-frame">
      <header class="gpt-shop-header">
        <div class="gpt-shop-brand"><i></i><span><b>CHATGPT</b><small>SKILL SHOP / LAB 01</small></span></div>
        <div class="gpt-shop-session"><span>SESSION SCORE</span><strong id="gpt-shop-score">000</strong></div>
        <button class="gpt-shop-exit" type="button" data-action="exit" data-gamepad aria-label="Exit Skill Shop">×</button>
      </header>
      <div class="gpt-shop-progress" aria-label="Skill Shop progress"><i></i><i></i><i></i></div>
      <main class="gpt-shop-stage" id="gpt-shop-stage"></main>
      <footer class="gpt-shop-footer"><span>CLICK OR USE <b>D-PAD + CROSS</b></span><span>SIMULATED LEARNING ENVIRONMENT</span></footer>
    </div>
  `
  document.querySelector('#world-shell').appendChild(root)

  const stage = root.querySelector('#gpt-shop-stage')
  const scoreNode = root.querySelector('#gpt-shop-score')
  const progressNodes = [...root.querySelectorAll('.gpt-shop-progress i')]
  let open = false
  let screen = 'intro'
  let score = 0
  let routerIndex = 0
  let routerAnswered = null
  let contextSelected = new Set()
  let contextSubmitted = false
  let terminalAnswered = null
  let gamepadIndex = 0
  let timers = []

  function schedule(callback, delay) {
    const timer = setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }

  function clearTimers() {
    timers.forEach(clearTimeout)
    timers = []
  }

  function updateChrome(step = 0) {
    scoreNode.textContent = String(score).padStart(3, '0')
    progressNodes.forEach((node, index) => node.classList.toggle('is-active', index <= step))
  }

  function syncGamepadFocus(reset = false) {
    const controls = [...stage.querySelectorAll('[data-gamepad]:not([disabled])')]
    if (reset) gamepadIndex = 0
    gamepadIndex = Math.max(0, Math.min(gamepadIndex, controls.length - 1))
    controls.forEach((control, index) => control.classList.toggle('is-controller-focus', index === gamepadIndex))
    return controls
  }

  function modelCards({ selectable = false } = {}) {
    return MODELS.map((model, index) => `
      <button class="model-card model-${model.id}" type="button" ${selectable ? `data-model="${model.id}" data-option data-gamepad` : 'disabled'} style="--model-tone:${model.tone}">
        <span class="model-index">0${index + 1}</span><i></i>
        <strong>${model.name}</strong><small>${model.role}</small><p>${model.copy}</p>
        <code>${model.slug}</code>
      </button>
    `).join('')
  }

  function renderIntro() {
    screen = 'intro'
    updateChrome(0)
    stage.innerHTML = `
      <div class="shop-intro">
        <div class="shop-kicker"><span>LIVE LAB</span><i></i><small>03 CHALLENGES · ~02 MIN</small></div>
        <h1>Don’t just prompt.<br /><em>Route the intelligence.</em></h1>
        <p>You will do three simple actions. Watch the system react to every choice.</p>
        <div class="skill-journey" aria-label="Three game steps">
          <div><i>1</i><span><b>ROUTE</b><small>Match task → model</small></span></div>
          <em>→</em>
          <div><i>2</i><span><b>PACK</b><small>Choose useful context</small></span></div>
          <em>→</em>
          <div><i>3</i><span><b>REPAIR</b><small>Fix → test → ship</small></span></div>
          <b class="journey-runner"></b>
        </div>
        <button class="shop-primary" type="button" data-action="start" data-gamepad>START CODE SESSION <span>→</span></button>
      </div>
    `
    syncGamepadFocus(true)
  }

  function renderRouter() {
    screen = 'router'
    updateChrome(0)
    const mission = ROUTING_MISSIONS[routerIndex]
    const result = routerAnswered && MODELS.find((model) => model.id === routerAnswered)
    const correctModel = MODELS.find((model) => model.id === mission.correct)
    stage.innerHTML = `
      <div class="challenge-layout">
        <section class="challenge-copy">
          <span class="challenge-number">CHALLENGE 01 <b>${routerIndex + 1}/3</b></span>
          <div class="mission-tag">${mission.tag}</div>
          <h2>${mission.title}</h2><p>${mission.copy}</p>
          <div class="action-callout"><small>YOUR MOVE</small><strong>${mission.question}</strong></div>
        </section>
        <section class="challenge-play">
          ${missionVisual(mission, Boolean(routerAnswered), routerAnswered === mission.correct)}
          ${routerAnswered ? `
            <div class="route-result ${routerAnswered === mission.correct ? 'is-correct' : 'is-wrong'}">
              <span>${routerAnswered === mission.correct ? 'ROUTE LOCKED' : 'ROUTE CORRECTED'}</span>
              <h3>${correctModel.name} <small>${correctModel.slug}</small></h3>
              <div class="mini-terminal">${mission.terminal.map((line, index) => `<p style="--delay:${index * 90}ms"><b>${index === mission.terminal.length - 1 ? '✓' : '›'}</b>${line}</p>`).join('')}</div>
              <div class="why-strip"><b>WHY</b><span>${mission.visual === 'repo' ? 'Unknowns + connected code + production risk need frontier reasoning.' : mission.visual === 'dashboard' ? 'Clear product work needs a capable model without frontier cost.' : 'A fixed repetitive job should use the efficient high-volume lane.'}</span></div>
              ${routerAnswered !== mission.correct ? `<small>You chose ${escapeHtml(result.name)}. Watch the system reroute to ${correctModel.name}.</small>` : '<small>Correct. The task and the model are now matched.</small>'}
              <button class="shop-primary" type="button" data-action="next-route" data-gamepad>${routerIndex === 2 ? 'CONTEXT FORGE' : 'NEXT MISSION'} <span>→</span></button>
            </div>
          ` : `<div class="select-label">CLICK ONE MODEL · WATCH THE TASK ROUTE</div><div class="model-grid">${modelCards({ selectable: true })}</div>`}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function renderContext() {
    screen = 'context'
    updateChrome(1)
    const selected = [...contextSelected]
    const correctCount = selected.filter((id) => CONTEXT_TILES.find((tile) => tile.id === id)?.good).length
    const hasSecret = selected.includes('secret')
    stage.innerHTML = `
      <div class="challenge-layout context-layout">
        <section class="challenge-copy">
          <span class="challenge-number">CHALLENGE 02 <b>${contextSubmitted ? 'PACKET TESTED' : `${selected.length}/3`}</b></span>
          <div class="mission-tag">CONTEXT FORGE</div>
          <h2>Send signal.<br />Leave out noise.</h2>
          <p>The agent has three empty memory slots. Fill them with only what helps it finish.</p>
          <div class="action-callout"><small>YOUR MOVE</small><strong>Choose exactly three useful blocks.</strong></div>
          <div class="context-packet">
            <span>CONTEXT PACKET</span>
            ${selected.length ? selected.map((id) => `<code>${CONTEXT_TILES.find((tile) => tile.id === id)?.label}</code>`).join('') : '<small>EMPTY · SELECT THREE BLOCKS</small>'}
          </div>
        </section>
        <section class="challenge-play">
          <div class="context-machine ${contextSubmitted ? (correctCount === 3 && !hasSecret ? 'is-clean' : 'is-noisy') : ''}">
            <div class="context-source"><span>YOU</span><i></i></div>
            <div class="context-track"><b></b><b></b><b></b></div>
            <div class="context-core"><i>${selected.length}</i><span>AGENT<br />MEMORY</span></div>
            <small>${contextSubmitted ? (correctCount === 3 && !hasSecret ? 'CLEAN SIGNAL · AGENT READY' : 'NOISE DETECTED · PACKET CORRECTED') : `${selected.length}/3 MEMORY SLOTS FILLED`}</small>
          </div>
          ${contextSubmitted ? `
            <div class="context-result ${correctCount === 3 && !hasSecret ? 'is-correct' : 'is-wrong'}">
              <span>${correctCount === 3 && !hasSecret ? 'CLEAN HANDOFF' : hasSecret ? 'SECRET BLOCKED' : 'CONTEXT REFINED'}</span>
              <h3>${correctCount}/3 useful blocks</h3>
              <div class="packet-flow"><i></i><i></i><i></i><b></b></div>
              <p>${hasSecret ? 'Credentials stay outside prompts and handoffs.' : correctCount === 3 ? 'Objective + relevant files + success test gives the agent a bounded route to done.' : 'Useful context is specific, relevant, and testable.'}</p>
              <button class="shop-primary" type="button" data-action="next-terminal" data-gamepad>OPEN CODE SESSION <span>→</span></button>
            </div>
          ` : `
            <div class="context-grid">
              ${CONTEXT_TILES.map((tile) => `<button type="button" class="context-tile ${contextSelected.has(tile.id) ? 'is-selected' : ''}" data-context="${tile.id}" data-option data-gamepad><i>${tile.icon}</i><span><b>${tile.label}</b><small>${tile.copy}</small></span></button>`).join('')}
            </div>
            <button class="shop-primary ${selected.length === 3 ? '' : 'is-disabled'}" type="button" data-action="submit-context" data-gamepad ${selected.length === 3 ? '' : 'disabled'}>RUN CONTEXT CHECK <span>⌘</span></button>
          `}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function terminalLines(resolved = false, answer = null) {
    const base = [
      '<span class="terminal-prompt">$</span> codex run "repair checkout validation"',
      '<span class="terminal-dim">› reading cart.ts · coupon.ts · checkout.test.ts</span>',
      '<span class="terminal-pass">✓ 18 tests passed</span>',
      '<span class="terminal-fail">✗ expired coupon still reaches payment</span>',
    ]
    if (!resolved) return base.join('<br />')
    if (answer === 'patch') return [...base, '<span class="terminal-prompt">$</span> apply patch + rerun targeted tests', '<span class="terminal-pass">✓ 19 tests passed · behavior verified</span>', '<span class="terminal-pass">✓ ready for review</span>'].join('<br />')
    if (answer === 'ship') return [...base, '<span class="terminal-fail">! release blocked · failing behavior remains</span>', '<span class="terminal-dim">human review prevented an unsafe ship</span>'].join('<br />')
    return [...base, '<span class="terminal-fail">! rewrite rejected · 18 passing tests discarded</span>', '<span class="terminal-dim">repair the smallest failing surface first</span>'].join('<br />')
  }

  function renderTerminal() {
    screen = 'terminal'
    updateChrome(2)
    const correct = terminalAnswered === 'patch'
    stage.innerHTML = `
      <div class="terminal-layout">
        <section class="terminal-copy">
          <span class="challenge-number">CHALLENGE 03 <b>SIMULATED CODE SESSION</b></span>
          <div class="mission-tag">SHIP LOOP</div>
          <h2>Red test.<br />Your move.</h2>
          <p>The agent has reached a red gate. The work cannot ship until a human closes the loop.</p>
          <div class="action-callout"><small>YOUR MOVE</small><strong>Choose what happens after failure.</strong></div>
          ${terminalAnswered ? `<div class="micro-lesson ${correct ? 'is-correct' : 'is-wrong'}"><i></i><span>${correct ? '<b>Repair → test → review.</b> Verification closes the loop.' : '<b>Failure is information.</b> Fix the smallest broken surface and verify again.'}</span></div>` : ''}
        </section>
        <section class="code-session">
          <div class="ship-pipeline ${terminalAnswered ? (correct ? 'is-passed' : 'is-blocked') : ''}">
            <div><i>AI</i><span>BUILD</span></div><b></b><div><i>×</i><span>TEST</span></div><b></b><div><i>YOU</i><span>DECIDE</span></div><b></b><div><i>↑</i><span>SHIP</span></div>
          </div>
          <div class="terminal-window">
            <header><i></i><i></i><i></i><span>CODEX SESSION / checkout-fix</span><b>${terminalAnswered ? (correct ? 'PASS' : 'BLOCKED') : '1 FAILURE'}</b></header>
            <pre>${terminalLines(Boolean(terminalAnswered), terminalAnswered)}</pre>
            <div class="terminal-cursor"><span>›</span><i></i></div>
          </div>
          ${terminalAnswered ? `<button class="shop-primary" type="button" data-action="finish" data-gamepad>VIEW SKILL SCORE <span>→</span></button>` : `<div class="terminal-actions">${TERMINAL_ACTIONS.map((action, index) => `<button type="button" data-terminal="${action.id}" data-option data-gamepad><i>0${index + 1}</i><span><b>${action.label}</b><small>${action.copy}</small></span></button>`).join('')}</div>`}
        </section>
      </div>
    `
    syncGamepadFocus(true)
  }

  function renderResult() {
    screen = 'result'
    updateChrome(2)
    const badge = score >= 85 ? 'AI ORCHESTRATOR' : score >= 60 ? 'MODEL ROUTER' : 'PROMPT SCOUT'
    const saved = { completed: true, score, badge, completedAt: new Date().toISOString() }
    localStorage.setItem('upgradverse-chatgpt-skillshop', JSON.stringify(saved))
    onReward(saved)
    stage.innerHTML = `
      <div class="result-layout">
        <div class="reward-core"><div class="reward-orbit"></div><div class="reward-orbit orbit-b"></div><span>GPT</span></div>
        <span class="challenge-number">SKILL CORE UNLOCKED</span>
        <h1>${badge}</h1>
        <p>You routed the model family, built a bounded context packet, and closed the execution loop with verification.</p>
        <div class="result-score"><strong>${String(score).padStart(3, '0')}</strong><span>/ 100<br /><b>MODEL JUDGMENT</b></span></div>
        <div class="result-actions"><button class="shop-primary" type="button" data-action="return" data-gamepad>RETURN TO UPGRADVERSE <span>→</span></button><button class="shop-secondary" type="button" data-action="replay" data-gamepad>REPLAY LAB</button></div>
      </div>
    `
    onHaptic('success')
    syncGamepadFocus(true)
  }

  function chooseModel(modelId) {
    if (routerAnswered) return
    routerAnswered = modelId
    const correct = modelId === ROUTING_MISSIONS[routerIndex].correct
    if (correct) score += 15
    else score += 4
    onHaptic(correct ? 'success' : 'impact')
    renderRouter()
  }

  function nextRoute() {
    if (routerIndex < ROUTING_MISSIONS.length - 1) {
      routerIndex += 1
      routerAnswered = null
      renderRouter()
      return
    }
    renderContext()
  }

  function toggleContext(id) {
    if (contextSubmitted) return
    if (contextSelected.has(id)) contextSelected.delete(id)
    else if (contextSelected.size < 3) contextSelected.add(id)
    onHaptic('select')
    renderContext()
  }

  function submitContext() {
    if (contextSelected.size !== 3 || contextSubmitted) return
    const chosen = [...contextSelected]
    const correctCount = chosen.filter((id) => CONTEXT_TILES.find((tile) => tile.id === id)?.good).length
    const hasSecret = chosen.includes('secret')
    score += correctCount === 3 && !hasSecret ? 20 : correctCount >= 2 && !hasSecret ? 10 : 4
    contextSubmitted = true
    onHaptic(correctCount === 3 && !hasSecret ? 'success' : 'impact')
    renderContext()
  }

  function chooseTerminal(id) {
    if (terminalAnswered) return
    terminalAnswered = id
    const correct = id === 'patch'
    score += correct ? 35 : 8
    onHaptic(correct ? 'success' : 'impact')
    renderTerminal()
  }

  function reset() {
    clearTimers()
    score = 0
    routerIndex = 0
    routerAnswered = null
    contextSelected = new Set()
    contextSubmitted = false
    terminalAnswered = null
    gamepadIndex = 0
  }

  function exit() {
    if (!open) return
    clearTimers()
    open = false
    root.classList.remove('is-visible')
    root.setAttribute('aria-hidden', 'true')
    schedule(() => { root.style.visibility = 'hidden' }, 450)
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
    if (control.dataset.model) chooseModel(control.dataset.model)
    else if (control.dataset.context) toggleContext(control.dataset.context)
    else if (control.dataset.terminal) chooseTerminal(control.dataset.terminal)
    else if (control.dataset.action === 'start') renderRouter()
    else if (control.dataset.action === 'next-route') nextRoute()
    else if (control.dataset.action === 'submit-context') submitContext()
    else if (control.dataset.action === 'next-terminal') renderTerminal()
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
    else if (/^Digit[1-5]$/.test(event.code)) stage.querySelectorAll('[data-option]')[Number(event.code.slice(-1)) - 1]?.click()
    event.preventDefault()
    return true
  }

  return { launch, exit, isOpen: () => open, handleGamepad, handleKey }
}
