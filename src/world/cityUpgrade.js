import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

const BUILDING_ASSETS = [
  '/assets/buildings/third-party/kenney-city/building-e.glb',
  '/assets/buildings/third-party/kenney-city/building-g.glb',
  '/assets/buildings/third-party/kenney-city/building-j.glb',
  '/assets/buildings/third-party/kenney-city/building-n.glb',
  '/assets/buildings/third-party/kenney-city/building-skyscraper-a.glb',
  '/assets/buildings/third-party/kenney-city/building-skyscraper-c.glb',
  '/assets/buildings/third-party/kenney-city/building-skyscraper-d.glb',
]

const VEHICLE_ASSETS = {
  supercar: '/assets/vehicles/third-party/sports-car-a.glb',
  suv: '/assets/vehicles/third-party/suv.glb',
  sedan: '/assets/vehicles/third-party/sports-car-b.glb',
  ev: '/assets/vehicles/third-party/sports-car-b.glb',
  bike: '/assets/vehicles/third-party/suzuki-sv650.glb',
}

const BUILDING_SLOTS = [
  [-57, -49, 22, 0], [-42, -51, 17, 0], [-25, -50, 20, 0], [25, -50, 24, 0], [43, -51, 18, 0], [58, -49, 27, 0],
  [-57, 1, 18, Math.PI / 2], [57, 1, 25, -Math.PI / 2], [-57, 44, 28, Math.PI / 2], [57, 45, 22, -Math.PI / 2],
  [-31, 57, 19, Math.PI], [6, 59, 24, Math.PI], [39, 58, 31, Math.PI],
]

const CYBER_COLORS = [0xf3273f, 0x53e7ff, 0xc86cff, 0xffb25f, 0x5ff0ae]

function configureMesh(root, renderer, look = 'default') {
  const cityTint = new THREE.Color(0x65708a)
  root.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    child.receiveShadow = true
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    child.material = materials.map((source) => {
      const entry = source.clone()
      if (entry.map) {
        entry.map.colorSpace = THREE.SRGBColorSpace
        entry.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
      }
      if (look === 'city' && entry.color) {
        entry.color.multiply(cityTint)
        entry.emissive = new THREE.Color(entry.color).multiplyScalar(.035)
        entry.emissiveIntensity = .28
      }
      entry.roughness = Math.max(.34, entry.roughness ?? .7)
      entry.metalness = Math.min(.55, entry.metalness ?? .08)
      return entry
    })
    if (child.material.length === 1) child.material = child.material[0]
  })
}

function normaliseModel(model, target, renderer, { fit = 'height', floor = 0, look = 'default' } = {}) {
  configureMesh(model, renderer, look)
  model.updateMatrixWorld(true)
  let bounds = new THREE.Box3().setFromObject(model)
  let size = bounds.getSize(new THREE.Vector3())
  if (fit === 'vehicle' && size.x > size.z) {
    model.rotation.y += Math.PI / 2
    model.updateMatrixWorld(true)
    bounds = new THREE.Box3().setFromObject(model)
    size = bounds.getSize(new THREE.Vector3())
  }
  const scale = fit === 'vehicle'
    ? Math.min(target.x / Math.max(size.x, .001), target.y / Math.max(size.y, .001), target.z / Math.max(size.z, .001))
    : target / Math.max(size.y, .001)
  model.scale.multiplyScalar(scale)
  model.updateMatrixWorld(true)
  bounds = new THREE.Box3().setFromObject(model)
  const center = bounds.getCenter(new THREE.Vector3())
  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y += floor - bounds.min.y
  model.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
}

function addNeonFrame(group, width, height, depth, accent) {
  const glow = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false })
  const vertical = new THREE.BoxGeometry(.09, height, .09)
  const horizontal = new THREE.BoxGeometry(width, .09, .09)
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(vertical, glow)
    bar.position.set(side * width * .5, height * .5, depth * .5 + .08)
    group.add(bar)
  }
  for (const y of [.12, height - .12]) {
    const bar = new THREE.Mesh(horizontal, glow)
    bar.position.set(0, y, depth * .5 + .08)
    group.add(bar)
  }
  const light = new THREE.PointLight(accent, 7, 13, 2)
  light.position.set(0, Math.min(5, height * .45), depth * .63)
  group.add(light)
}

