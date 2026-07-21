const AudioContextClass = window.AudioContext || window.webkitAudioContext

const ENGINE_PROFILES = Object.freeze({
  supercar: { idle: 52, rev: 318, rumble: .48, combustion: .72, intake: .76, exhaust: .46, whine: .08, cutoff: 2350 },
  suv: { idle: 37, rev: 192, rumble: .82, combustion: .58, intake: .46, exhaust: .78, whine: .03, cutoff: 1460 },
  sedan: { idle: 43, rev: 226, rumble: .58, combustion: .52, intake: .44, exhaust: .46, whine: .06, cutoff: 1750 },
  ev: { idle: 66, rev: 520, rumble: .06, combustion: .04, intake: .16, exhaust: .03, whine: .92, cutoff: 3900 },
  bike: { idle: 58, rev: 382, rumble: .34, combustion: .82, intake: .7, exhaust: .58, whine: .12, cutoff: 2850 },
})

function makeNoiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
  const data = buffer.getChannelData(0)
  let value = 0
  for (let index = 0; index < data.length; index += 1) {
    value = value * .965 + (Math.random() * 2 - 1) * .2
    data[index] = value
  }
  return buffer
}

function setSmooth(parameter, value, now, response = .045) {
  parameter.cancelScheduledValues(now)
  parameter.setTargetAtTime(value, now, response)
}

function loopNoise(context, buffer, destination, { type = 'bandpass', frequency = 800, q = .7, gain = 0 } = {}) {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const level = context.createGain()
  source.buffer = buffer
  source.loop = true
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  level.gain.value = gain
  source.connect(filter).connect(level).connect(destination)
  source.start()
  return { source, filter, gain: level }
}

function profileFor(vehicleType = '') {
  const key = String(vehicleType).toLowerCase()
  if (key.includes('bike') || key.includes('motor')) return ENGINE_PROFILES.bike
  if (key.includes('super') || key.includes('apex') || key.includes('r8')) return ENGINE_PROFILES.supercar
  if (key.includes('suv') || key.includes('defender') || key.includes('terra')) return ENGINE_PROFILES.suv
  if (key.includes('electric') || key === 'ev' || key.includes('pulse')) return ENGINE_PROFILES.ev
  return ENGINE_PROFILES.sedan
}

export class AudioDirector {
  constructor({ onState = () => {} } = {}) {
    this.context = null
    this.enabled = true
    this.started = false
    this.onState = onState
    this.engine = null
    this.noiseBuffer = null
    this.track = null
    this.lastGear = 0
    this.lastBrake = 0
    this.lastHandbrake = false
    this.lastDriving = false
    this.lastTransientAt = -10
  }

  async start() {
    if (!AudioContextClass) return false
    if (!this.context) this.createGraph()
    if (this.context.state === 'suspended') await this.context.resume()
    this.started = true
    if (this.track) {
      this.track.volume = this.enabled ? .48 : 0
      await this.track.play().catch(() => false)
    }
    this.setEnabled(this.enabled)
    this.onState({ enabled: this.enabled, started: true })
    return true
  }

  createGraph() {
    const context = new AudioContextClass()
    this.context = context
    this.noiseBuffer = makeNoiseBuffer(context, 2.5)

    this.master = context.createGain()
    this.master.gain.value = .72
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -16
    compressor.knee.value = 20
    compressor.ratio.value = 4
    compressor.attack.value = .006
    compressor.release.value = .28
    this.master.connect(compressor).connect(context.destination)

    this.ambienceGain = context.createGain()
    this.ambienceGain.gain.value = .24
    this.ambienceGain.connect(this.master)

    this.vehicleGain = context.createGain()
    this.vehicleGain.gain.value = 0
    const vehicleTone = context.createBiquadFilter()
    vehicleTone.type = 'lowshelf'
    vehicleTone.frequency.value = 180
    vehicleTone.gain.value = 3.5
    this.vehicleGain.connect(vehicleTone).connect(this.master)
    this.vehicleTone = vehicleTone

    this.createAtmosphere()
    this.createVehicleSoundscape()

    this.track = new Audio('/assets/audio/everything-i-hate-punk-vocal.mp3')
    this.track.loop = true
    this.track.preload = 'auto'
    this.track.volume = .48
  }

