import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const PLAYER_ASSET = '/assets/characters/kish_3d_avatar.glb?v=1'
const ROBOT_ASSET = '/assets/characters/third-party/RobotExpressive.glb'

const ARENA_ORIGIN = new THREE.Vector3(23, 0.54, 46)
const RING_RADIUS = 7.35
const FIGHT_LIMIT = 5.65
const ROUND_SECONDS = 60

const MOVES = {
  jab: { label: 'JAB', damage: 6, score: 80, range: 2.05, windup: 0.09, duration: 0.3, lunge: 0.44 },
  hook: { label: 'HOOK', damage: 10, score: 140, range: 2.2, windup: 0.16, duration: 0.47, lunge: 0.58 },
  uppercut: { label: 'UPPERCUT', damage: 13, score: 190, range: 2.0, windup: 0.2, duration: 0.56, lunge: 0.5 },
  kick: { label: 'KICK', damage: 15, score: 230, range: 2.55, windup: 0.24, duration: 0.66, lunge: 0.66 },
  dodge: { label: 'DODGE', damage: 0, score: 0, range: 0, windup: 0, duration: 0.52, lunge: 0 },
  jumpStrike: { label: 'JUMP STRIKE', damage: 19, score: 330, range: 2.65, windup: 0.31, duration: 0.82, lunge: 0.85 },
}

const KEY_MOVES = new Map([
  ['KeyJ', 'jab'], ['KeyH', 'hook'], ['KeyU', 'uppercut'],
  ['KeyK', 'kick'], ['KeyC', 'dodge'], ['Space', 'jumpStrike'],
])

const BUTTON_MOVES = new Map([
  [0, 'jab'], [2, 'hook'], [4, 'uppercut'],
  [3, 'kick'], [1, 'dodge'], [7, 'jumpStrike'],
])

const COMMENTARY = {
  start: ['The Verse Arena is live.', 'Human instinct meets machine precision. Fight.'],
  hit: ['Clean connection.', 'Perfect timing.', 'That found the target.', 'The human reads the opening.'],
  combo: ['The combo is building.', 'Three clean shots.', 'The machine is under pressure.'],
  hurt: ['The synth answers back.', 'The machine found an opening.', 'Reset the distance.'],
  win: ['Human instinct owns the arena.', 'The human takes the round.'],
  lose: ['Machine precision takes the round.', 'The synth closes it out.'],
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const damp = (current, target, smoothing, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * dt))
const pick = (items) => items[Math.floor(Math.random() * items.length)]

function material(color, roughness = 0.62, metalness = 0.18, emissive = 0x000000, intensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity })
}

function createTextTexture(width = 1024, height = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { canvas, context: canvas.getContext('2d'), texture }
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.closePath()
}

function createScoreboard() {
  const surface = createTextTexture(1536, 420)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10.8, 2.95),
    new THREE.MeshBasicMaterial({ map: surface.texture, transparent: true, toneMapped: false }),
  )
  mesh.position.set(0, 4.15, -5.72)
  mesh.rotation.y = 0
  mesh.renderOrder = 8

  let lastSignature = ''
  function update(state, force = false) {
    const signature = [state.phase, Math.ceil(state.timeLeft), state.playerHealth, state.aiHealth, state.score, state.combo].join('|')
    if (!force && signature === lastSignature) return
    lastSignature = signature
    const { context: ctx, canvas, texture } = surface
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, 'rgba(12,14,22,.97)')
    gradient.addColorStop(0.5, 'rgba(31,11,18,.98)')
    gradient.addColorStop(1, 'rgba(10,25,29,.97)')
    ctx.fillStyle = gradient
    roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 44)
    ctx.fill()
    ctx.strokeStyle = '#f3273f'
    ctx.lineWidth = 8
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#f7f3f1'
    ctx.font = '800 46px system-ui, sans-serif'
    ctx.fillText('VERSE FIGHT RING // HUMAN VS MACHINE', canvas.width / 2, 66)
    ctx.fillStyle = '#ff5267'
    ctx.font = '900 112px system-ui, sans-serif'
    ctx.fillText(String(Math.max(0, Math.ceil(state.timeLeft))).padStart(2, '0'), canvas.width / 2, 202)

    const drawHealth = (x, label, health, color, align) => {
      ctx.textAlign = align
      ctx.fillStyle = '#f7f3f1'
      ctx.font = '800 50px system-ui, sans-serif'
      ctx.fillText(label, x, 137)
      const barWidth = 480
      const left = align === 'left' ? x : x - barWidth
      ctx.fillStyle = 'rgba(255,255,255,.12)'
      roundRect(ctx, left, 164, barWidth, 48, 24)
      ctx.fill()
      ctx.fillStyle = color
      roundRect(ctx, left, 164, Math.max(12, barWidth * health / 100), 48, 24)
      ctx.fill()
      ctx.fillStyle = '#d4ced2'
      ctx.font = '700 32px system-ui, sans-serif'
      ctx.fillText(`${Math.ceil(health)} HP`, x, 260)
    }
    drawHealth(86, 'THE HUMAN', state.playerHealth, '#f3273f', 'left')
    drawHealth(canvas.width - 86, 'SYNTH // 07', state.aiHealth, '#62e8f2', 'right')

    ctx.textAlign = 'center'
    ctx.fillStyle = '#f7f3f1'
    ctx.font = '800 38px system-ui, sans-serif'
    if (state.phase === 'ready') ctx.fillText('PRESS ENTER / CROSS TO FIGHT', canvas.width / 2, 346)
    else if (state.phase === 'result') ctx.fillText(state.resultText, canvas.width / 2, 346)
    else ctx.fillText(`SCORE ${String(state.score).padStart(5, '0')}  //  ${state.combo ? `${state.combo}× COMBO` : 'BUILD THE COMBO'}`, canvas.width / 2, 346)
    texture.needsUpdate = true
  }

  return { mesh, update, texture: surface.texture }
}

function cylinderBetween(start, end, radius, mat, radialSegments = 8) {
  const delta = end.clone().sub(start)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), radialSegments), mat)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
  return mesh
}