function createHoloTexture(title, line, accent) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, 1024, 512)
  context.fillStyle = 'rgba(5,8,14,.86)'
  context.fillRect(0, 0, 1024, 512)
  context.strokeStyle = accent
  context.lineWidth = 12
  context.strokeRect(20, 20, 984, 472)
  context.fillStyle = accent
  context.font = '800 78px Arial'
  context.fillText(title, 70, 230)
  context.fillStyle = 'rgba(255,255,255,.76)'
  context.font = '700 30px Arial'
  context.fillText(line, 74, 300)
  context.fillStyle = accent
  context.fillRect(74, 352, 280, 9)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function addHologram(world, x, z, yaw, title, line, accent) {
  const group = new THREE.Group()
  group.position.set(x, .62, z)
  group.rotation.y = yaw
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 3.1),
    new THREE.MeshBasicMaterial({ map: createHoloTexture(title, line, `#${accent.toString(16).padStart(6, '0')}`), transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  )
  screen.position.y = 4.6
  group.add(screen)
  const floor = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.25, 32), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = .03
  group.add(floor)
  group.userData.screen = screen
  world.add(group)
  return group
}

function addCyberTree(world, x, z, scale, accent) {
  const group = new THREE.Group()
  group.position.set(x, .5, z)
  const bark = new THREE.MeshStandardMaterial({ color: 0x332d38, roughness: .9 })
  const leaves = new THREE.MeshStandardMaterial({ color: 0x274c49, roughness: .75, emissive: accent, emissiveIntensity: .13 })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15 * scale, .3 * scale, 2.7 * scale, 9), bark)
  trunk.position.y = 1.35 * scale
  group.add(trunk)
  for (let level = 0; level < 3; level += 1) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry((1.15 - level * .16) * scale, 2), leaves.clone())
    crown.position.set((level - 1) * .18, (2.7 + level * .72) * scale, (level % 2 ? -.12 : .16) * scale)
    group.add(crown)
  }
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(.72 * scale, .82 * scale, .58, 10), new THREE.MeshStandardMaterial({ color: 0x171922, roughness: .44, metalness: .65 }))
  planter.position.y = .29
  group.add(planter)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.72 * scale, .055, 6, 28), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = .58
  group.add(ring)
  world.add(group)
}

function createSteamTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 68, 2, 64, 64, 58)
  gradient.addColorStop(0, 'rgba(210,240,255,.38)')
  gradient.addColorStop(.45, 'rgba(150,190,220,.16)')
  gradient.addColorStop(1, 'rgba(100,150,190,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

function makeArena(world, collisionCircles, interactables) {
  const root = new THREE.Group()
  root.name = 'Verse Fight Ring'
  root.position.set(23, .54, 46)
  const dark = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: .52, metalness: .58 })
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.7, .85, 8), dark)
  floor.position.y = .43
  floor.receiveShadow = true
  root.add(floor)
  const mat = new THREE.MeshStandardMaterial({ color: 0x242735, roughness: .58, metalness: .28 })
  const canvas = new THREE.Mesh(new THREE.CylinderGeometry(6.55, 6.55, .12, 8), mat)
  canvas.position.y = .92
  root.add(canvas)
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0x55e9ff, transparent: true, opacity: .32, wireframe: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  const fence = new THREE.Mesh(new THREE.CylinderGeometry(6.48, 6.48, 3.8, 8, 4, true), fenceMat)
  fence.position.y = 2.78
  root.add(fence)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x16171d, roughness: .36, metalness: .78, emissive: 0xf3273f, emissiveIntensity: .34 })
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + Math.PI / 8
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, 4.25, 8), postMat)
    post.position.set(Math.sin(angle) * 6.45, 2.65, Math.cos(angle) * 6.45)
    root.add(post)
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(8.7, .12, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf3273f, toneMapped: false }))
  halo.rotation.x = Math.PI / 2
  halo.position.y = .15
  root.add(halo)
  const sign = addHologram(root, 0, -8.7, 0, 'VERSE FIGHT', 'HUMAN × MACHINE · LIVE', 0xf3273f)
  sign.scale.setScalar(.72)
  const crowd = []
  for (let index = 0; index < 34; index += 1) {
    const angle = index / 34 * Math.PI * 2
    const radius = 9.3 + (index % 3) * .7
    const body = new THREE.Group()
    const color = CYBER_COLORS[index % CYBER_COLORS.length]
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .62, 3, 6), new THREE.MeshStandardMaterial({ color: index % 4 ? 0x30323a : color, roughness: .68, metalness: .22, emissive: color, emissiveIntensity: index % 4 ? .04 : .22 }))
    torso.position.y = 1.1
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshStandardMaterial({ color: index % 5 ? 0xb59686 : 0x9da9bd, roughness: .72 }))
    head.position.y = 1.8
    body.add(torso, head)
    body.position.set(Math.sin(angle) * radius, .25, Math.cos(angle) * radius)
    body.rotation.y = angle + Math.PI
    body.userData.phase = index * .83
    root.add(body)
    crowd.push(body)
  }
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1, 1.25), dark.clone())
  desk.position.set(0, .85, 9.1)
  root.add(desk)
  for (const x of [-1.25, 1.25]) {
    const commentator = crowd[(x > 0 ? 4 : 3)].clone()
    commentator.position.set(x, .15, 8.25)
    commentator.scale.setScalar(1.08)
    commentator.rotation.y = Math.PI
    root.add(commentator)
  }
  world.add(root)
  collisionCircles.push({ x: 23, z: 46, r: 6.5 })
  interactables.push({ id: 'arena', title: 'Enter Verse Fight Ring', position: new THREE.Vector3(23, 0, 36.8), radius: 4.5, group: root })
  return { root, crowd, fence, halo }
}

