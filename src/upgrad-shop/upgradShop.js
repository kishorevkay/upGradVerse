import './upgradShop.css'

const INSIGHTS = [
  {
    id: 'signal',
    label: 'STABLE LIFT',
    sample: '1,240',
    confidence: '94%',
    train: [30, 43, 52, 67, 78, 88],
    test: [28, 40, 50, 64, 75, 85],
    good: true,
    note: 'Train + test agree',
  },
  {
    id: 'spike',
    label: 'VIRAL SPIKE',
    sample: '42',
    confidence: '51%',
    train: [22, 24, 27, 82, 31, 29],
    test: [20, 22, 25, 34, 27, 24],
    good: false,
    note: 'One-off outlier',
  },
  {
    id: 'overfit',
    label: 'PERFECT MODEL',
    sample: '180',
    confidence: '58%',
    train: [35, 50, 65, 77, 90, 98],
    test: [33, 42, 45, 43, 38, 31],
    good: false,
    note: 'Test data breaks',
  },
]

const PIPELINE = [
  { id: 'browser', label: 'BROWSER', glyph: '▱', micro: 'request' },
  { id: 'api', label: 'API', glyph: '{ }', micro: 'logic' },
  { id: 'database', label: 'DATABASE', glyph: '◎', micro: 'data' },
  { id: 'response', label: 'RESPONSE', glyph: '↗', micro: 'render' },
]

const PIPELINE_SHUFFLE = ['database', 'browser', 'response', 'api']

