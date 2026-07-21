import './arenaGame.css'

const ACTIONS = {
  jab: { label: 'JAB', damage: 6, score: 80, range: 0.54, windup: 90, duration: 280, high: true },
  hook: { label: 'LEFT HOOK', damage: 10, score: 140, range: 0.5, windup: 150, duration: 430, high: true },
  uppercut: { label: 'UPPERCUT', damage: 13, score: 190, range: 0.42, windup: 190, duration: 520, high: true },
  kick: { label: 'ROUND KICK', damage: 15, score: 220, range: 0.62, windup: 230, duration: 620, high: false },
  jumpStrike: { label: 'JUMP STRIKE', damage: 19, score: 310, range: 0.68, windup: 310, duration: 780, high: false },
  duck: { label: 'DUCK', damage: 0, score: 0, range: 0, windup: 0, duration: 560, high: false },
}

const KEY_ACTIONS = new Map([
  ['KeyJ', 'jab'], ['KeyH', 'hook'], ['KeyU', 'uppercut'],
  ['KeyK', 'kick'], ['Space', 'jumpStrike'], ['KeyS', 'duck'], ['ArrowDown', 'duck'],
])

const BUTTON_ACTIONS = new Map([
  [0, 'jab'], [2, 'hook'], [4, 'uppercut'],
  [3, 'kick'], [7, 'jumpStrike'], [1, 'duck'],
])

const COMMENTARY = {
  start: ['The Verse Arena is live.', 'Human instinct against machine precision. Fight.'],
  hit: ['Clean connection.', 'That found the target.', 'Sharp timing from the human corner.', 'The crowd felt that one.'],
  combo: ['Momentum is building.', 'Three-hit sequence. Brilliant.', 'The human is reading the machine.'],
  playerHurt: ['The machine answers back.', 'Guard up. The robot found an opening.', 'Pressure from the synthetic corner.'],
  win: ['Human instinct wins the round.', 'The arena belongs to the human tonight.'],
  lose: ['Machine precision takes the round.', 'The robot closes it out. Reset and adapt.'],
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const choose = (items) => items[Math.floor(Math.random() * items.length)]

function fighterMarkup(kind) {
  const robot = kind === 'robot'
  return `
    <div class="verse-arena-fighter ${robot ? 'is-robot' : 'is-human'}" data-fighter="${kind}">
      <div class="verse-arena-shadow"></div>
      <div class="verse-arena-body">
        <div class="verse-arena-head"><i></i><b></b><span></span></div>
        <div class="verse-arena-torso"><i></i><b></b><span></span></div>
        <div class="verse-arena-arm arm-back"><i></i><b></b></div>
        <div class="verse-arena-arm arm-front"><i></i><b></b></div>
        <div class="verse-arena-leg leg-back"><i></i><b></b></div>
        <div class="verse-arena-leg leg-front"><i></i><b></b></div>
      </div>
      <div class="verse-arena-impact"><i></i><i></i><i></i><i></i><b></b></div>
      <span class="verse-arena-fighter-name">${robot ? 'SYNTH // 07' : 'THE HUMAN'}</span>
    </div>`
}

function makeNoiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1
    last = last * 0.94 + white * 0.06
    data[index] = last
  }
  return buffer
}