function createArenaAudio() {
  let context = null
  let crowdGain = null
  let lastCall = 0
  let enabled = false
  const phrases = [
    'The human closes the distance. Clean jab.',
    'Machine pressure rising. The crowd is on its feet.',
    'Sharp counter from the red corner.',
    'Human instinct versus machine precision.',
  ]
  const start = async () => {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)()
      const duration = 2
      const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (.24 + Math.sin(index * .0007) * .08)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 720
      filter.Q.value = .42
      crowdGain = context.createGain()
      crowdGain.gain.value = 0
      source.connect(filter).connect(crowdGain).connect(context.destination)
      source.start()
    }
    if (context.state === 'suspended') await context.resume()
    enabled = true
  }
  const update = (distance, now, active) => {
    if (!context || !crowdGain) return
    const proximity = active ? THREE.MathUtils.clamp(1 - (distance - 5) / 17, 0, 1) : 0
    crowdGain.gain.setTargetAtTime(proximity * .08, context.currentTime, .22)
    if (proximity > .38 && now - lastCall > 8.5 && !window.speechSynthesis?.speaking) {
      lastCall = now
      const voice = new SpeechSynthesisUtterance(phrases[Math.floor(now / 8.5) % phrases.length])
      voice.rate = .92
      voice.pitch = .72
      voice.volume = .42 * proximity
      const voices = window.speechSynthesis.getVoices()
      voice.voice = voices.find((entry) => /daniel|aaron|rishi|male/i.test(entry.name)) || voices.find((entry) => /^en/i.test(entry.lang)) || null
      window.speechSynthesis.speak(voice)
    }
  }
  return { start, update, get enabled() { return enabled } }
}