const BUDGET_LANES = [
  { id: 'audience', label: 'AUDIENCE', glyph: '◉', cue: 'FIT', power: 2 },
  { id: 'channel', label: 'CHANNEL', glyph: '⌁', cue: 'REACH', power: 4 },
  { id: 'creative', label: 'CREATIVE', glyph: '✦', cue: 'CONVERT', power: 4 },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function insightGraph(insight) {
  const bars = (values, type) => values.map((height, index) => `<i class="${type}" style="--bar:${height};--index:${index}"></i>`).join('')
  return `
    <div class="upgrad-insight-graph" aria-hidden="true">
      <div class="upgrad-chart-grid"></div>
      <div class="upgrad-bars">${bars(insight.train, 'is-train')}${bars(insight.test, 'is-test')}</div>
      <div class="upgrad-chart-legend"><span><i></i>TRAIN</span><span><i></i>TEST</span></div>
    </div>
  `
}

function resolveMount(host) {
  if (typeof host === 'string') return document.querySelector(host)
  if (host?.appendChild) return host
  return document.querySelector('#world-shell') || document.body
}

export function createUpgradSkillShop({ host, onClose = () => {}, onReward = () => {}, onHaptic = () => {} } = {}) {
  const mount = resolveMount(host)
  if (!mount) throw new Error('createUpgradSkillShop requires a valid host element')

  const root = document.createElement('section')
  root.className = 'upgrad-shop'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-hidden', 'true')
  root.setAttribute('aria-labelledby', 'upgrad-shop-title')
  root.innerHTML = `
    <div class="upgrad-shop-grid" aria-hidden="true"></div>
    <div class="upgrad-shop-glow upgrad-glow-a" aria-hidden="true"></div>
    <div class="upgrad-shop-glow upgrad-glow-b" aria-hidden="true"></div>
    <div class="upgrad-shop-shell">
      <header class="upgrad-shop-header">
        <div class="upgrad-shop-brand"><i><b>U</b></i><span><strong id="upgrad-shop-title">upGrad</strong><small>SKILL SHOP / LAB 03</small></span></div>
        <div class="upgrad-shop-score"><span>SKILL SCORE</span><strong data-score>000</strong></div>
        <button class="upgrad-shop-close" type="button" data-action="exit" data-gamepad aria-label="Exit upGrad Skill Shop">×</button>
      </header>
      <nav class="upgrad-shop-progress" aria-label="Course challenge progress">
        <div data-progress="0"><i>01</i><span>DATA</span></div><b></b>
        <div data-progress="1"><i>02</i><span>BUILD</span></div><b></b>
        <div data-progress="2"><i>03</i><span>GROW</span></div>
      </nav>
      <main class="upgrad-shop-stage" aria-live="polite"></main>
      <footer class="upgrad-shop-footer"><span>D-PAD <b>MOVE</b> · CROSS <b>SELECT</b> · CIRCLE <b>EXIT</b></span><span>GEN AI · FULL STACK · DIGITAL MARKETING</span></footer>
    </div>
  `
  mount.appendChild(root)

  const stage = root.querySelector('.upgrad-shop-stage')
  const scoreNode = root.querySelector('[data-score]')
  const progressNodes = [...root.querySelectorAll('[data-progress]')]
  const progressLines = [...root.querySelectorAll('.upgrad-shop-progress > b')]

  let open = false
  let screen = 'intro'
  let score = 0
  let insightAnswer = null
  let pipelinePath = []
  let pipelineErrors = 0
  let pipelineNotice = ''
  let pipelineScored = false
  let allocations = { audience: 20, channel: 20, creative: 20 }
  let campaignResult = null
  let campaignAward = 0
  let gamepadIndex = 0
  let timers = []
  let rewardSent = false
  let previousFocus = null

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
    scoreNode.textContent = String(clamp(score, 0, 100)).padStart(3, '0')
    progressNodes.forEach((node, index) => {
      node.classList.toggle('is-active', index <= step)
      node.classList.toggle('is-current', index === step)
    })
    progressLines.forEach((line, index) => line.classList.toggle('is-active', index < step))
  }

  function getGamepadControls() {
    const stageControls = [...stage.querySelectorAll('[data-gamepad]:not([disabled])')]
    const closeControl = root.querySelector('.upgrad-shop-close')
    return closeControl ? [...stageControls, closeControl] : stageControls
  }

  function syncGamepadFocus(reset = false, focus = false) {
    const controls = getGamepadControls()
    if (reset) gamepadIndex = 0
    gamepadIndex = clamp(gamepadIndex, 0, Math.max(0, controls.length - 1))
    controls.forEach((control, index) => control.classList.toggle('is-controller-focus', index === gamepadIndex))
    if (focus && controls[gamepadIndex]) controls[gamepadIndex].focus({ preventScroll: true })
    return controls
  }

  function renderIntro() {
    screen = 'intro'
    updateChrome(0)
    stage.innerHTML = `
      <div class="upgrad-intro">
        <section class="upgrad-intro-copy">
          <div class="upgrad-kicker"><span>03 RAPID MISSIONS</span><i></i><small>≈ 02 MIN</small></div>
          <h1>Learn by<br /><em>making the move.</em></h1>
          <p>Read the visual. Choose fast. Watch the system react.</p>
          <div class="upgrad-course-strip" aria-label="Three course themes">
            <div><i>◫</i><span><b>GEN AI + DATA</b><small>find signal</small></span></div>
            <div><i>{ }</i><span><b>FULL STACK</b><small>repair flow</small></span></div>
            <div><i>↗</i><span><b>MARKETING</b><small>move budget</small></span></div>
          </div>
          <button class="upgrad-primary" type="button" data-action="start" data-gamepad>ENTER SKILL LAB <span>→</span></button>
        </section>
        <section class="upgrad-intro-core" aria-hidden="true">
          <div class="upgrad-core-orbit orbit-a"><i></i><i></i><i></i></div>
          <div class="upgrad-core-orbit orbit-b"><i></i><i></i><i></i></div>
          <div class="upgrad-core-mark"><span>U</span><b>SKILL<br />CORE</b></div>
          <div class="upgrad-core-card core-data"><i></i><b>94%</b><small>SIGNAL</small></div>
          <div class="upgrad-core-card core-code"><i>{ }</i><b>200</b><small>RESPONSE</small></div>
          <div class="upgrad-core-card core-growth"><i>↗</i><b>+38</b><small>GROWTH</small></div>
        </section>
      </div>
    `
    syncGamepadFocus(true, true)
  }

  function renderData() {
    screen = 'data'
    updateChrome(0)
    const chosen = INSIGHTS.find((item) => item.id === insightAnswer)
    const correct = chosen?.good === true
    const trusted = INSIGHTS[0]
    stage.innerHTML = `
      <div class="upgrad-game-layout">
        <section class="upgrad-game-copy">
          <span class="upgrad-stage-number">MISSION 01 <b>GEN AI + DATA SCIENCE</b></span>
          <h2>Trust the<br /><em>real signal.</em></h2>
          <p>Three models found a lift. Only one survives unseen data.</p>
          <div class="upgrad-move"><small>YOUR MOVE</small><strong>Choose the insight you would ship.</strong></div>
          ${chosen ? `<div class="upgrad-feedback ${correct ? 'is-good' : 'is-corrected'}"><i>${correct ? '✓' : '↻'}</i><span><b>${correct ? 'SIGNAL LOCKED' : 'NOISE FILTERED'}</b><small>${correct ? 'Large sample. Train and test move together.' : `${chosen.note}. The stable insight wins.`}</small></span></div>` : ''}
        </section>
        <section class="upgrad-game-board">
          ${chosen ? `
            <div class="upgrad-data-resolution">
              <div class="upgrad-resolution-chart">${insightGraph(trusted)}<span>TRUST INDEX</span><strong>${trusted.confidence}</strong></div>
              <div class="upgrad-resolution-copy"><small>VERIFIED INSIGHT</small><h3>Stable lift across unseen data.</h3><div><span><b>${trusted.sample}</b> sample</span><span><b>TRAIN ≈ TEST</b> validated</span></div></div>
              <button class="upgrad-primary" type="button" data-action="next-pipeline" data-gamepad>BUILD THE STACK <span>→</span></button>
            </div>
          ` : `
            <div class="upgrad-insight-grid">
              ${INSIGHTS.map((insight, index) => `
                <button class="upgrad-insight-card" type="button" data-insight="${insight.id}" data-option data-gamepad aria-label="Option ${index + 1}: ${insight.label}, sample ${insight.sample}, confidence ${insight.confidence}">
                  <span class="upgrad-card-index">0${index + 1}</span>
                  ${insightGraph(insight)}
                  <div class="upgrad-insight-meta"><span><small>${insight.label}</small><b>n ${insight.sample}</b></span><strong>${insight.confidence}</strong></div>
                </button>
              `).join('')}
            </div>
          `}
        </section>
      </div>
    `
    syncGamepadFocus(true, true)
  }

  function pipelineStep(id, index) {
    const step = PIPELINE.find((item) => item.id === id)
    return `<div class="upgrad-pipe-node is-filled" style="--node:${index}"><i>${step.glyph}</i><span><b>${step.label}</b><small>${step.micro}</small></span></div>`
  }

  function renderPipeline() {
    screen = 'pipeline'
    updateChrome(1)
    const complete = pipelinePath.length === PIPELINE.length
    stage.innerHTML = `
      <div class="upgrad-game-layout upgrad-pipeline-layout">
        <section class="upgrad-game-copy">
          <span class="upgrad-stage-number">MISSION 02 <b>FULL STACK DEVELOPMENT</b></span>
          <h2>Repair the<br /><em>request flow.</em></h2>
          <p>Tap the four system blocks in the order data travels.</p>
          <div class="upgrad-move"><small>NEXT SLOT</small><strong>${complete ? 'Pipeline online.' : `${pipelinePath.length + 1} / 4 · choose the next block`}</strong></div>
          ${pipelineNotice ? `<div class="upgrad-feedback ${complete ? 'is-good' : 'is-corrected'}"><i>${complete ? '✓' : '!'}</i><span><b>${complete ? '200 · FLOW RESTORED' : 'ROUTE BLOCKED'}</b><small>${pipelineNotice}</small></span></div>` : ''}
        </section>
        <section class="upgrad-game-board">
          <div class="upgrad-pipeline-machine ${complete ? 'is-online' : ''}">
            <div class="upgrad-pipeline-rail"><b></b><i></i></div>
            <div class="upgrad-pipeline-slots">
              ${PIPELINE.map((step, index) => pipelinePath[index] ? pipelineStep(pipelinePath[index], index) : `<div class="upgrad-pipe-node is-empty"><i>0${index + 1}</i><span>WAITING</span></div>`).join('')}
            </div>
            <div class="upgrad-packet"><i></i><span>${complete ? '200 OK' : 'DATA PACKET'}</span></div>
          </div>
          ${complete ? `
            <div class="upgrad-pipeline-result"><div><small>LATENCY</small><strong>118ms</strong></div><div><small>STATUS</small><strong>200</strong></div><button class="upgrad-primary" type="button" data-action="next-budget" data-gamepad>LAUNCH CAMPAIGN <span>→</span></button></div>
          ` : `
            <div class="upgrad-block-grid">
              ${PIPELINE_SHUFFLE.map((id, index) => {
                const step = PIPELINE.find((item) => item.id === id)
                const used = pipelinePath.includes(id)
                return `<button class="upgrad-block-card ${used ? 'is-used' : ''}" type="button" data-pipeline="${id}" data-option data-gamepad ${used ? 'disabled' : ''}><em>0${index + 1}</em><i>${step.glyph}</i><span><b>${step.label}</b><small>${step.micro}</small></span></button>`
              }).join('')}
            </div>
          `}
        </section>
      </div>
    `
    syncGamepadFocus(true, true)
  }

  function totalBudget() {
    return Object.values(allocations).reduce((total, value) => total + value, 0)
  }

  function forecastScore() {
    const audience = Math.min(allocations.audience, 20) * 1.25
    const channel = Math.min(allocations.channel, 40)
    const creative = Math.min(allocations.creative, 40) * 0.875
    return clamp(Math.round(audience + channel + creative), 0, 100)
  }

  function budgetLane(lane) {
    const value = allocations[lane.id]
    const disabled = Boolean(campaignResult)
    return `
      <div class="upgrad-budget-lane ${disabled ? 'is-locked' : ''}">
        <header><i>${lane.glyph}</i><span><b>${lane.label}</b><small>${lane.cue}</small></span><strong>$${value}K</strong></header>
        <div class="upgrad-power" aria-label="${lane.power} efficiency points">${'<i></i>'.repeat(lane.power)}${'<i class="is-off"></i>'.repeat(4 - lane.power)}</div>
        <div class="upgrad-budget-bar"><i style="--fill:${value}"></i></div>
        <div class="upgrad-budget-controls">
          <button type="button" data-budget="${lane.id}" data-delta="-10" data-gamepad ${disabled || value === 0 ? 'disabled' : ''} aria-label="Remove 10 thousand from ${lane.label}">−</button>
          <button type="button" data-budget="${lane.id}" data-delta="10" data-gamepad ${disabled || totalBudget() >= 100 ? 'disabled' : ''} aria-label="Add 10 thousand to ${lane.label}">+</button>
        </div>
      </div>
    `
  }

  function renderBudget() {
    screen = 'budget'
    updateChrome(2)
    const spent = totalBudget()
    const forecast = forecastScore()
    const hit = campaignResult?.hit === true
    stage.innerHTML = `
      <div class="upgrad-game-layout upgrad-budget-layout">
        <section class="upgrad-game-copy">
          <span class="upgrad-stage-number">MISSION 03 <b>DIGITAL MARKETING</b></span>
          <h2>Make every<br /><em>dollar perform.</em></h2>
          <p>$100K total. Balance fit, reach, and conversion.</p>
          <div class="upgrad-target"><small>TARGET</small><strong>85</strong><span>LEAD INDEX</span></div>
          ${campaignResult ? `<div class="upgrad-feedback ${hit ? 'is-good' : 'is-corrected'}"><i>${hit ? '✓' : '↻'}</i><span><b>${hit ? 'TARGET HIT' : 'MIX UNDER TARGET'}</b><small>${hit ? 'The campaign has enough fit, reach, and conversion power.' : 'A stronger mix: $20K / $40K / $40K.'}</small></span></div>` : ''}
        </section>
        <section class="upgrad-game-board">
          <div class="upgrad-campaign-console ${campaignResult ? (hit ? 'is-hit' : 'is-miss') : ''}">
            <div class="upgrad-forecast" style="--forecast:${forecast}"><div><small>FORECAST</small><strong>${forecast}</strong><span>/ 100</span></div></div>
            <div class="upgrad-budget-bank"><span>SPEND</span><strong>$${spent}K</strong><small>$${100 - spent}K LEFT</small></div>
            <div class="upgrad-target-line"><i style="--forecast:${forecast}"></i><b>TARGET 85</b></div>
          </div>
          <div class="upgrad-budget-grid">${BUDGET_LANES.map(budgetLane).join('')}</div>
          ${campaignResult ? `
            <div class="upgrad-budget-actions">
              ${hit ? '' : '<button class="upgrad-secondary" type="button" data-action="retry-budget" data-gamepad>RETUNE MIX</button>'}
              <button class="upgrad-primary" type="button" data-action="finish" data-gamepad>REVEAL SKILL SCORE <span>→</span></button>
            </div>
          ` : `<button class="upgrad-primary upgrad-launch-button ${spent === 100 ? '' : 'is-disabled'}" type="button" data-action="run-campaign" data-gamepad ${spent === 100 ? '' : 'disabled'}>RUN CAMPAIGN <span>▶</span></button>`}
        </section>
      </div>
    `
    syncGamepadFocus(true, true)
  }

  function renderResult() {
    screen = 'result'
    score = clamp(score, 0, 100)
    updateChrome(2)
    const badge = score >= 88 ? 'FUTURE BUILDER' : score >= 68 ? 'SKILL NAVIGATOR' : 'RAPID LEARNER'
    const reward = {
      completed: true,
      score,
      badge,
      skills: ['gen-ai-data-science', 'full-stack-development', 'digital-marketing'],
      completedAt: new Date().toISOString(),
    }
    if (!rewardSent) {
      rewardSent = true
      onReward(reward)
    }
    stage.innerHTML = `
      <div class="upgrad-result">
        <div class="upgrad-result-core" aria-hidden="true"><div><span>U</span><strong>${String(score).padStart(3, '0')}</strong><small>SKILL SCORE</small></div><i></i><i></i><i></i></div>
        <span class="upgrad-stage-number">THREE SKILL CORES UNLOCKED</span>
        <h1>${badge}</h1>
        <p>You found the signal, restored the stack, and moved budget toward growth.</p>
        <div class="upgrad-result-skills"><span><i>◫</i>DATA</span><span><i>{ }</i>BUILD</span><span><i>↗</i>GROW</span></div>
        <div class="upgrad-result-actions"><button class="upgrad-primary" type="button" data-action="return" data-gamepad>RETURN TO UPGRADVERSE <span>→</span></button><button class="upgrad-secondary" type="button" data-action="replay" data-gamepad>REPLAY LAB</button></div>
      </div>
    `
    onHaptic('success')
    syncGamepadFocus(true, true)
  }

  function chooseInsight(id) {
    if (insightAnswer) return
    insightAnswer = id
    const correct = INSIGHTS.find((item) => item.id === id)?.good === true
    score += correct ? 35 : 15
    onHaptic(correct ? 'success' : 'impact')
    renderData()
  }

  function choosePipeline(id) {
    if (pipelinePath.length === PIPELINE.length || pipelinePath.includes(id)) return
    const expected = PIPELINE[pipelinePath.length]
    if (id === expected.id) {
      pipelinePath.push(id)
      pipelineNotice = pipelinePath.length === PIPELINE.length ? 'Browser → API → database → response.' : `${expected.label} connected. Keep the packet moving.`
      onHaptic(pipelinePath.length === PIPELINE.length ? 'success' : 'select')
      if (pipelinePath.length === PIPELINE.length && !pipelineScored) {
        pipelineScored = true
        score += Math.max(15, 35 - (pipelineErrors * 5))
      }
    } else {
      pipelineErrors += 1
      pipelineNotice = `${PIPELINE.find((item) => item.id === id)?.label} cannot connect here. Trace from the user.`
      onHaptic('impact')
    }
    renderPipeline()
  }

  function adjustBudget(id, delta) {
    if (campaignResult || !(id in allocations)) return
    const next = clamp(allocations[id] + delta, 0, 100)
    const nextTotal = totalBudget() - allocations[id] + next
    if (nextTotal > 100) return
    allocations[id] = next
    onHaptic('select')
    renderBudget()
  }

  function runCampaign() {
    if (totalBudget() !== 100 || campaignResult) return
    const forecast = forecastScore()
    campaignAward = forecast >= 85 ? 30 : forecast >= 70 ? 20 : 10
    score += campaignAward
    campaignResult = { forecast, hit: forecast >= 85 }
    onHaptic(campaignResult.hit ? 'success' : 'impact')
    renderBudget()
  }

  function retryBudget() {
    if (!campaignResult) return
    score -= campaignAward
    campaignAward = 0
    campaignResult = null
    onHaptic('select')
    renderBudget()
  }

  function reset() {
    clearTimers()
    screen = 'intro'
    score = 0
    insightAnswer = null
    pipelinePath = []
    pipelineErrors = 0
    pipelineNotice = ''
    pipelineScored = false
    allocations = { audience: 20, channel: 20, creative: 20 }
    campaignResult = null
    campaignAward = 0
    gamepadIndex = 0
    rewardSent = false
  }

  function close() {
    if (!open) return
    clearTimers()
    open = false
    root.classList.remove('is-visible')
    root.setAttribute('aria-hidden', 'true')
    schedule(() => { root.style.visibility = 'hidden' }, 420)
    if (previousFocus?.focus) previousFocus.focus({ preventScroll: true })
    onClose()
  }

  function launch() {
    if (open) return
    reset()
    previousFocus = document.activeElement
    open = true
    root.style.visibility = 'visible'
    root.setAttribute('aria-hidden', 'false')
    window.requestAnimationFrame(() => root.classList.add('is-visible'))
    renderIntro()
    onHaptic('success')
  }

  root.addEventListener('click', (event) => {
    const control = event.target.closest('button')
    if (!control || !root.contains(control)) return
    if (control.dataset.insight) chooseInsight(control.dataset.insight)
    else if (control.dataset.pipeline) choosePipeline(control.dataset.pipeline)
    else if (control.dataset.budget) adjustBudget(control.dataset.budget, Number(control.dataset.delta))
    else if (control.dataset.action === 'start') renderData()
    else if (control.dataset.action === 'next-pipeline') renderPipeline()
    else if (control.dataset.action === 'next-budget') renderBudget()
    else if (control.dataset.action === 'run-campaign') runCampaign()
    else if (control.dataset.action === 'retry-budget') retryBudget()
    else if (control.dataset.action === 'finish') renderResult()
    else if (control.dataset.action === 'return' || control.dataset.action === 'exit') close()
    else if (control.dataset.action === 'replay') { reset(); renderIntro() }
  })

  function moveGamepadFocus(direction) {
    const controls = syncGamepadFocus()
    if (!controls.length) return
    gamepadIndex = (gamepadIndex + direction + controls.length) % controls.length
    syncGamepadFocus(false, true)
    onHaptic('select')
  }

  function handleGamepad(event = {}) {
    if (!open) return false
    if ([12, 14].includes(event.index)) moveGamepadFocus(-1)
    else if ([13, 15].includes(event.index)) moveGamepadFocus(1)
    else if (event.index === 0) syncGamepadFocus()[gamepadIndex]?.click()
    else if (event.index === 1) close()
    return true
  }

  function handleKey(event) {
    if (!open) return false
    let handled = true
    if (event.code === 'Escape') close()
    else if (['ArrowLeft', 'ArrowUp'].includes(event.code)) moveGamepadFocus(-1)
    else if (['ArrowRight', 'ArrowDown'].includes(event.code)) moveGamepadFocus(1)
    else if (event.code === 'Tab') moveGamepadFocus(event.shiftKey ? -1 : 1)
    else if (event.code === 'Enter' || event.code === 'Space') syncGamepadFocus()[gamepadIndex]?.click()
    else if (/^Digit[1-6]$/.test(event.code)) stage.querySelectorAll('[data-option]')[Number(event.code.slice(-1)) - 1]?.click()
    else handled = false
    if (handled) event.preventDefault()
    return handled
  }

  return { isOpen: () => open, launch, close, handleKey, handleGamepad }
}