function createArenaSet() {
  const root = new THREE.Group()
  root.name = 'VerseArena3D'

  const stageMat = material(0x15151d, 0.48, 0.56)
  const matSurface = material(0x25242d, 0.7, 0.18)
  const redNeon = material(0x5a0d1b, 0.25, 0.7, 0xf3273f, 3.1)
  const cyanNeon = material(0x102c33, 0.2, 0.76, 0x60e6f2, 2.8)
  const blackMetal = material(0x121117, 0.34, 0.82)

  const base = new THREE.Mesh(new THREE.CylinderGeometry(9.35, 9.75, 0.7, 8), stageMat)
  base.position.y = 0.06
  base.receiveShadow = true
  root.add(base)

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(RING_RADIUS, RING_RADIUS, 0.22, 8), matSurface)
  floor.position.y = 0.49
  floor.receiveShadow = true
  root.add(floor)

  const centerMark = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.64, 48), redNeon)
  centerMark.rotation.x = -Math.PI / 2
  centerMark.position.y = 0.615
  root.add(centerMark)

  const slash = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.035, 0.22), cyanNeon)
  slash.rotation.y = -0.62
  slash.position.y = 0.63
  root.add(slash)

  const vertices = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + index * Math.PI / 4
    return new THREE.Vector3(Math.sin(angle) * RING_RADIUS, 0.58, Math.cos(angle) * RING_RADIUS)
  })
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0x52606b, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
  const fenceGeometry = new THREE.PlaneGeometry(1, 1, 8, 4)
  const positionAttribute = fenceGeometry.attributes.position
  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index)
    const y = positionAttribute.getY(index)
    positionAttribute.setXY(index, x, y + Math.sin((x + y) * 18) * 0.006)
  }
  for (let index = 0; index < 8; index += 1) {
    const current = vertices[index]
    const next = vertices[(index + 1) % 8]
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 3.9, 10), index % 2 ? cyanNeon : redNeon)
    post.position.copy(current).add(new THREE.Vector3(0, 1.95, 0))
    post.castShadow = true
    root.add(post)

    const midpoint = current.clone().add(next).multiplyScalar(0.5)
    const length = current.distanceTo(next)
    const fence = new THREE.Mesh(fenceGeometry, fenceMat)
    fence.scale.set(length, 3.35, 1)
    fence.position.copy(midpoint).add(new THREE.Vector3(0, 1.92, 0))
    fence.rotation.y = Math.atan2(next.x - current.x, next.z - current.z)
    root.add(fence)
    ;[0.82, 2.05, 3.28].forEach((height, railIndex) => {
      const rail = cylinderBetween(
        current.clone().add(new THREE.Vector3(0, height, 0)),
        next.clone().add(new THREE.Vector3(0, height, 0)),
        railIndex === 1 ? 0.055 : 0.035,
        railIndex === 1 ? blackMetal : (index % 2 ? cyanNeon : redNeon),
        6,
      )
      root.add(rail)
    })
  }

  const crowd = createCrowd()
  root.add(crowd.group)

  const referee = createProceduralPerson(0xf0f1f3, 0x15161d, 1.02)
  referee.root.position.set(0, 0.62, 3.35)
  referee.root.rotation.y = Math.PI
  root.add(referee.root)

  const commentaryDesk = new THREE.Group()
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.05, 1.25), blackMetal)
  desk.position.y = 0.53
  commentaryDesk.add(desk)
  const deskGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.48), new THREE.MeshBasicMaterial({ color: 0xf3273f, toneMapped: false }))
  deskGlow.position.set(0, 0.62, 0.631)
  commentaryDesk.add(deskGlow)
  for (const x of [-1.05, 1.05]) {
    const commentator = createProceduralPerson(x < 0 ? 0x7a364c : 0x285967, 0x17161b, 0.9)
    commentator.root.position.set(x, 0.54, -0.12)
    commentaryDesk.add(commentator.root)
  }
  commentaryDesk.position.set(0, 0.2, 10.2)
  commentaryDesk.rotation.y = Math.PI
  root.add(commentaryDesk)

  const scoreboard = createScoreboard()
  root.add(scoreboard.mesh)

  const redLight = new THREE.SpotLight(0xff2444, 95, 26, 0.48, 0.72, 1.6)
  redLight.position.set(-7, 10, 2)
  redLight.target.position.set(0, 0.5, 0)
  root.add(redLight, redLight.target)
  const cyanLight = new THREE.SpotLight(0x56e8ff, 90, 26, 0.48, 0.72, 1.6)
  cyanLight.position.set(7, 9, -2)
  cyanLight.target.position.set(0, 0.5, 0)
  root.add(cyanLight, cyanLight.target)
  const fillLight = new THREE.PointLight(0xfff0e7, 20, 22, 2)
  fillLight.position.set(0, 7, 0)
  root.add(fillLight)

  return { root, crowd, referee, scoreboard, redLight, cyanLight }
}

function createCrowd() {
  const group = new THREE.Group()
  const count = 72
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.25, 0.58, 3, 6), material(0xffffff, 0.7, 0.08), count)
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 7, 6), material(0xffffff, 0.78, 0.02), count)
  const dummy = new THREE.Object3D()
  const colors = [0xf3273f, 0x4b5265, 0x51cad5, 0xb38a5f, 0x745073, 0x2a303c, 0xe5d4c7]
  const data = []
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 ? 1 : -1
    const row = index % 3
    const angle = (index / count) * Math.PI * 2 + Math.sin(index * 8.31) * 0.08
    const radius = 9.65 + row * 1.05
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    const scale = 0.82 + ((index * 17) % 9) * 0.025
    const y = 1.32 + row * 0.34
    dummy.position.set(x, y, z)
    dummy.scale.setScalar(scale)
    dummy.rotation.y = angle + Math.PI
    dummy.updateMatrix()
    body.setMatrixAt(index, dummy.matrix)
    dummy.position.y = y + 0.72 * scale
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    head.setMatrixAt(index, dummy.matrix)
    body.setColorAt(index, new THREE.Color(colors[index % colors.length]))
    head.setColorAt(index, new THREE.Color(index % 4 === 0 ? 0x7e8793 : [0x714638, 0xa16a52, 0xc99370, 0xdfb293][index % 4]))
    data.push({ x, z, baseY: y, phase: index * 0.83, side })
  }
  body.castShadow = false
  body.receiveShadow = false
  head.castShadow = false
  group.add(body, head)
  return { group, body, head, dummy, data, energy: 0 }
}

function updateCrowd(crowd, elapsed, dt, energy) {
  crowd.energy = damp(crowd.energy, energy, 3.5, dt)
  crowd.data.forEach((member, index) => {
    const bounce = Math.max(0, Math.sin(elapsed * (2.1 + crowd.energy * 3.4) + member.phase)) * (0.025 + crowd.energy * 0.17)
    const scale = 0.82 + ((index * 17) % 9) * 0.025
    crowd.dummy.position.set(member.x, member.baseY + bounce, member.z)
    crowd.dummy.scale.setScalar(scale)
    crowd.dummy.rotation.y = Math.atan2(member.x, member.z) + Math.PI
    crowd.dummy.updateMatrix()
    crowd.body.setMatrixAt(index, crowd.dummy.matrix)
    crowd.dummy.position.y = member.baseY + 0.72 * scale + bounce
    crowd.dummy.updateMatrix()
    crowd.head.setMatrixAt(index, crowd.dummy.matrix)
  })
  crowd.body.instanceMatrix.needsUpdate = true
  crowd.head.instanceMatrix.needsUpdate = true
}