export function createCityUpgrade({ world, renderer, collisionCircles, interactables, vehicles, placeholderArchitecture = [] }) {
  const loader = new GLTFLoader()
  const holograms = []
  const steam = []
  const arena = makeArena(world, collisionCircles, interactables)
  const arenaAudio = createArenaAudio()

  const architectureReady = Promise.all(BUILDING_ASSETS.map((url) => loader.loadAsync(url)))
    .then((sources) => {
      const buildings = []
      BUILDING_SLOTS.forEach(([x, z, targetHeight, yaw], index) => {
        const source = sources[index % sources.length]
        const model = source.scene.clone(true)
        const size = normaliseModel(model, targetHeight, renderer, { look: 'city' })
        const group = new THREE.Group()
        group.name = `Licensed city building ${index + 1}`
        group.position.set(x, .52, z)
        group.rotation.y = yaw
        group.add(model)
        const accent = CYBER_COLORS[index % CYBER_COLORS.length]
        addNeonFrame(group, Math.max(3, size.x * .72), Math.min(size.y * .78, 15), Math.max(2, size.z), accent)
        world.add(group)
        collisionCircles.push({ x, z, r: Math.max(2.8, Math.min(6.4, Math.max(size.x, size.z) * .47)) })
        buildings.push(group)
      })
      placeholderArchitecture.forEach((entry) => { entry.visible = false })
      return buildings
    })
    .catch((error) => {
      console.error('Licensed city buildings failed to load', error)
      return []
    })

  Promise.all(Object.entries(VEHICLE_ASSETS).map(async ([classId, url]) => [classId, await loader.loadAsync(url)]))
    .then((entries) => {
      const models = Object.fromEntries(entries)
      vehicles.forEach((vehicle) => {
        const gltf = models[vehicle.classId]
        if (!gltf) return
        const model = gltf.scene.clone(true)
        normaliseModel(model, { x: vehicle.config.width * .98, y: vehicle.config.height * 1.08, z: vehicle.config.length * .98 }, renderer, { fit: 'vehicle', floor: vehicle.config.kind === 'MOTORBIKE' ? .08 : .02 })
        vehicle.proxyBody.visible = false
        vehicle.wheels.forEach(({ steeringPivot }) => { steeringPivot.visible = false })
        model.name = `${vehicle.config.label} licensed GLB body`
        vehicle.visualRoot.add(model)
        vehicle.model = model
      })
    })
    .catch((error) => console.error('Licensed vehicle models failed to load', error))

  ;[
    [-13, -10, 0, 'OPENAI DISTRICT', 'MODEL · MEMORY · CODE', 0x5ff0ae],
    [13, 15, Math.PI, 'HUMAN EDGE', 'DIRECT · QUESTION · VERIFY', 0x53e7ff],
    [-34, 31, 0, 'CLAUDE DISTRICT', 'BUILD WITH CONTEXT', 0xff9b73],
    [52, 19, -Math.PI / 2, 'NIGHT MARKET', 'CREATORS ONLINE', 0xc86cff],
  ].forEach(([x, z, yaw, title, line, accent]) => holograms.push(addHologram(world, x, z, yaw, title, line, accent)))

  const treeSlots = [
    [-62,-29],[-49,-29],[-32,-29],[-17,-29],[17,-29],[33,-29],[49,-29],[62,-29],
    [-62,15],[-49,15],[-31,15],[31,15],[49,15],[62,15],[-62,31],[-49,31],[-31,31],[31,31],[49,31],[62,31],
  ]
  treeSlots.forEach(([x, z], index) => addCyberTree(world, x, z, .78 + (index % 3) * .08, CYBER_COLORS[index % CYBER_COLORS.length]))

  const steamTexture = createSteamTexture()
  ;[[-43,-4],[-43,41],[43,-8],[43,34],[-4,23],[7,-18],[-56,17],[55,-31]].forEach(([x,z], index) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending }))
    sprite.position.set(x, .7, z)
    sprite.scale.set(3.2, 4.8, 1)
    sprite.userData = { baseY: .7, phase: index * .75 }
    world.add(sprite)
    steam.push(sprite)
  })

  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x12131a, roughness: .55, metalness: .7 })
  ;[
    [[-42,7,-8],[-20,10,-4],[0,8,-8],[21,11,-5],[42,8,-8]],
    [[-42,8,37],[-22,12,41],[0,9,38],[21,13,41],[42,9,37]],
  ].forEach((points) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)))
    world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, .055, 6, false), cableMaterial))
  })

  const update = (dt, elapsed, playerPosition, active = true) => {
    holograms.forEach((entry, index) => {
      entry.userData.screen.material.opacity = .68 + Math.sin(elapsed * 2.2 + index) * .16
      entry.position.y = .62 + Math.sin(elapsed * 1.4 + index) * .09
    })
    steam.forEach((entry, index) => {
      const travel = (elapsed * (.22 + index * .015) + entry.userData.phase) % 3.8
      entry.position.y = entry.userData.baseY + travel
      entry.material.opacity = Math.sin(Math.PI * travel / 3.8) * .19
      entry.scale.x = 2.6 + travel * .34
    })
    arena.fence.material.opacity = .24 + Math.sin(elapsed * 2.4) * .08
    arena.halo.scale.setScalar(1 + Math.sin(elapsed * 2.1) * .018)
    arena.crowd.forEach((person, index) => { person.position.y = .25 + Math.abs(Math.sin(elapsed * (2.2 + index % 4 * .14) + person.userData.phase)) * .08 })
    const distance = playerPosition?.distanceTo(arena.root.position) ?? 99
    arenaAudio.update(distance, elapsed, active)
  }

  return { arena, architectureReady, update, startAudio: () => arenaAudio.start() }
}