export function createVerseArenaGame({ onExit = () => {}, onHaptic = () => {}, onReward = () => {} } = {}) {
  const root = document.createElement('section')
  root.className = 'verse-arena'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="verse-arena-backdrop"><i></i><i></i><i></i></div>
    <div class="verse-arena-shell">
      <header class="verse-arena-header">
        <div class="verse-arena-brand"><i><b></b></i><span><strong>VERSE ARENA</strong><small>ORIGINAL COMBAT SIMULATION // A-01</small></span></div>
        <div class="verse-arena-round"><small>ROUND</small><strong>01</strong><i></i><b data-timer>60</b></div>
        <button class="verse-arena-close" type="button" data-arena-control="exit" aria-label="Exit Verse Arena">×</button>
      </header>

      <main class="verse-arena-stage">
        <div class="verse-arena-crowd crowd-back">${'<i></i>'.repeat(30)}</div>
        <div class="verse-arena-light light-left"></div><div class="verse-arena-light light-right"></div>
        <div class="verse-arena-octagon">
          <div class="verse-arena-mat"><i></i><b>VERSE</b><span>HUMAN // MACHINE</span></div>
          <div class="verse-arena-fence fence-a"></div><div class="verse-arena-fence fence-b"></div>
          <div class="verse-arena-post post-a"></div><div class="verse-arena-post post-b"></div>
          ${fighterMarkup('human')}
          ${fighterMarkup('robot')}
          <div class="verse-arena-referee"><i></i><b></b><span></span></div>
        </div>
        <div class="verse-arena-crowd crowd-front">${'<i></i>'.repeat(18)}</div>

        <section class="verse-arena-hud hud-human">
          <div><span>HUMAN</span><strong data-player-health-text>100</strong></div>
          <b><i data-player-health></i></b>
        </section>
        <section class="verse-arena-hud hud-robot">
          <div><span>SYNTH // 07</span><strong data-ai-health-text>100</strong></div>
          <b><i data-ai-health></i></b>
        </section>

        <div class="verse-arena-score"><small>FIGHT SCORE</small><strong data-score>0000</strong><span data-combo>COMBO READY</span></div>
        <div class="verse-arena-callout" data-callout><small>LIVE COMMENTARY</small><strong>ENTER THE OCTAGON</strong></div>

        <div class="verse-arena-gate" data-gate>
          <span>UPGRADVERSE // LIVE EVENT</span>
          <h1>HUMAN <i>VS</i> MACHINE</h1>
          <p>Read the opponent. Move with intent. Build the combo.</p>
          <button type="button" data-arena-control="start">ENTER THE OCTAGON <b>→</b></button>
          <small>CROSS / ENTER TO START · OPTIONS / ESC TO EXIT</small>
        </div>

        <div class="verse-arena-result" data-result aria-live="polite">
          <small data-result-kicker>ROUND COMPLETE</small>
          <h2 data-result-title>HUMAN INSTINCT WINS</h2>
          <p data-result-copy>You read the machine and owned the moment.</p>
          <div><span><small>SCORE</small><strong data-result-score>0000</strong></span><span><small>BEST COMBO</small><strong data-result-combo>0×</strong></span></div>
          <button type="button" data-arena-control="replay">FIGHT AGAIN</button>
          <button type="button" data-arena-control="exit">RETURN TO THE VERSE</button>
        </div>
      </main>

      <footer class="verse-arena-controls">
        <span><kbd>A D</kbd><b>MOVE</b></span>
        <span><kbd>J / ×</kbd><b>JAB</b></span>
        <span><kbd>H / □</kbd><b>HOOK</b></span>
        <span><kbd>U / L1</kbd><b>UPPERCUT</b></span>
        <span><kbd>K / △</kbd><b>KICK</b></span>
        <span><kbd>SPACE / R2</kbd><b>JUMP STRIKE</b></span>
        <span><kbd>S / ○</kbd><b>DUCK</b></span>
      </footer>
    </div>`

  const mount = document.querySelector('#world-shell') || document.body
  mount.appendChild(root)

  const nodes = {
    timer: root.querySelector('[data-timer]'),
    score: root.querySelector('[data-score]'),
    combo: root.querySelector('[data-combo]'),
    callout: root.querySelector('[data-callout]'),
    gate: root.querySelector('[data-gate]'),
    result: root.querySelector('[data-result]'),
    resultKicker: root.querySelector('[data-result-kicker]'),
    resultTitle: root.querySelector('[data-result-title]'),
    resultCopy: root.querySelector('[data-result-copy]'),
    resultScore: root.querySelector('[data-result-score]'),
    resultCombo: root.querySelector('[data-result-combo]'),
    player: root.querySelector('[data-fighter="human"]'),
    ai: root.querySelector('[data-fighter="robot"]'),
    playerHealth: root.querySelector('[data-player-health]'),
    aiHealth: root.querySelector('[data-ai-health]'),
    playerHealthText: root.querySelector('[data-player-health-text]'),
    aiHealthText: root.querySelector('[data-ai-health-text]'),
  }

  const state = {
    open: false,
    phase: 'intro',
    playerHealth: 100,
    aiHealth: 100,
    score: 0,
    combo: 0,
    bestCombo: 0,
    timeLeft: 60,
    playerX: -0.48,
    aiX: 0.48,
    playerAction: null,
    aiAction: null,
    playerActionUntil: 0,
    aiActionUntil: 0,
    aiThinkAt: 0,
    comboExpiresAt: 0,
    keys: new Set(),
    gamepadX: 0,
    pendingHits: [],
    rewardSent: false,
    lastFrame: 0,
    frame: 0,
    externalUpdateAt: -Infinity,
    lastSecond: 60,
  }

  let audioContext = null
  let audioMaster = null
  let crowdSource = null
  let crowdGain = null
  let commentaryAt = 0
  let timers = []
  let previousPadButtons = []
  const externalButtonAt = new Map()

  function schedule(callback, delay) {
    const timer = window.setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout)
    timers = []
  }

  function ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    if (!audioContext) {
      audioContext = new AudioContextClass()
      audioMaster = audioContext.createGain()
      audioMaster.gain.value = 0.42
      audioMaster.connect(audioContext.destination)
    }
    audioContext.resume?.().catch(() => {})
    if (!crowdSource) {
      crowdSource = audioContext.createBufferSource()
      crowdSource.buffer = makeNoiseBuffer(audioContext, 2.4)
      crowdSource.loop = true
      const filter = audioContext.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 720
      filter.Q.value = 0.55
      crowdGain = audioContext.createGain()
      crowdGain.gain.value = 0.045
      crowdSource.connect(filter).connect(crowdGain).connect(audioMaster)
      crowdSource.start()
    }
  }

  function stopAudio() {
    if (crowdSource) {
      try { crowdSource.stop() } catch {}
      crowdSource.disconnect()
      crowdSource = null
      crowdGain = null
    }
    window.speechSynthesis?.cancel()
  }

  function tone({ frequency = 140, endFrequency = 55, duration = 0.1, gain = 0.12, type = 'sine' } = {}) {
    if (!audioContext || !audioMaster) return
    const oscillator = audioContext.createOscillator()
    const envelope = audioContext.createGain()
    const now = audioContext.currentTime
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration)
    envelope.gain.setValueAtTime(gain, now)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(envelope).connect(audioMaster)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  function playFightSound(kind, strength = 1) {
    ensureAudio()
    if (kind === 'swing') tone({ frequency: 190, endFrequency: 70, duration: 0.075, gain: 0.055 * strength, type: 'sawtooth' })
    if (kind === 'hit') {
      tone({ frequency: 92, endFrequency: 34, duration: 0.14, gain: 0.16 * strength, type: 'square' })
      schedule(() => tone({ frequency: 420, endFrequency: 95, duration: 0.08, gain: 0.045, type: 'sawtooth' }), 20)
      if (crowdGain) {
        const now = audioContext.currentTime
        crowdGain.gain.cancelScheduledValues(now)
        crowdGain.gain.setValueAtTime(0.045, now)
        crowdGain.gain.linearRampToValueAtTime(0.12, now + 0.035)
        crowdGain.gain.exponentialRampToValueAtTime(0.045, now + 0.7)
      }
    }
    if (kind === 'bell') {
      tone({ frequency: 920, endFrequency: 680, duration: 0.72, gain: 0.1, type: 'triangle' })
      schedule(() => tone({ frequency: 1120, endFrequency: 760, duration: 0.5, gain: 0.07, type: 'triangle' }), 140)
    }
  }

  function speak(line, force = false) {
    if (!('speechSynthesis' in window) || !line) return
    const now = performance.now()
    if (!force && now < commentaryAt) return
    commentaryAt = now + 3200
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(line)
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => /en-(GB|US|IN)/i.test(voice.lang) && /male|daniel|aaron|rishi/i.test(voice.name)) || voices.find((voice) => /^en/i.test(voice.lang)) || null
    utterance.rate = 1.08
    utterance.pitch = 0.78
    utterance.volume = 0.42
    window.speechSynthesis.speak(utterance)
    setCallout('LIVE COMMENTARY', line)
  }

  function setCallout(kicker, line, toneName = '') {
    nodes.callout.className = `verse-arena-callout ${toneName ? `is-${toneName}` : ''}`
    nodes.callout.innerHTML = `<small>${kicker}</small><strong>${line}</strong>`
    nodes.callout.classList.remove('is-flash')
    void nodes.callout.offsetWidth
    nodes.callout.classList.add('is-flash')
  }

  function resetFighterClass(node, action) {
    const classes = [...node.classList].filter((name) => name.startsWith('action-') || name === 'is-hit' || name === 'is-blocked')
    node.classList.remove(...classes)
    if (action) {
      void node.offsetWidth
      node.classList.add(`action-${action}`)
    }
  }

  function updateHud() {
    nodes.playerHealth.style.width = `${state.playerHealth}%`
    nodes.aiHealth.style.width = `${state.aiHealth}%`
    nodes.playerHealthText.textContent = String(Math.ceil(state.playerHealth)).padStart(3, '0')
    nodes.aiHealthText.textContent = String(Math.ceil(state.aiHealth)).padStart(3, '0')
    nodes.score.textContent = String(state.score).padStart(4, '0')
    nodes.combo.textContent = state.combo > 1 ? `${state.combo}× COMBO` : 'COMBO READY'
    nodes.combo.classList.toggle('is-live', state.combo > 1)
    nodes.player.style.left = `${50 + state.playerX * 38}%`
    nodes.ai.style.left = `${50 + state.aiX * 38}%`
  }

  function resetFight() {
    state.playerHealth = 100
    state.aiHealth = 100
    state.score = 0
    state.combo = 0
    state.bestCombo = 0
    state.timeLeft = 60
    state.playerX = -0.48
    state.aiX = 0.48
    state.playerAction = null
    state.aiAction = null
    state.playerActionUntil = 0
    state.aiActionUntil = 0
    state.aiThinkAt = performance.now() + 900
    state.comboExpiresAt = 0
    state.keys.clear()
    state.gamepadX = 0
    state.pendingHits = []
    state.rewardSent = false
    state.lastSecond = 60
    nodes.timer.textContent = '60'
    nodes.timer.classList.remove('is-danger')
    nodes.result.classList.remove('is-visible')
    resetFighterClass(nodes.player)
    resetFighterClass(nodes.ai)
    updateHud()
  }

  function startFight() {
    if (!state.open) return
    resetFight()
    state.phase = 'fight'
    nodes.gate.classList.add('is-hidden')
    root.classList.add('is-fighting')
    ensureAudio()
    playFightSound('bell')
    onHaptic('success')
    speak(choose(COMMENTARY.start), true)
  }

  function moveFighter(actor, amount) {
    if (state.phase !== 'fight') return
    if (actor === 'player') {
      state.playerX = clamp(state.playerX + amount, -0.88, 0.42)
      if (state.playerX > state.aiX - 0.16) state.playerX = state.aiX - 0.16
    } else {
      state.aiX = clamp(state.aiX + amount, -0.42, 0.88)
      if (state.aiX < state.playerX + 0.16) state.aiX = state.playerX + 0.16
    }
  }

  function performAction(actor, name, now = performance.now()) {
    if (state.phase !== 'fight' || !ACTIONS[name]) return false
    const actionUntilKey = actor === 'player' ? 'playerActionUntil' : 'aiActionUntil'
    const actionKey = actor === 'player' ? 'playerAction' : 'aiAction'
    if (now < state[actionUntilKey]) return false
    const config = ACTIONS[name]
    state[actionKey] = name
    state[actionUntilKey] = now + config.duration
    const node = actor === 'player' ? nodes.player : nodes.ai
    resetFighterClass(node, name)
    if (name !== 'duck') {
      playFightSound('swing', name === 'jumpStrike' ? 1.3 : 1)
      state.pendingHits.push({ actor, name, at: now + config.windup })
    } else {
      onHaptic('select')
      setCallout('DEFENSIVE READ', actor === 'player' ? 'YOU SLIP BELOW THE STRIKE' : 'SYNTH // 07 EVADES', 'cyan')
    }
    return true
  }

  function resolveHit({ actor, name }) {
    if (state.phase !== 'fight') return
    const config = ACTIONS[name]
    const defender = actor === 'player' ? 'ai' : 'player'
    const defenderAction = state[`${defender}Action`]
    const defenderUntil = state[`${defender}ActionUntil`]
    const ducking = defenderAction === 'duck' && performance.now() < defenderUntil
    const distance = Math.abs(state.aiX - state.playerX)
    const missed = distance > config.range || (ducking && config.high)
    if (missed) {
      setCallout('ACTION READ', ducking ? 'CLEAN EVADE' : `${config.label} MISSES`, 'cyan')
      if (actor === 'player') state.combo = 0
      return
    }

    const defenderNode = defender === 'player' ? nodes.player : nodes.ai
    resetFighterClass(defenderNode)
    void defenderNode.offsetWidth
    defenderNode.classList.add('is-hit')
    const damage = actor === 'ai' ? Math.max(3, Math.ceil(config.damage * 0.68)) : config.damage
    playFightSound('hit', damage / 12)
    onHaptic(name === 'jumpStrike' || name === 'kick' ? 'success' : 'impact')

    if (actor === 'player') {
      state.aiHealth = clamp(state.aiHealth - damage, 0, 100)
      state.combo = performance.now() < state.comboExpiresAt ? state.combo + 1 : 1
      state.bestCombo = Math.max(state.bestCombo, state.combo)
      state.comboExpiresAt = performance.now() + 2100
      state.score += config.score + Math.max(0, state.combo - 1) * 45
      setCallout(state.combo > 1 ? `${state.combo}× COMBO` : 'CLEAN HIT', `${config.label} // +${config.score}`, 'red')
      speak(choose(state.combo >= 3 ? COMMENTARY.combo : COMMENTARY.hit))
      moveFighter('ai', 0.055)
    } else {
      state.playerHealth = clamp(state.playerHealth - damage, 0, 100)
      state.combo = 0
      state.comboExpiresAt = 0
      setCallout('SYNTH COUNTER', `${config.label} CONNECTS`, 'danger')
      speak(choose(COMMENTARY.playerHurt))
      moveFighter('player', -0.045)
    }
    updateHud()
    if (state.playerHealth <= 0 || state.aiHealth <= 0) finishFight(state.aiHealth <= 0 ? 'player' : 'ai')
  }

  function finishFight(winner) {
    if (state.phase !== 'fight') return
    state.phase = 'result'
    state.pendingHits = []
    root.classList.remove('is-fighting')
    const playerWon = winner === 'player'
    if (playerWon) state.score += Math.ceil(state.timeLeft) * 12 + state.playerHealth * 5
    nodes.resultKicker.textContent = playerWon ? 'HUMAN EDGE CONFIRMED' : 'ROUND COMPLETE // ADAPT'
    nodes.resultTitle.textContent = playerWon ? 'HUMAN INSTINCT WINS' : 'MACHINE PRECISION WINS'
    nodes.resultCopy.textContent = playerWon
      ? 'You read the pattern, changed rhythm, and broke the machine loop.'
      : 'The machine found your rhythm. Reset, vary the timing, and take it back.'
    nodes.resultScore.textContent = String(Math.round(state.score)).padStart(4, '0')
    nodes.resultCombo.textContent = `${state.bestCombo}×`
    nodes.result.classList.add('is-visible')
    playFightSound('bell')
    onHaptic(playerWon ? 'success' : 'impact')
    speak(choose(playerWon ? COMMENTARY.win : COMMENTARY.lose), true)
    if (!state.rewardSent) {
      state.rewardSent = true
      onReward({
        completed: true,
        winner,
        score: Math.round(state.score),
        bestCombo: state.bestCombo,
        healthRemaining: Math.ceil(state.playerHealth),
        completedAt: new Date().toISOString(),
      })
    }
  }

  function updateAi(now, dt) {
    if (now < state.aiActionUntil || state.phase !== 'fight') return
    const distance = state.aiX - state.playerX
    if (now >= state.aiThinkAt) {
      state.aiThinkAt = now + 980 + Math.random() * 1100
      if (distance > 0.48) {
        moveFighter('ai', -clamp(distance * 0.15, 0.035, 0.095))
      } else if (Math.random() < 0.16) {
        performAction('ai', 'duck', now)
      } else {
        const roll = Math.random()
        const action = roll < 0.34 ? 'jab' : roll < 0.58 ? 'hook' : roll < 0.76 ? 'uppercut' : roll < 0.93 ? 'kick' : 'jumpStrike'
        performAction('ai', action, now)
      }
    } else if (distance > 0.58) {
      moveFighter('ai', -dt * 0.105)
    }
  }

  function readGamepad() {
    const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean)
    if (!gamepad) {
      state.gamepadX = 0
      previousPadButtons = []
      return
    }
    const axis = gamepad.axes[0] || 0
    state.gamepadX = Math.abs(axis) > 0.2 ? Math.sign(axis) * ((Math.abs(axis) - 0.2) / 0.8) : 0
    const pressed = gamepad.buttons.map((button) => button.pressed || button.value > 0.62)
    pressed.forEach((isPressed, index) => {
      if (isPressed && !previousPadButtons[index] && performance.now() - (externalButtonAt.get(index) || 0) > 90) handleButton(index)
    })
    previousPadButtons = pressed
  }

  function tick(dt, now) {
    if (!state.open) return
    readGamepad()
    if (state.phase !== 'fight') return

    const keyboardX = (state.keys.has('KeyD') || state.keys.has('ArrowRight') ? 1 : 0) - (state.keys.has('KeyA') || state.keys.has('ArrowLeft') ? 1 : 0)
    const movement = Math.abs(state.gamepadX) > Math.abs(keyboardX) ? state.gamepadX : keyboardX
    if (movement) moveFighter('player', movement * dt * 0.58)

    updateAi(now, dt)
    state.pendingHits.filter((hit) => hit.at <= now).forEach(resolveHit)
    state.pendingHits = state.pendingHits.filter((hit) => hit.at > now)

    if (state.playerAction && now >= state.playerActionUntil) {
      state.playerAction = null
      resetFighterClass(nodes.player)
    }
    if (state.aiAction && now >= state.aiActionUntil) {
      state.aiAction = null
      resetFighterClass(nodes.ai)
    }
    if (state.combo && now >= state.comboExpiresAt) {
      state.combo = 0
      updateHud()
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt)
    const second = Math.ceil(state.timeLeft)
    if (second !== state.lastSecond) {
      state.lastSecond = second
      nodes.timer.textContent = String(second).padStart(2, '0')
      nodes.timer.classList.toggle('is-danger', second <= 10)
    }
    if (state.timeLeft <= 0) finishFight(state.aiHealth === state.playerHealth ? (state.score > 0 ? 'player' : 'ai') : state.aiHealth < state.playerHealth ? 'player' : 'ai')
    updateHud()
  }

  function frame(now) {
    if (!state.open) return
    const dt = clamp((now - (state.lastFrame || now)) / 1000, 0, 0.034)
    state.lastFrame = now
    if (now - state.externalUpdateAt > 100) tick(dt, now)
    state.frame = requestAnimationFrame(frame)
  }

  function launch() {
    if (state.open) return
    clearTimers()
    state.open = true
    state.phase = 'intro'
    state.lastFrame = performance.now()
    resetFight()
    nodes.gate.classList.remove('is-hidden')
    root.style.visibility = 'visible'
    root.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => root.classList.add('is-visible'))
    state.frame = requestAnimationFrame(frame)
    onHaptic('select')
  }

  function exit() {
    if (!state.open) return
    state.open = false
    state.phase = 'closed'
    state.keys.clear()
    state.pendingHits = []
    cancelAnimationFrame(state.frame)
    clearTimers()
    stopAudio()
    root.classList.remove('is-visible', 'is-fighting')
    root.setAttribute('aria-hidden', 'true')
    schedule(() => { if (!state.open) root.style.visibility = 'hidden' }, 420)
    onExit()
  }

  function handleButton(index) {
    if (!state.open) return false
    if (index === 9) { exit(); return true }
    if (state.phase === 'intro' && index === 0) { startFight(); return true }
    if (state.phase === 'result') {
      if (index === 0) startFight()
      else if (index === 1) exit()
      return true
    }
    if (index === 14) moveFighter('player', -0.08)
    else if (index === 15) moveFighter('player', 0.08)
    else if (BUTTON_ACTIONS.has(index)) performAction('player', BUTTON_ACTIONS.get(index))
    return true
  }

  function handleGamepad(event = {}) {
    if (!state.open) return false
    if (event.move || event.type === 'snapshot') {
      state.gamepadX = clamp(event.move?.x ?? event.axes?.[0] ?? 0, -1, 1)
      return true
    }
    if (Number.isInteger(event.index)) {
      externalButtonAt.set(event.index, performance.now())
      return handleButton(event.index)
    }
    return true
  }

  function handleKey(event) {
    if (!state.open || !event) return false
    if (event.__verseArenaHandled) return true
    event.__verseArenaHandled = true
    const down = event.type !== 'keyup'
    if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      if (down) state.keys.add(event.code)
      else state.keys.delete(event.code)
      event.preventDefault?.()
      return true
    }
    if (!down) return true
    if (event.code === 'Escape') exit()
    else if (state.phase === 'intro' && ['Enter', 'Space'].includes(event.code)) startFight()
    else if (state.phase === 'result' && event.code === 'Enter') startFight()
    else if (!event.repeat && KEY_ACTIONS.has(event.code)) performAction('player', KEY_ACTIONS.get(event.code))
    event.preventDefault?.()
    return true
  }

  function update(deltaSeconds = 0) {
    if (!state.open) return false
    const now = performance.now()
    state.externalUpdateAt = now
    tick(clamp(Number(deltaSeconds) || 0, 0, 0.034), now)
    return true
  }

  root.addEventListener('click', (event) => {
    const control = event.target.closest('[data-arena-control]')
    if (!control || !root.contains(control)) return
    ensureAudio()
    if (control.dataset.arenaControl === 'start' || control.dataset.arenaControl === 'replay') startFight()
    if (control.dataset.arenaControl === 'exit') exit()
  })

  window.addEventListener('keydown', handleKey)
  window.addEventListener('keyup', handleKey)

  updateHud()
  return { launch, exit, isOpen: () => state.open, handleKey, handleGamepad, update }
}