function createProceduralPerson(shirtColor, trousersColor, scale = 1) {
  const root = new THREE.Group()
  root.scale.setScalar(scale)
  const shirt = material(shirtColor, 0.72, 0.06)
  const trousers = material(trousersColor, 0.66, 0.12)
  const skin = material(0xb98267, 0.82, 0.01)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.72, 5, 8), shirt)
  torso.position.y = 1.58
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin)
  head.position.y = 2.42
  root.add(torso, head)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.65, 3, 6), shirt)
    arm.position.set(side * 0.38, 1.52, 0)
    arm.rotation.z = side * -0.1
    root.add(arm)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.72, 3, 6), trousers)
    leg.position.set(side * 0.16, 0.62, 0)
    root.add(leg)
  }
  root.traverse((child) => { if (child.isMesh) child.castShadow = true })
  return { root }
}

function createFallbackFighter(color, robot = false) {
  const root = new THREE.Group()
  const suit = material(color, 0.36, robot ? 0.78 : 0.38, robot ? color : 0x000000, robot ? 0.5 : 0)
  const dark = material(0x171820, 0.44, 0.66)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 6, 10), suit)
  body.position.y = 1.45
  const head = new THREE.Mesh(robot ? new THREE.BoxGeometry(0.52, 0.52, 0.52) : new THREE.SphereGeometry(0.31, 12, 10), suit)
  head.position.y = 2.45
  root.add(body, head)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.82, 4, 8), suit)
    arm.position.set(side * 0.56, 1.53, 0)
    root.add(arm)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.95, 4, 8), dark)
    leg.position.set(side * 0.22, 0.52, 0)
    root.add(leg)
  }
  return root
}

function findClip(clips, expression) {
  return clips.find((clip) => expression.test(clip.name)) || null
}

function mapAvatarClips(clips) {
  const mapped = {
    idle: findClip(clips, /idle|wait|stay/i),
    walk: findClip(clips, /walk/i),
    run: findClip(clips, /run|sprint/i),
    jump: findClip(clips, /jump/i),
  }
  if (clips.length === 4 && clips.every((clip) => /^NlaTrack/i.test(clip.name))) {
    return { idle: clips[0], jump: clips[1], walk: clips[2], run: clips[3] }
  }
  const byDuration = [...clips].sort((a, b) => a.duration - b.duration)
  return {
    idle: mapped.idle || byDuration[byDuration.length - 1],
    walk: mapped.walk || byDuration[Math.min(1, byDuration.length - 1)],
    run: mapped.run || byDuration[0],
    jump: mapped.jump || byDuration[Math.max(0, byDuration.length - 2)],
  }
}

function mapRobotClips(clips) {
  return {
    idle: findClip(clips, /idle/i) || clips[0],
    walk: findClip(clips, /walk/i) || findClip(clips, /run/i) || clips[0],
    run: findClip(clips, /run/i) || findClip(clips, /walk/i) || clips[0],
    jump: findClip(clips, /jump/i) || findClip(clips, /dance/i) || clips[0],
  }
}

function stableClip(source) {
  if (!source) return null
  const clip = source.clone()
  clip.tracks = clip.tracks.filter((track) => !/(^|\.)(Root|Armature|RootNode)\.position$/i.test(track.name))
  return clip
}

function captureBones(model) {
  const candidates = {
    spine: /^(Spine02|Torso|Spine2|Chest)$/i,
    hips: /^(Hip|Hips|Pelvis|Waist|Body)$/i,
    rightUpperArm: /^(R_Upperarm|UpperArm\.R|RightArm|mixamorigRightArm)$/i,
    rightForearm: /^(R_Forearm|LowerArm\.R|RightForeArm|mixamorigRightForeArm)$/i,
    leftUpperArm: /^(L_Upperarm|UpperArm\.L|LeftArm|mixamorigLeftArm)$/i,
    leftForearm: /^(L_Forearm|LowerArm\.L|LeftForeArm|mixamorigLeftForeArm)$/i,
    rightThigh: /^(R_Thigh|UpperLeg\.R|RightUpLeg|mixamorigRightUpLeg)$/i,
    rightCalf: /^(R_Calf|LowerLeg\.R|RightLeg|mixamorigRightLeg)$/i,
    leftThigh: /^(L_Thigh|UpperLeg\.L|LeftUpLeg|mixamorigLeftUpLeg)$/i,
    leftCalf: /^(L_Calf|LowerLeg\.L|LeftLeg|mixamorigLeftLeg)$/i,
  }
  const result = {}
  model.traverse((node) => {
    for (const [key, expression] of Object.entries(candidates)) {
      if (!result[key] && expression.test(node.name)) result[key] = node
    }
  })
  return result
}

function addRotation(bone, x = 0, y = 0, z = 0) {
  if (!bone) return
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)))
}

function createFighter(name, side, color) {
  const group = new THREE.Group()
  group.name = name
  const visual = new THREE.Group()
  group.add(visual)
  const fallback = createFallbackFighter(color, side === 'ai')
  visual.add(fallback)
  return {
    name, side, group, visual, fallback, model: null, mixer: null, clips: {}, action: null,
    activeLocomotion: '', bones: {}, health: 100, velocity: new THREE.Vector3(), moveInput: new THREE.Vector2(),
    hitReaction: 0, hitDirection: 1, invulnerableUntil: 0, attack: null, attackResolved: false,
    actionCooldownUntil: 0, moving: false, loaded: false,
  }
}

function configureModel(model, targetHeight, tint = null) {
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())
  model.scale.setScalar(targetHeight / Math.max(size.y, 0.001))
  model.updateMatrixWorld(true)
  const scaledBounds = new THREE.Box3().setFromObject(model)
  const center = scaledBounds.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -scaledBounds.min.y, -center.z)
  model.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false
    const source = Array.isArray(child.material) ? child.material : [child.material]
    const next = source.map((entry) => {
      if (!entry) return entry
      const cloned = entry.clone()
      cloned.roughness = Math.min(cloned.roughness ?? 0.66, 0.66)
      cloned.metalness = Math.max(cloned.metalness ?? 0.1, 0.1)
      if (tint && cloned.color) cloned.color.lerp(new THREE.Color(tint), 0.18)
      return cloned
    })
    child.material = Array.isArray(child.material) ? next : next[0]
  })
}