  createAtmosphere() {
    const wind = loopNoise(this.context, this.noiseBuffer, this.ambienceGain, {
      type: 'lowpass', frequency: 720, q: .4, gain: .072,
    })
    this.atmosphereWind = wind

    const traffic = this.context.createOscillator()
    const trafficFilter = this.context.createBiquadFilter()
    const trafficGain = this.context.createGain()
    traffic.type = 'triangle'
    traffic.frequency.value = 42
    trafficFilter.type = 'lowpass'
    trafficFilter.frequency.value = 105
    trafficGain.gain.value = .03
    traffic.connect(trafficFilter).connect(trafficGain).connect(this.ambienceGain)
    traffic.start()

    window.setInterval(() => {
      if (!this.started || !this.enabled || this.context.state !== 'running') return
      const now = this.context.currentTime
      const source = this.context.createBufferSource()
      const band = this.context.createBiquadFilter()
      const gain = this.context.createGain()
      source.buffer = this.noiseBuffer
      band.type = 'bandpass'
      band.frequency.value = 760 + Math.random() * 1100
      band.Q.value = 3.2
      gain.gain.setValueAtTime(.0001, now)
      gain.gain.exponentialRampToValueAtTime(.014 + Math.random() * .012, now + .06)
      gain.gain.exponentialRampToValueAtTime(.0001, now + .38 + Math.random() * .35)
      source.connect(band).connect(gain).connect(this.ambienceGain)
      source.start(now, Math.random() * 1.2, .85)
    }, 2850)
  }

  createVehicleSoundscape() {
    const context = this.context
    const engineBus = context.createGain()
    const engineFilter = context.createBiquadFilter()
    engineBus.gain.value = .7
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 1500
    engineFilter.Q.value = .45
    engineBus.connect(engineFilter).connect(this.vehicleGain)

    const waveReal = new Float32Array([0, 1, .22, .12, .06, .03])
    const waveImag = new Float32Array(waveReal.length)
    const combustionWave = context.createPeriodicWave(waveReal, waveImag, { disableNormalization: false })

    const rumble = context.createOscillator()
    const rumbleGain = context.createGain()
    rumble.type = 'sine'
    rumble.frequency.value = 42
    rumbleGain.gain.value = .08
    rumble.connect(rumbleGain).connect(engineBus)

    const combustion = context.createOscillator()
    const combustionGain = context.createGain()
    combustion.setPeriodicWave(combustionWave)
    combustion.frequency.value = 84
    combustionGain.gain.value = .07
    combustion.connect(combustionGain).connect(engineBus)

    const harmonic = context.createOscillator()
    const harmonicGain = context.createGain()
    harmonic.type = 'triangle'
    harmonic.frequency.value = 168
    harmonicGain.gain.value = .025
    harmonic.connect(harmonicGain).connect(engineBus)

    const motor = context.createOscillator()
    const motorGain = context.createGain()
    const motorFilter = context.createBiquadFilter()
    motor.type = 'sine'
    motor.frequency.value = 210
    motorGain.gain.value = .001
    motorFilter.type = 'bandpass'
    motorFilter.frequency.value = 1300
    motorFilter.Q.value = .7
    motor.connect(motorFilter).connect(motorGain).connect(engineBus)

    rumble.start()
    combustion.start()
    harmonic.start()
    motor.start()

    const intake = loopNoise(context, this.noiseBuffer, engineBus, {
      type: 'bandpass', frequency: 1180, q: .8, gain: .001,
    })
    const exhaust = loopNoise(context, this.noiseBuffer, engineBus, {
      type: 'lowpass', frequency: 240, q: .5, gain: .001,
    })
    const road = loopNoise(context, this.noiseBuffer, this.vehicleGain, {
      type: 'bandpass', frequency: 230, q: .45, gain: .001,
    })
    const wind = loopNoise(context, this.noiseBuffer, this.vehicleGain, {
      type: 'highpass', frequency: 1150, q: .35, gain: .001,
    })
    const tire = loopNoise(context, this.noiseBuffer, this.vehicleGain, {
      type: 'bandpass', frequency: 2450, q: 1.1, gain: .001,
    })

    this.engine = {
      engineBus, engineFilter,
      rumble, rumbleGain,
      combustion, combustionGain,
      harmonic, harmonicGain,
      motor, motorFilter, motorGain,
      intake, exhaust, road, wind, tire,
    }
  }

