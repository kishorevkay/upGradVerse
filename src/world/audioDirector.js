const AudioContextClass = window.AudioContext || window.webkitAudioContext

function makeNoiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
  const data = buffer.getChannelData(0)
  let value = 0
  for (let index = 0; index < data.length; index += 1) {
    value = value * .985 + (Math.random() * 2 - 1) * .15
    data[index] = value
  }
  return buffer
}

export class AudioDirector {
  constructor({ onState = () => {} } = {}) {
    this.context = null
    this.enabled = true
    this.started = false
    this.onState = onState
    this.timer = null
    this.nextStepAt = 0
    this.step = 0
    this.engine = null
    this.noiseBuffer = null
    this.track = null
  }

  async start() {
    if (!AudioContextClass) return false
    if (!this.context) this.createGraph()
    if (this.context.state === 'suspended') await this.context.resume()
    this.started = true
    this.track.volume = this.enabled ? .48 : 0
    await this.track.play().catch(() => false)
    this.setEnabled(this.enabled)
    this.onState({ enabled: this.enabled, started: true })
    return true
  }

  createGraph() {
    const context = new AudioContextClass()
    this.context = context
    this.noiseBuffer = makeNoiseBuffer(context, 2)

    this.master = context.createGain()
    this.master.gain.value = .7
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 18
    compressor.ratio.value = 5
    compressor.attack.value = .008
    compressor.release.value = .22
    this.master.connect(compressor).connect(context.destination)

    this.radioGain = context.createGain()
    this.radioGain.gain.value = 0
    this.radioGain.connect(this.master)
    this.ambienceGain = context.createGain()
    this.ambienceGain.gain.value = .28
    this.ambienceGain.connect(this.master)
    this.vehicleGain = context.createGain()
    this.vehicleGain.gain.value = 0
    this.vehicleGain.connect(this.master)

    this.createAtmosphere()
    this.createEngine()
    this.track = new Audio('/assets/audio/everything-i-hate-punk-vocal.mp3')
    this.track.loop = true
    this.track.preload = 'auto'
    this.track.volume = .48
  }

  createAtmosphere() {
    const context = this.context
    const wind = context.createBufferSource()
    wind.buffer = this.noiseBuffer
    wind.loop = true
    const windFilter = context.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 680
    const windGain = context.createGain()
    windGain.gain.value = .085
    wind.connect(windFilter).connect(windGain).connect(this.ambienceGain)
    wind.start()

    const traffic = context.createOscillator()
    traffic.type = 'sawtooth'
    traffic.frequency.value = 44
    const trafficFilter = context.createBiquadFilter()
    trafficFilter.type = 'lowpass'
    trafficFilter.frequency.value = 120
    const trafficGain = context.createGain()
    trafficGain.gain.value = .045
    traffic.connect(trafficFilter).connect(trafficGain).connect(this.ambienceGain)
    traffic.start()

    window.setInterval(() => {
      if (!this.started || !this.enabled || this.context.state !== 'running') return
      const now = this.context.currentTime
      const chatter = this.context.createBufferSource()
      chatter.buffer = this.noiseBuffer
      const band = this.context.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 720 + Math.random() * 1250
      band.Q.value = 2.8
      const gain = this.context.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(.02 + Math.random() * .018, now + .08)
      gain.gain.exponentialRampToValueAtTime(.0001, now + .42 + Math.random() * .45)
      chatter.connect(band).connect(gain).connect(this.ambienceGain)
      chatter.start(now, Math.random(), .9)
    }, 2350)
  }

  createEngine() {
    const context = this.context
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 540
    const low = context.createOscillator()
    low.type = 'sawtooth'
    low.frequency.value = 48
    const high = context.createOscillator()
    high.type = 'square'
    high.frequency.value = 96
    const highGain = context.createGain()
    highGain.gain.value = .16
    low.connect(filter)
    high.connect(highGain).connect(filter)
    filter.connect(this.vehicleGain)
    low.start()
    high.start()
    this.engine = { low, high, filter }
  }

  scheduleRadio() {
    if (!this.context || this.context.state !== 'running') return
    const stepDuration = 60 / 96 / 4
    while (this.nextStepAt < this.context.currentTime + .22) {
      this.scheduleBeat(this.step, this.nextStepAt)
      this.step = (this.step + 1) % 64
      this.nextStepAt += stepDuration
    }
  }

  scheduleBeat(step, time) {
    const beat = step % 16
    if ([0, 6, 8, 11].includes(beat)) this.kick(time, beat === 0 ? .38 : .25)
    if ([4, 12].includes(beat)) this.snare(time, .18)
    if (beat % 2 === 0) this.hat(time, beat % 4 === 2 ? .055 : .035)

    const bassNotes = [46.25, 46.25, 55, 61.74, 41.2, 41.2, 49, 55]
    if (beat % 2 === 0) this.tone(time, bassNotes[(step / 2 | 0) % bassNotes.length], .21, 'sawtooth', .075, 520)

    if (beat === 0 || beat === 8) {
      const roots = beat === 0 ? [110, 138.59, 164.81] : [98, 123.47, 146.83]
      roots.forEach((frequency, index) => this.tone(time + index * .012, frequency, 1.15, 'triangle', .028, 1450))
    }
    if ([3, 7, 10, 14].includes(beat)) {
      const lead = [329.63, 369.99, 277.18, 246.94][(step / 4 | 0) % 4]
      this.tone(time, lead, .12, 'square', .012, 2300)
    }
  }

  tone(time, frequency, duration, type, volume, cutoff) {
    const oscillator = this.context.createOscillator()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, time)
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    gain.gain.setValueAtTime(.0001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + .018)
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration)
    oscillator.connect(filter).connect(gain).connect(this.radioGain)
    oscillator.start(time)
    oscillator.stop(time + duration + .04)
  }

  kick(time, volume) {
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.frequency.setValueAtTime(120, time)
    oscillator.frequency.exponentialRampToValueAtTime(42, time + .15)
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(.0001, time + .2)
    oscillator.connect(gain).connect(this.radioGain)
    oscillator.start(time)
    oscillator.stop(time + .22)
  }

  snare(time, volume) {
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 1350
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(.0001, time + .12)
    source.connect(filter).connect(gain).connect(this.radioGain)
    source.start(time, 0, .14)
  }

  hat(time, volume) {
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 5200
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(.0001, time + .045)
    source.connect(filter).connect(gain).connect(this.radioGain)
    source.start(time, .2, .06)
  }

  setEnabled(value) {
    this.enabled = value
    if (!this.context) {
      this.onState({ enabled: value, started: false })
      return
    }
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(value ? .7 : .0001, now, .035)
    if (this.track) this.track.volume = value ? .48 : 0
    this.onState({ enabled: value, started: this.started })
  }

  async toggle() {
    if (!this.started) {
      await this.start()
      return
    }
    this.setEnabled(!this.enabled)
  }

  update({ driving = false, speedRatio = 0, throttle = 0 } = {}) {
    if (!this.context || !this.engine) return
    const now = this.context.currentTime
    const targetGain = driving && this.enabled ? .055 + speedRatio * .13 + throttle * .055 : .0001
    this.vehicleGain.gain.setTargetAtTime(targetGain, now, .045)
    this.engine.low.frequency.setTargetAtTime(48 + speedRatio * 132 + throttle * 28, now, .035)
    this.engine.high.frequency.setTargetAtTime(96 + speedRatio * 264 + throttle * 56, now, .035)
    this.engine.filter.frequency.setTargetAtTime(360 + speedRatio * 1250, now, .04)
  }
}