function setLocomotion(fighter, name) {
  if (!fighter.mixer || fighter.activeLocomotion === name || !fighter.clips[name]) return
  const previous = fighter.activeLocomotion ? fighter.clips[fighter.activeLocomotion] : null
  const next = fighter.clips[name]
  next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(name === 'walk' ? 1.3 : 1).fadeIn(0.13).play()
  previous?.fadeOut(0.13)
  fighter.activeLocomotion = name
}

function applyFighterPose(fighter, elapsed) {
  fighter.visual.position.set(0, 0, 0)
  fighter.visual.rotation.set(0, 0, 0)
  fighter.visual.scale.set(1, 1, 1)
  if (fighter.hitReaction > 0) {
    const wobble = Math.sin(fighter.hitReaction * Math.PI * 7) * fighter.hitReaction
    fighter.visual.rotation.z = wobble * fighter.hitDirection * 0.16
    fighter.visual.position.x = fighter.hitDirection * fighter.hitReaction * 0.28
    fighter.visual.position.y = Math.sin(fighter.hitReaction * Math.PI) * 0.08
  }
  if (!fighter.attack) return
  const move = MOVES[fighter.attack.name]
  const progress = clamp((elapsed - fighter.attack.startedAt) / move.duration, 0, 1)
  const strike = Math.sin(Math.min(1, progress * 1.7) * Math.PI)
  const recover = Math.sin(progress * Math.PI)
  const direction = fighter.side === 'player' ? 1 : -1
  fighter.visual.position.x += direction * move.lunge * recover

  if (fighter.attack.name === 'jab') {
    addRotation(fighter.bones.rightUpperArm, -1.15 * strike, 0.15 * direction, -0.46 * direction * strike)
    addRotation(fighter.bones.rightForearm, -0.6 * strike, 0, 0)
    fighter.visual.rotation.y = -direction * 0.12 * strike
  } else if (fighter.attack.name === 'hook') {
    addRotation(fighter.bones.leftUpperArm, -0.55 * strike, -0.9 * direction * strike, 0.75 * direction * strike)
    addRotation(fighter.bones.leftForearm, -1.15 * strike, 0, 0)
    addRotation(fighter.bones.spine, 0, -0.5 * direction * strike, 0)
    fighter.visual.rotation.y = -direction * 0.35 * strike
  } else if (fighter.attack.name === 'uppercut') {
    addRotation(fighter.bones.rightUpperArm, -1.28 * strike, -0.3 * direction, -0.7 * direction * strike)
    addRotation(fighter.bones.rightForearm, -1.25 * strike, 0, 0)
    addRotation(fighter.bones.spine, -0.25 * strike, 0, 0.16 * direction * strike)
    fighter.visual.position.y += strike * 0.14
  } else if (fighter.attack.name === 'kick') {
    addRotation(fighter.bones.rightThigh, -1.36 * strike, 0.3 * direction, -0.25 * direction)
    addRotation(fighter.bones.rightCalf, 1.2 * (1 - strike) * recover, 0, 0)
    addRotation(fighter.bones.spine, 0.12, 0, 0.23 * direction * strike)
    fighter.visual.rotation.y = -direction * 0.18 * strike
  } else if (fighter.attack.name === 'dodge') {
    const duck = Math.sin(progress * Math.PI)
    fighter.visual.position.y -= duck * 0.72
    fighter.visual.position.z += direction * duck * 0.32
    addRotation(fighter.bones.spine, 0.58 * duck, 0, 0.22 * direction * duck)
    addRotation(fighter.bones.hips, -0.3 * duck, 0, 0)
  } else if (fighter.attack.name === 'jumpStrike') {
    const arc = Math.sin(progress * Math.PI)
    fighter.visual.position.y += arc * 1.45
    fighter.visual.rotation.z = -direction * arc * 0.08
    addRotation(fighter.bones.leftThigh, -1.15 * strike, 0, 0)
    addRotation(fighter.bones.leftCalf, 0.9 * strike, 0, 0)
    addRotation(fighter.bones.rightThigh, 0.5 * arc, 0, 0)
    addRotation(fighter.bones.spine, -0.35 * arc, 0, 0)
  }
}

function createImpactPool() {
  const root = new THREE.Group()
  const geometry = new THREE.IcosahedronGeometry(0.055, 0)
  const pieces = Array.from({ length: 42 }, (_, index) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: index % 3 ? 0xff3d56 : 0x72ebf4, transparent: true, opacity: 0, toneMapped: false }))
    mesh.visible = false
    root.add(mesh)
    return { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0 }
  })
  const rings = Array.from({ length: 5 }, (_, index) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 5, 24), new THREE.MeshBasicMaterial({ color: index % 2 ? 0xff3550 : 0x68e9f4, transparent: true, opacity: 0, toneMapped: false }))
    mesh.visible = false
    root.add(mesh)
    return { mesh, life: 0, maxLife: 0 }
  })
  let cursor = 0
  let ringCursor = 0
  function burst(position, strength = 1, color = 0xff3550) {
    for (let index = 0; index < 12; index += 1) {
      const piece = pieces[cursor++ % pieces.length]
      piece.life = piece.maxLife = 0.32 + Math.random() * 0.32
      piece.mesh.visible = true
      piece.mesh.position.copy(position)
      piece.mesh.material.color.set(index % 3 ? color : 0xf9efe8)
      piece.mesh.material.opacity = 1
      const angle = Math.random() * Math.PI * 2
      const speed = (2.2 + Math.random() * 4.6) * strength
      piece.velocity.set(Math.cos(angle) * speed, 1.6 + Math.random() * 4.1, Math.sin(angle) * speed)
    }
    const ring = rings[ringCursor++ % rings.length]
    ring.life = ring.maxLife = 0.34
    ring.mesh.visible = true
    ring.mesh.position.copy(position)
    ring.mesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, 0)
    ring.mesh.scale.setScalar(0.35)
    ring.mesh.material.color.set(color)
    ring.mesh.material.opacity = 0.95
  }
  function update(dt) {
    pieces.forEach((piece) => {
      if (piece.life <= 0) return
      piece.life -= dt
      piece.velocity.y -= 11 * dt
      piece.mesh.position.addScaledVector(piece.velocity, dt)
      piece.mesh.material.opacity = clamp(piece.life / piece.maxLife, 0, 1)
      piece.mesh.scale.setScalar(0.65 + (1 - piece.life / piece.maxLife) * 0.85)
      if (piece.life <= 0) piece.mesh.visible = false
    })
    rings.forEach((ring) => {
      if (ring.life <= 0) return
      ring.life -= dt
      const progress = 1 - ring.life / ring.maxLife
      ring.mesh.scale.setScalar(0.35 + progress * 2.2)
      ring.mesh.material.opacity = (1 - progress) * 0.9
      if (ring.life <= 0) ring.mesh.visible = false
    })
  }
  return { root, burst, update }
}