  playNoiseTransient({ duration = .2, gain = .1, frequency = 900, type = 'bandpass', q = .7 } = {}) {
    if (!this.context || this.context.state !== 'running' || !this.enabled) return
    const now = this.context.currentTime
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const level = this.context.createGain()
    source.buffer = this.noiseBuffer
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    level.gain.setValueAtTime(Math.max(.0001, gain), now)
    level.gain.exponentialRampToValueAtTime(.0001, now + duration)
    source.connect(filter).connect(level).connect(this.vehicleGain)
    source.start(now, Math.random() * 1.5, duration + .03)
  }

  playPitchTransient({ from = 170, to = 72, duration = .18, gain = .08, type = 'sine' } = {}) {
    if (!this.context || this.context.state !== 'running' || !this.enabled) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const level = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(20, from), now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration)
    level.gain.setValueAtTime(Math.max(.0001, gain), now)
    level.gain.exponentialRampToValueAtTime(.0001, now + duration)
    oscillator.connect(level).connect(this.vehicleGain)
    oscillator.start(now)
    oscillator.stop(now + duration + .03)
  }

  shiftTransient(speedRatio, isElectric = false) {
    if (!this.context || this.context.currentTime - this.lastTransientAt < .22) return
    this.lastTransientAt = this.context.currentTime
    if (isElectric) {
      this.playPitchTransient({ from: 1050 + speedRatio * 900, to: 620 + speedRatio * 520, duration: .14, gain: .035, type: 'sine' })
      return
    }
    this.playPitchTransient({ from: 118, to: 52, duration: .11, gain: .09, type: 'sine' })
    this.playNoiseTransient({ duration: .13, gain: .055, frequency: 1180 + speedRatio * 900, type: 'highpass' })
    window.setTimeout(() => this.playPitchTransient({ from: 720, to: 1450, duration: .17, gain: .027, type: 'sine' }), 45)
  }

  collision(severity = .6) {
    const amount = Math.min(1, Math.max(.12, severity))
    this.playPitchTransient({ from: 92 + amount * 38, to: 34, duration: .18 + amount * .18, gain: .11 + amount * .13, type: 'sine' })
    this.playNoiseTransient({ duration: .16 + amount * .16, gain: .08 + amount * .14, frequency: 260 + amount * 440, type: 'lowpass', q: .5 })
  }

  setEnabled(value) {
    this.enabled = value
    if (!this.context) {
      this.onState({ enabled: value, started: false })
      return
    }
    const now = this.context.currentTime
    setSmooth(this.master.gain, value ? .72 : .0001, now, .035)
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

  update({
    driving = false,
    vehicleType = 'sedan',
    speedRatio = 0,
    speed = 0,
    throttle = 0,
    brake = 0,
    handbrake = false,
    steering = 0,
    driftIntensity = 0,
  } = {}) {
    if (!this.context || !this.engine) return
    const now = this.context.currentTime
    const profile = profileFor(vehicleType)
    const ratio = Math.min(1, Math.max(0, speedRatio))
    const load = Math.min(1, Math.max(0, throttle))
    const braking = Math.min(1, Math.max(0, brake))
    const drift = Math.min(1, Math.max(0, driftIntensity, handbrake ? ratio * Math.abs(steering) : 0))
    const rpmCurve = Math.pow(ratio, .72)
    const rpm = profile.idle + profile.rev * rpmCurve + load * profile.rev * .12
    const isElectric = profile === ENGINE_PROFILES.ev

    setSmooth(this.vehicleGain.gain, driving && this.enabled ? .42 : .0001, now, driving ? .055 : .12)
    setSmooth(this.engine.rumble.frequency, rpm, now, .035)
    setSmooth(this.engine.combustion.frequency, rpm * (isElectric ? 1.35 : 2), now, .03)
    setSmooth(this.engine.harmonic.frequency, rpm * (isElectric ? 2.6 : 4), now, .025)
    setSmooth(this.engine.motor.frequency, 170 + rpmCurve * 1780 + load * 210, now, .028)
    setSmooth(this.engine.engineFilter.frequency, 460 + ratio * profile.cutoff + load * 720, now, .045)
    setSmooth(this.engine.rumbleGain.gain, profile.rumble * (.09 + load * .055), now, .05)
    setSmooth(this.engine.combustionGain.gain, profile.combustion * (.055 + load * .07), now, .04)
    setSmooth(this.engine.harmonicGain.gain, profile.combustion * (.012 + ratio * .025), now, .04)
    setSmooth(this.engine.motorGain.gain, profile.whine * (.015 + ratio * .1 + load * .025), now, .04)
    setSmooth(this.engine.intake.filter.frequency, 760 + ratio * 2100, now, .06)
    setSmooth(this.engine.intake.gain.gain, profile.intake * load * (.018 + ratio * .045), now, .055)
    setSmooth(this.engine.exhaust.filter.frequency, 150 + ratio * 380, now, .06)
    setSmooth(this.engine.exhaust.gain.gain, profile.exhaust * (.018 + load * .045 + ratio * .025), now, .06)
    setSmooth(this.engine.road.filter.frequency, 150 + ratio * 720, now, .08)
    setSmooth(this.engine.road.gain.gain, driving ? .008 + ratio * .075 : .0001, now, .09)
    setSmooth(this.engine.wind.filter.frequency, 930 + ratio * 2650, now, .08)
    setSmooth(this.engine.wind.gain.gain, driving ? Math.pow(ratio, 1.55) * .065 : .0001, now, .09)
    setSmooth(this.engine.tire.filter.frequency, 1750 + ratio * 2350, now, .045)
    setSmooth(this.engine.tire.gain.gain, driving ? drift * (.08 + ratio * .18) + braking * ratio * .018 : .0001, now, .035)

    const gear = driving ? Math.min(5, Math.max(1, Math.floor(ratio * 5.15) + 1)) : 0
    if (driving && this.lastDriving && gear !== this.lastGear && ratio > .12 && load > .28) this.shiftTransient(ratio, isElectric)
    if (driving && braking > .48 && this.lastBrake <= .48 && Math.abs(speed) > 2.5) {
      this.playNoiseTransient({ duration: .19, gain: .045 + ratio * .055, frequency: 2250, type: 'bandpass', q: 1.4 })
    }
    if (driving && handbrake && !this.lastHandbrake && ratio > .14) {
      this.playPitchTransient({ from: 86, to: 48, duration: .12, gain: .055, type: 'triangle' })
      this.playNoiseTransient({ duration: .18, gain: .07 + ratio * .06, frequency: 3000, type: 'bandpass', q: 1.2 })
    }

    this.lastGear = gear
    this.lastBrake = braking
    this.lastHandbrake = Boolean(handbrake)
    this.lastDriving = Boolean(driving)
  }
}