function createAudioDirector() {
  let context = null
  let master = null
  let crowd = null
  let crowdGain = null
  function ensure() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return false
    if (!context) {
      context = new AudioContextClass()
      master = context.createGain()
      master.gain.value = 0.5
      master.connect(context.destination)
    }
    context.resume?.().catch(() => {})
    if (!crowd) {
      const buffer = context.createBuffer(1, context.sampleRate * 2.2, context.sampleRate)
      const samples = buffer.getChannelData(0)
      let last = 0
      for (let index = 0; index < samples.length; index += 1) {
        last = last * 0.94 + (Math.random() * 2 - 1) * 0.06
        samples[index] = last
      }
      crowd = context.createBufferSource()
      crowd.buffer = buffer
      crowd.loop = true
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 680
      filter.Q.value = 0.52
      crowdGain = context.createGain()
      crowdGain.gain.value = 0.035
      crowd.connect(filter).connect(crowdGain).connect(master)
      crowd.start()
    }
    return true
  }
  function tone(frequency, endFrequency, duration, gain, type = 'sine') {
    if (!ensure()) return
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const now = context.currentTime
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration)
    envelope.gain.setValueAtTime(gain, now)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(envelope).connect(master)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }
  function play(kind, strength = 1) {
    if (kind === 'swing') tone(190, 58, 0.08, 0.06 * strength, 'sawtooth')
    if (kind === 'hit') {
      tone(92, 32, 0.15, 0.18 * strength, 'square')
      window.setTimeout(() => tone(510, 120, 0.07, 0.045 * strength, 'sawtooth'), 18)
      if (crowdGain) {
        const now = context.currentTime
        crowdGain.gain.cancelScheduledValues(now)
        crowdGain.gain.setValueAtTime(0.035, now)
        crowdGain.gain.linearRampToValueAtTime(0.14, now + 0.035)
        crowdGain.gain.exponentialRampToValueAtTime(0.035, now + 0.85)
      }
    }
    if (kind === 'bell') {
      tone(930, 690, 0.72, 0.11, 'triangle')
      window.setTimeout(() => tone(1140, 760, 0.52, 0.075, 'triangle'), 130)
    }
    if (kind === 'whoosh') tone(280, 75, 0.18, 0.075 * strength, 'sawtooth')
  }
  function setCrowd(value) {
    if (!crowdGain || !context) return
    crowdGain.gain.setTargetAtTime(0.025 + value * 0.075, context.currentTime, 0.12)
  }
  function stop() {
    if (crowd) {
      try { crowd.stop() } catch {}
      crowd.disconnect()
      crowd = null
      crowdGain = null
    }
    window.speechSynthesis?.cancel()
  }
  return { ensure, play, setCrowd, stop }
}

function createArenaHud() {
  const hud = document.createElement('section')
  hud.className = 'arena-3d-hud'
  hud.setAttribute('aria-live', 'polite')
  hud.innerHTML = `
    <div class="arena-3d-health arena-3d-health--human"><span>THE HUMAN</span><i><b></b></i><small>100 HP</small></div>
    <div class="arena-3d-center"><strong>60</strong><span>VERSE FIGHT RING</span><em>J JAB · H HOOK · U UPPERCUT · K KICK · C DODGE · SPACE JUMP STRIKE · ESC EXIT</em></div>
    <div class="arena-3d-health arena-3d-health--synth"><span>SYNTH // 07</span><i><b></b></i><small>100 HP</small></div>
    <div class="arena-3d-score">SCORE 00000 · BUILD THE COMBO</div>`
  document.querySelector('#world-shell')?.append(hud)
  const humanBar = hud.querySelector('.arena-3d-health--human b')
  const synthBar = hud.querySelector('.arena-3d-health--synth b')
  const humanCopy = hud.querySelector('.arena-3d-health--human small')
  const synthCopy = hud.querySelector('.arena-3d-health--synth small')
  const timer = hud.querySelector('.arena-3d-center strong')
  const score = hud.querySelector('.arena-3d-score')
  return {
    show: () => hud.classList.add('is-visible'),
    hide: () => hud.classList.remove('is-visible'),
    update(state) {
      humanBar.style.width = `${clamp(state.playerHealth, 0, 100)}%`
      synthBar.style.width = `${clamp(state.aiHealth, 0, 100)}%`
      humanCopy.textContent = `${Math.ceil(state.playerHealth)} HP`
      synthCopy.textContent = `${Math.ceil(state.aiHealth)} HP`
      timer.textContent = String(Math.max(0, Math.ceil(state.timeLeft))).padStart(2, '0')
      score.textContent = state.phase === 'result'
        ? state.resultText
        : `SCORE ${String(state.score).padStart(5, '0')} · ${state.combo ? `${state.combo}× COMBO` : 'BUILD THE COMBO'}`
    },
    dispose() { hud.remove() },
  }
}

export function createVerseArena3D({
  scene,
  world = scene,
  camera = null,
  position = ARENA_ORIGIN,
  onExit = () => {},
  onReward = () => {},
  onHaptic = () => {},
} = {}) {
  if (!world?.add) throw new Error('createVerseArena3D requires a THREE.Scene or THREE.Group via { scene } or { world }.')

  const arena = createArenaSet()
  const root = arena.root
  root.position.copy(position?.isVector3 ? position : new THREE.Vector3(position?.x ?? 23, position?.y ?? 0.54, position?.z ?? 46))
  root.visible = false
  world.add(root)

  const player = createFighter('THE HUMAN', 'player', 0xf3273f)
  const ai = createFighter('SYNTH // 07', 'ai', 0x55dbe6)
  player.group.position.set(-2.25, 0.62, 0)
  ai.group.position.set(2.25, 0.62, 0)
  root.add(player.group, ai.group)

  const impacts = createImpactPool()
  root.add(impacts.root)
  const audio = createAudioDirector()
  const hud = createArenaHud()
  const loader = new GLTFLoader()
  const keys = new Set()
  const gamepadMove = new THREE.Vector2()
  const savedCamera = { valid: false, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: 60 }
  const cameraTarget = new THREE.Vector3()
  const cameraPosition = new THREE.Vector3()
  const cameraShake = new THREE.Vector3()

  const state = {
    open: false,
    phase: 'closed',
    timeLeft: ROUND_SECONDS,
    playerHealth: 100,
    aiHealth: 100,
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboUntil: 0,
    elapsed: 0,
    roundStartedAt: 0,
    aiThinkAt: 0,
    resultText: 'ENTER THE ARENA',
    rewardSent: false,
    cameraShake: 0,
    crowdEnergy: 0,
    readyUntil: 0,
  }

  let commentaryAt = 0
  let loadPromise = null

  function speak(line, force = false) {
    if (!line || !('speechSynthesis' in window)) return
    const now = performance.now()
    if (!force && now < commentaryAt) return
    commentaryAt = now + 3000
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(line)
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => /^en/i.test(voice.lang) && /daniel|aaron|rishi|male/i.test(voice.name)) || voices.find((voice) => /^en/i.test(voice.lang)) || null
    utterance.rate = 1.04
    utterance.pitch = 0.82
    utterance.volume = 0.78
    window.speechSynthesis.speak(utterance)
  }

  function loadFighter(fighter, url, robot = false) {
    return new Promise((resolve) => {
      loader.load(url, (gltf) => {
        const model = gltf.scene
        configureModel(model, robot ? 2.32 : 2.38, robot ? 0x63d8e5 : 0xf3273f)
        fighter.visual.remove(fighter.fallback)
        fighter.visual.add(model)
        fighter.model = model
        fighter.bones = captureBones(model)
        fighter.mixer = new THREE.AnimationMixer(model)
        const clips = robot ? mapRobotClips(gltf.animations) : mapAvatarClips(gltf.animations)
        fighter.clips = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip).map(([name, clip]) => [name, fighter.mixer.clipAction(stableClip(clip))]))
        fighter.loaded = true
        setLocomotion(fighter, 'idle')
        resolve(true)
      }, undefined, (error) => {
        console.warn(`Verse Arena 3D: ${fighter.name} model unavailable; using performant fallback.`, error)
        resolve(false)
      })
    })
  }

  function load() {
    if (!loadPromise) loadPromise = Promise.all([loadFighter(player, PLAYER_ASSET, false), loadFighter(ai, ROBOT_ASSET, true)])
    return loadPromise
  }

  function resetRound() {
    Object.assign(state, {
      phase: 'ready', timeLeft: ROUND_SECONDS, playerHealth: 100, aiHealth: 100,
      score: 0, combo: 0, bestCombo: 0, comboUntil: 0, resultText: 'GET READY',
      rewardSent: false, crowdEnergy: 0.2, readyUntil: state.elapsed + 0.85,
    })
    for (const fighter of [player, ai]) {
      fighter.health = 100
      fighter.velocity.set(0, 0, 0)
      fighter.attack = null
      fighter.attackResolved = false
      fighter.actionCooldownUntil = 0
      fighter.hitReaction = 0
      fighter.invulnerableUntil = 0
      setLocomotion(fighter, 'idle')
    }
    player.group.position.set(-2.25, 0.62, 0)
    ai.group.position.set(2.25, 0.62, 0)
    arena.scoreboard.update(state, true)
  }

  function startRound() {
    if (!state.open) return
    state.phase = 'fighting'
    state.roundStartedAt = state.elapsed
    state.aiThinkAt = state.elapsed + 0.65
    state.resultText = 'FIGHT'
    audio.play('bell')
    onHaptic('success')
    speak(pick(COMMENTARY.start), true)
    arena.scoreboard.update(state, true)
  }

  function finishRound(reason = 'time') {
    if (state.phase !== 'fighting') return
    state.phase = 'result'
    player.attack = null
    ai.attack = null
    const playerWon = state.aiHealth < state.playerHealth
    const draw = state.aiHealth === state.playerHealth
    state.resultText = draw ? 'DRAW // ADAPT AND RETURN' : playerWon ? 'HUMAN INSTINCT WINS' : 'SYNTH PRECISION WINS'
    state.crowdEnergy = playerWon ? 1 : 0.42
    audio.play('bell')
    onHaptic(playerWon ? 'success' : 'impact')
    speak(pick(playerWon ? COMMENTARY.win : COMMENTARY.lose), true)
    if (!state.rewardSent) {
      state.rewardSent = true
      onReward({
        completed: true,
        winner: draw ? 'draw' : playerWon ? 'player' : 'ai',
        reason,
        score: state.score,
        bestCombo: state.bestCombo,
        healthRemaining: Math.ceil(state.playerHealth),
        completedAt: new Date().toISOString(),
      })
    }
    arena.scoreboard.update(state, true)
  }

  function moveFighter(fighter, inputX, inputY, dt) {
    if (fighter.attack || fighter.hitReaction > 0.26) {
      fighter.moving = false
      setLocomotion(fighter, 'idle')
      return
    }
    const length = Math.hypot(inputX, inputY)
    if (length < 0.08) {
      fighter.moving = false
      setLocomotion(fighter, 'idle')
      return
    }
    fighter.moving = true
    setLocomotion(fighter, length > 0.78 ? 'run' : 'walk')
    const speed = fighter.side === 'player' ? 3.35 : 2.9
    fighter.velocity.x = damp(fighter.velocity.x, inputX * speed, 12, dt)
    fighter.velocity.z = damp(fighter.velocity.z, inputY * speed, 12, dt)
    fighter.group.position.x += fighter.velocity.x * dt
    fighter.group.position.z += fighter.velocity.z * dt
    const radial = Math.hypot(fighter.group.position.x, fighter.group.position.z)
    if (radial > FIGHT_LIMIT) {
      fighter.group.position.x *= FIGHT_LIMIT / radial
      fighter.group.position.z *= FIGHT_LIMIT / radial
    }
  }

  function faceOpponent(fighter, opponent, dt) {
    const angle = Math.atan2(opponent.group.position.x - fighter.group.position.x, opponent.group.position.z - fighter.group.position.z)
    const target = angle
    const delta = Math.atan2(Math.sin(target - fighter.group.rotation.y), Math.cos(target - fighter.group.rotation.y))
    fighter.group.rotation.y += delta * Math.min(1, dt * 10)
  }

  function performMove(fighter, moveName) {
    if (!state.open) return false
    if (state.phase === 'ready') { startRound(); return true }
    if (state.phase === 'result') { resetRound(); return true }
    if (state.phase !== 'fighting' || !MOVES[moveName] || fighter.attack || state.elapsed < fighter.actionCooldownUntil) return false
    const move = MOVES[moveName]
    fighter.attack = { name: moveName, startedAt: state.elapsed }
    fighter.attackResolved = false
    fighter.actionCooldownUntil = state.elapsed + move.duration + 0.08
    if (moveName === 'jumpStrike') setLocomotion(fighter, 'jump')
    else setLocomotion(fighter, 'idle')
    if (move.damage) audio.play(moveName === 'jumpStrike' ? 'whoosh' : 'swing', move.damage / 12)
    if (moveName === 'dodge') {
      fighter.invulnerableUntil = state.elapsed + move.duration * 0.78
      onHaptic('select')
    }
    return true
  }

  function resolveAttack(attacker, defender) {
    const move = MOVES[attacker.attack.name]
    if (attacker.attackResolved || state.elapsed - attacker.attack.startedAt < move.windup) return
    attacker.attackResolved = true
    if (!move.damage || state.elapsed < defender.invulnerableUntil) {
      if (move.damage && state.elapsed < defender.invulnerableUntil && defender.side === 'player') state.score += 40
      return
    }
    const distance = attacker.group.position.distanceTo(defender.group.position)
    if (distance > move.range) {
      if (attacker.side === 'player') state.combo = 0
      return
    }
    const damageVariance = attacker.side === 'ai' ? 0.78 + Math.random() * 0.25 : 0.94 + Math.random() * 0.16
    const damage = Math.round(move.damage * damageVariance)
    defender.health = Math.max(0, defender.health - damage)
    defender.hitReaction = 1
    defender.hitDirection = attacker.side === 'player' ? 1 : -1
    defender.velocity.x += defender.hitDirection * (1.5 + move.damage * 0.07)
    defender.velocity.z += (Math.random() - 0.5) * 0.8
    state.playerHealth = player.health
    state.aiHealth = ai.health
    state.cameraShake = Math.max(state.cameraShake, 0.18 + move.damage * 0.018)
    state.crowdEnergy = clamp(state.crowdEnergy + 0.26, 0, 1)
    const impact = defender.group.position.clone().add(new THREE.Vector3(0, moveNameHeight(attacker.attack.name), 0))
    impacts.burst(impact, clamp(move.damage / 12, 0.7, 1.5), attacker.side === 'player' ? 0xff3550 : 0x65e7f1)
    audio.play('hit', clamp(move.damage / 10, 0.7, 1.65))
    onHaptic(move.damage >= 15 ? 'success' : 'impact')
    if (attacker.side === 'player') {
      state.combo = state.elapsed < state.comboUntil ? state.combo + 1 : 1
      state.comboUntil = state.elapsed + 1.65
      state.bestCombo = Math.max(state.bestCombo, state.combo)
      state.score += move.score + Math.max(0, state.combo - 1) * 45
      if (state.combo >= 3) speak(pick(COMMENTARY.combo))
      else speak(pick(COMMENTARY.hit))
    } else {
      state.combo = 0
      speak(pick(COMMENTARY.hurt))
    }
    if (defender.health <= 0) finishRound('knockout')
  }

  function moveNameHeight(name) {
    if (name === 'kick') return 1.15
    if (name === 'jumpStrike') return 1.78
    if (name === 'uppercut') return 1.86
    return 1.58
  }

  function updateAttack(fighter, opponent) {
    if (!fighter.attack) return
    resolveAttack(fighter, opponent)
    if (!fighter.attack) return
    const move = MOVES[fighter.attack.name]
    if (state.elapsed - fighter.attack.startedAt >= move.duration) {
      fighter.attack = null
      fighter.attackResolved = false
      setLocomotion(fighter, fighter.moving ? 'walk' : 'idle')
    }
  }

  function updateAi(dt) {
    const offset = player.group.position.clone().sub(ai.group.position)
    const distance = offset.length()
    if (!ai.attack && state.elapsed >= state.aiThinkAt) {
      if (distance > 2.1) {
        offset.normalize()
        moveFighter(ai, offset.x, offset.z, dt)
        state.aiThinkAt = state.elapsed + 0.08
      } else {
        moveFighter(ai, 0, 0, dt)
        const danger = Boolean(player.attack && state.elapsed - player.attack.startedAt < MOVES[player.attack.name].windup + 0.08)
        if (danger && Math.random() < 0.42) performMove(ai, 'dodge')
        else performMove(ai, pick(state.aiHealth < 40 ? ['jab', 'hook', 'uppercut', 'kick', 'jumpStrike'] : ['jab', 'jab', 'hook', 'uppercut', 'kick']))
        state.aiThinkAt = state.elapsed + 0.5 + Math.random() * 0.72
      }
    } else if (!ai.attack) {
      moveFighter(ai, 0, 0, dt)
    }
  }

  function updateCamera(targetCamera = camera, dt = 1 / 60) {
    if (!targetCamera || !state.open) return null
    const playerWorld = player.group.getWorldPosition(new THREE.Vector3())
    const aiWorld = ai.group.getWorldPosition(new THREE.Vector3())
    const center = playerWorld.clone().lerp(aiWorld, 0.42)
    const away = playerWorld.clone().sub(aiWorld).setY(0)
    if (away.lengthSq() < 0.001) away.set(-1, 0, 0)
    away.normalize()
    const side = new THREE.Vector3(-away.z, 0, away.x)
    // Classic side-on fight camera: both fighters stay readable and the cage
    // never sits directly between the player and their opponent.
    cameraPosition.copy(center).addScaledVector(side, 5.05).addScaledVector(away, 0.45).add(new THREE.Vector3(0, 3.25, 0))
    cameraTarget.copy(center).add(new THREE.Vector3(0, 1.18, 0))
    if (state.cameraShake > 0.01) {
      cameraShake.set((Math.random() - 0.5) * state.cameraShake, (Math.random() - 0.5) * state.cameraShake * 0.65, (Math.random() - 0.5) * state.cameraShake)
      cameraPosition.add(cameraShake)
      cameraTarget.addScaledVector(cameraShake, -0.3)
    }
    const blend = 1 - Math.exp(-8.5 * dt)
    targetCamera.position.lerp(cameraPosition, blend)
    const lookMatrix = new THREE.Matrix4().lookAt(targetCamera.position, cameraTarget, targetCamera.up)
    targetCamera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(lookMatrix), blend)
    if ('fov' in targetCamera) {
      targetCamera.fov = damp(targetCamera.fov, state.cameraShake > 0.16 ? 57 : 54, 6, dt)
      targetCamera.updateProjectionMatrix?.()
    }
    return getCameraState()
  }

  function getCameraState() {
    return {
      active: state.open,
      position: cameraPosition.clone(),
      target: cameraTarget.clone(),
      fov: state.cameraShake > 0.16 ? 57 : 54,
      shake: state.cameraShake,
    }
  }

  function launch() {
    if (state.open) return loadPromise || Promise.resolve()
    state.open = true
    state.phase = 'loading'
    root.visible = true
    keys.clear()
    gamepadMove.set(0, 0)
    if (camera) {
      savedCamera.valid = true
      savedCamera.position.copy(camera.position)
      savedCamera.quaternion.copy(camera.quaternion)
      savedCamera.fov = camera.fov
    }
    audio.ensure()
    hud.show()
    resetRound()
    return load()
  }

  function exit() {
    if (!state.open) return
    state.open = false
    state.phase = 'closed'
    keys.clear()
    gamepadMove.set(0, 0)
    player.attack = null
    ai.attack = null
    root.visible = false
    hud.hide()
    audio.stop()
    window.speechSynthesis?.cancel()
    if (camera && savedCamera.valid) {
      camera.position.copy(savedCamera.position)
      camera.quaternion.copy(savedCamera.quaternion)
      camera.fov = savedCamera.fov
      camera.updateProjectionMatrix?.()
      savedCamera.valid = false
    }
    onExit()
  }

  function handleKey(event) {
    if (!state.open || !event) return false
    if (event.__verseArena3DHandled) return true
    event.__verseArena3DHandled = true
    const down = event.type !== 'keyup'
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      if (down) keys.add(event.code)
      else keys.delete(event.code)
      event.preventDefault?.()
      return true
    }
    if (!down) return true
    if (event.code === 'Escape') exit()
    else if (state.phase === 'ready' && ['Enter', 'Space'].includes(event.code)) startRound()
    else if (state.phase === 'result' && event.code === 'Enter') resetRound()
    else if (!event.repeat && KEY_MOVES.has(event.code)) performMove(player, KEY_MOVES.get(event.code))
    event.preventDefault?.()
    return true
  }

  function handleGamepad(event = {}) {
    if (!state.open) return false
    if (event.move || event.type === 'snapshot') {
      gamepadMove.set(clamp(event.move?.x ?? event.axes?.[0] ?? 0, -1, 1), clamp(event.move?.y ?? event.axes?.[1] ?? 0, -1, 1))
      return true
    }
    if (!Number.isInteger(event.index)) return true
    if (event.index === 9) { exit(); return true }
    if (state.phase === 'ready' && event.index === 0) { startRound(); return true }
    if (state.phase === 'result' && event.index === 0) { resetRound(); return true }
    if (BUTTON_MOVES.has(event.index)) performMove(player, BUTTON_MOVES.get(event.index))
    return true
  }

  function update(dt = 0) {
    if (!state.open) return false
    dt = clamp(Number(dt) || 0, 0, 0.04)
    state.elapsed += dt
    state.cameraShake = damp(state.cameraShake, 0, 8, dt)
    state.crowdEnergy = damp(state.crowdEnergy, state.phase === 'fighting' ? 0.22 : 0.1, 0.9, dt)
    if (state.combo && state.elapsed > state.comboUntil) state.combo = 0

    player.mixer?.update(dt)
    ai.mixer?.update(dt)

    if (state.phase === 'ready' && state.elapsed >= state.readyUntil) startRound()
    if (state.phase === 'fighting') {
      state.timeLeft = Math.max(0, ROUND_SECONDS - (state.elapsed - state.roundStartedAt))
      if (state.timeLeft <= 0) finishRound('time')

      const keyboardX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
      const keyboardY = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
      const inputX = Math.abs(gamepadMove.x) > 0.08 ? gamepadMove.x : keyboardX
      const inputY = Math.abs(gamepadMove.y) > 0.08 ? gamepadMove.y : keyboardY
      moveFighter(player, inputX, inputY, dt)
      updateAi(dt)
      updateAttack(player, ai)
      updateAttack(ai, player)
    }

    for (const fighter of [player, ai]) {
      fighter.hitReaction = Math.max(0, fighter.hitReaction - dt * 3.2)
      fighter.group.position.addScaledVector(fighter.velocity, dt)
      fighter.velocity.multiplyScalar(Math.exp(-7 * dt))
      const radial = Math.hypot(fighter.group.position.x, fighter.group.position.z)
      if (radial > FIGHT_LIMIT) {
        fighter.group.position.x *= FIGHT_LIMIT / radial
        fighter.group.position.z *= FIGHT_LIMIT / radial
      }
    }

    const separation = player.group.position.clone().sub(ai.group.position)
    const distance = separation.length()
    if (distance < 1.25) {
      if (distance < 0.001) separation.set(-1, 0, 0)
      separation.normalize().multiplyScalar((1.25 - distance) * 0.5)
      player.group.position.add(separation)
      ai.group.position.sub(separation)
    }

    faceOpponent(player, ai, dt)
    faceOpponent(ai, player, dt)
    applyFighterPose(player, state.elapsed)
    applyFighterPose(ai, state.elapsed)
    impacts.update(dt)
    updateCrowd(arena.crowd, state.elapsed, dt, state.crowdEnergy)
    arena.referee.root.rotation.y = Math.atan2(player.group.position.x, player.group.position.z) + Math.PI
    arena.redLight.intensity = 82 + Math.sin(state.elapsed * 2.4) * 12 + state.crowdEnergy * 18
    arena.cyanLight.intensity = 80 + Math.sin(state.elapsed * 2.1 + 1.4) * 11 + state.crowdEnergy * 16
    audio.setCrowd(state.crowdEnergy)
    arena.scoreboard.update(state)
    hud.update(state)
    if (camera) updateCamera(camera, dt)
    return true
  }

  function dispose() {
    exit()
    root.traverse((object) => {
      object.geometry?.dispose?.()
      if (Array.isArray(object.material)) object.material.forEach((entry) => entry?.dispose?.())
      else object.material?.dispose?.()
    })
    arena.scoreboard.texture.dispose()
    hud.dispose()
    world.remove(root)
  }

  arena.scoreboard.update(state, true)

  return {
    launch,
    exit,
    isOpen: () => state.open,
    update,
    handleKey,
    handleGamepad,
    updateCamera,
    getCameraState,
    getState: () => ({
      phase: state.phase,
      timeLeft: state.timeLeft,
      playerHealth: state.playerHealth,
      aiHealth: state.aiHealth,
      score: state.score,
      combo: state.combo,
      bestCombo: state.bestCombo,
      modelsReady: player.loaded && ai.loaded,
    }),
    root,
    ready: load,
    dispose,
  }
}

export default createVerseArena3D
