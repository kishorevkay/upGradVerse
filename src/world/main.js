import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { GamepadAdapter } from '../input/GamepadAdapter.js'
import { playRumble } from '../input/haptics.js'
import { createChatGPTSkillShop } from '../skillshop/skillshop.js'
import { createClaudeSkillShop } from '../claude-shop/claudeShop.js'
import { createUpgradSkillShop } from '../upgrad-shop/upgradShop.js'
import { createVerseArena3D } from '../arena3d/arena3d.js'
import { AudioDirector } from './audioDirector.js'
import { createCityUpgrade } from './cityUpgrade.js'
import { createTransportUpgrade } from './transportUpgrade.js'
import { createAtmosphereUpgrade } from './atmosphereUpgrade.js'

const NEUTRAL_AVATAR_TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZAAAAABJRU5ErkJggg=='
THREE.DefaultLoadingManager.setURLModifier((url) => /Textures\/colormap\.png(?:$|\?)/i.test(url) ? NEUTRAL_AVATAR_TEXTURE : url)

const $ = (selector) => document.querySelector(selector)
const shell = $('#world-shell')
const canvasHost = $('#world-canvas')
const interactionPrompt = $('#interaction-prompt')
const controllerState = $('#controller-state')
const locationModal = $('#location-modal')
const pauseScreen = $('#pause-screen')
const radarHuman = $('#radar-human')
const radarUpgrad = $('#radar-upgrad')
const radarChatgpt = $('#radar-chatgpt')
const radarClaude = $('#radar-claude')
const radarArena = $('#radar-arena')
const radarDistance = $('#radar-distance')
const radarTitle = $('#radar-title')
const objectiveDistance = $('#objective-distance')
const claudeDistance = $('#claude-distance')
const navigationPanel = $('#navigation-panel')
const navigationToggle = $('#navigation-toggle')
const navigationTarget = $('#navigation-target')
const navigationMeta = $('#navigation-meta')
const savePill = $('#save-pill')
const avatarState = $('#avatar-state')
const audioState = $('#audio-state')

shell.insertAdjacentHTML('beforeend', `
  <div class="simulation-boundary" id="simulation-boundary" aria-hidden="true">
    <i></i><i></i><i></i><i></i>
  </div>
  <section class="vehicle-hud" id="vehicle-hud" aria-live="polite">
    <div class="vehicle-speed"><strong id="vehicle-speed">000</strong><span>KM/H</span></div>
    <div class="vehicle-readout">
      <small id="vehicle-class">VEHICLE</small>
      <b id="vehicle-name">READY</b>
      <span id="vehicle-gear">ENGINE IDLE</span>
    </div>
    <div class="vehicle-camera"><small>CAMERA</small><b id="vehicle-camera">WIDE CHASE</b></div>
    <div class="vehicle-help">R2 / W ACCELERATE · L2 / S BRAKE · SQUARE / SPACE HANDBRAKE · R3 / V CAMERA · TRIANGLE / E EXIT</div>
  </section>
`)
const vehicleHud = $('#vehicle-hud')
const vehicleSpeed = $('#vehicle-speed')
const vehicleClass = $('#vehicle-class')
const vehicleName = $('#vehicle-name')
const vehicleGear = $('#vehicle-gear')
const vehicleCamera = $('#vehicle-camera')

const COLORS = {
  red: 0xf3273f,
  redDeep: 0xd90832,
  black: 0x09080a,
  graphite: 0x17151a,
  concrete: 0x312d32,
  steel: 0x6b6870,
  white: 0xf3efec,
  cyan: 0x78d9e6,
  amber: 0xffb25f,
  violet: 0x8467e8,
  openai: 0x10a37f,
  cream: 0xf4f1eb,
  claude: 0xd97757,
  parchment: 0xf0dfca,
}

const CITY = {
  halfExtent: 69,
  hq: { x: 0, z: -43 },
  chatgpt: { x: -22, z: 1 },
  human: { x: 22, z: 1 },
  claude: { x: -22, z: 43 },
}

const PLAYER_HEIGHT = 2.28
const PLAYER_RADIUS = 0.52
const WALK_SPEED = 3.1
const SPRINT_SPEED = 7.85
const JUMP_VELOCITY = 4.15
const JUMP_GRAVITY = 15.5
const JUMP_AIR_TIME = (JUMP_VELOCITY * 2) / JUMP_GRAVITY
const CAMERA_FOV = 60
const CAMERA_FOV_SPRINT = 64.5
const CAMERA_DISTANCE = 8.8
const CAMERA_PITCH = -0.08
const VEHICLE_INTERACT_RADIUS = 4.6
const VEHICLE_WORLD_RADIUS = 66.8

const VEHICLE_CLASSES = {
  supercar: {
    label: 'Apex R8', kind: 'SUPERCAR', length: 4.65, width: 1.94, height: 1.22,
    maxForward: 29, maxReverse: 8.5, acceleration: 17.5, brake: 24, reverseAcceleration: 9.5,
    coastDrag: 1.2, aeroDrag: 0.019, steering: 1.52, grip: 8.8, wheelRadius: 0.38,
  },
  suv: {
    label: 'Terra Defender', kind: 'SUV', length: 4.95, width: 2.02, height: 1.92,
    maxForward: 22, maxReverse: 7.5, acceleration: 11.8, brake: 19, reverseAcceleration: 8,
    coastDrag: 1.6, aeroDrag: 0.025, steering: 1.28, grip: 10.8, wheelRadius: 0.46,
  },
  sedan: {
    label: 'Executive S7', kind: 'SEDAN', length: 4.72, width: 1.88, height: 1.48,
    maxForward: 24.5, maxReverse: 8, acceleration: 13.5, brake: 20.5, reverseAcceleration: 8.7,
    coastDrag: 1.4, aeroDrag: 0.022, steering: 1.38, grip: 10.1, wheelRadius: 0.4,
  },
  ev: {
    label: 'Pulse City EV', kind: 'COMPACT EV', length: 3.72, width: 1.72, height: 1.58,
    maxForward: 21, maxReverse: 7.2, acceleration: 15.2, brake: 18.5, reverseAcceleration: 8.4,
    coastDrag: 1.7, aeroDrag: 0.027, steering: 1.62, grip: 11.8, wheelRadius: 0.35,
  },
  bike: {
    label: 'Neon SV', kind: 'MOTORBIKE', length: 2.18, width: .78, height: 1.28,
    maxForward: 25.5, maxReverse: 6.4, acceleration: 16.8, brake: 21, reverseAcceleration: 7.6,
    coastDrag: 1.28, aeroDrag: 0.021, steering: 1.82, grip: 8.4, wheelRadius: .34,
  },
}

const VEHICLE_CAMERAS = [
  { name: 'WIDE CHASE', distance: 13.2, height: 4.7, targetHeight: 1.15, fov: 68 },
  { name: 'CLOSE TPV', distance: 6.6, height: 2.45, targetHeight: 1.05, fov: 61 },
  { name: 'COCKPIT FPV', distance: 0, height: 1.16, targetHeight: 1.12, fov: 72 },
]

const state = {
  started: false,
  paused: false,
  modalOpen: false,
  modalLocationId: null,
  activeGamepad: null,
  gamepadMove: { x: 0, y: 0 },
  gamepadCamera: { x: 0, y: 0 },
  gamepadButtons: [],
  keys: new Set(),
  nearLocation: null,
  objectiveId: 'chatgpt',
  cameraYaw: 0,
  cameraPitch: CAMERA_PITCH,
  cameraYawTarget: 0,
  cameraPitchTarget: CAMERA_PITCH,
  cameraDistance: CAMERA_DISTANCE,
  cameraDistanceTarget: CAMERA_DISTANCE,
  cameraInputTimer: 0,
  moveMagnitude: 0,
  sprinting: false,
  drivingVehicle: null,
  nearVehicle: null,
  pendingVehicle: null,
  pendingExit: false,
  vehicleCameraMode: 0,
  vehicleCameraYawOffset: 0,
  vehicleCameraPitch: -0.03,
  vehicleCameraInputTimer: 0,
  pointerDown: false,
  pointerX: 0,
  pointerY: 0,
  grounded: true,
  jumpOffset: 0,
  jumpVelocity: 0,
  jumpElapsed: 0,
  boundaryIntensity: 0,
  lastSave: 0,
}

const audio = new AudioDirector({
  onState({ enabled, started }) {
    audioState.classList.toggle('is-muted', !enabled)
    audioState.setAttribute('aria-pressed', String(enabled))
    audioState.querySelector('span').textContent = enabled
      ? (started ? 'VERSE RADIO 96.0 · EVERYTHING I HATE' : 'VERSE RADIO · READY')
      : 'VERSE RADIO · MUTED'
  },
})

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x11131c)
scene.fog = new THREE.FogExp2(0x302b38, 0.0065)

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.06, 260)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.16
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.tabIndex = 0
canvasHost.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xdce8ff, 0x554b5c, 2.55))
const keyLight = new THREE.DirectionalLight(0xffeee5, 3.35)
keyLight.position.set(-34, 52, 30)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(1024, 1024)
keyLight.shadow.camera.left = -74
keyLight.shadow.camera.right = 74
keyLight.shadow.camera.top = 74
keyLight.shadow.camera.bottom = -74
keyLight.shadow.camera.near = 3
keyLight.shadow.camera.far = 145
keyLight.shadow.bias = -.00035
scene.add(keyLight)
const cityFill = new THREE.PointLight(0x9eb9ff, 30, 105, 2)
cityFill.position.set(0, 16, -15)
scene.add(cityFill)
const plazaFill = new THREE.PointLight(0xffd2bd, 18, 68, 2)
plazaFill.position.set(-18, 11, 18)
scene.add(plazaFill)

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(220, 36, 22),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x142544) },
      horizonColor: { value: new THREE.Color(0x74677f) },
      lowerColor: { value: new THREE.Color(0x2f2938) },
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){vec4 worldPosition=modelMatrix*vec4(position,1.0);vWorldPosition=worldPosition.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 lowerColor;
      void main(){
        vec3 d=normalize(vWorldPosition); float h=d.y;
        vec3 c=mix(lowerColor,mix(horizonColor,topColor,smoothstep(.02,.72,h)),smoothstep(-.28,.05,h));
        float band=1.0-smoothstep(.09,.31,abs(dot(d,normalize(vec3(.22,1.0,-.18)))-.23));
        c+=vec3(.12,.105,.25)*band*.88;
        float sunset=1.0-smoothstep(.0,.32,length(d.xy-vec2(-.42,.08)));
        c+=vec3(.3,.13,.09)*sunset*.42;
        gl_FragColor=vec4(c,1.0);
      }`,
  }),
)
scene.add(sky)

let seed = 98173
const random = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function addStarfield(count, radius, color, size, band = false) {
  const points = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const longitude = random() * Math.PI * 2
    const latitude = band ? (random() - 0.5) * 0.3 + Math.sin(longitude * 1.6) * 0.1 : 0.03 + random() * 1.38
    const spread = radius - random() * 18
    points[index * 3] = Math.cos(longitude) * Math.cos(latitude) * spread
    points[index * 3 + 1] = Math.sin(latitude) * spread
    points[index * 3 + 2] = Math.sin(longitude) * Math.cos(latitude) * spread
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: band ? 0.72 : 0.98, depthWrite: false, fog: false }))
  if (band) { stars.rotation.x = -0.38; stars.rotation.z = 0.31 }
  scene.add(stars)
  return stars
}

const distantStars = addStarfield(760, 185, 0xe9efff, 0.55)
const galaxyStars = addStarfield(520, 177, 0xffabc1, 0.72, true)
const moon = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd5c1, fog: false }))
moon.position.set(-88, 76, -142)
scene.add(moon)

const planet = new THREE.Group()
planet.position.set(72, 37, -150)
const planetBody = new THREE.Mesh(
  new THREE.SphereGeometry(10.5, 28, 18),
  new THREE.MeshBasicMaterial({ color: 0x7486b9, fog: false }),
)
const planetShade = new THREE.Mesh(
  new THREE.SphereGeometry(10.7, 28, 18, 0, Math.PI),
  new THREE.MeshBasicMaterial({ color: 0x17234c, transparent: true, opacity: 0.62, fog: false }),
)
planetShade.rotation.y = -0.72
const planetRing = new THREE.Mesh(
  new THREE.RingGeometry(14.2, 18.4, 64),
  new THREE.MeshBasicMaterial({ color: 0xff9bad, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false, fog: false }),
)
planetRing.rotation.x = 1.2
planetRing.rotation.z = -0.28
planet.add(planetBody, planetShade, planetRing)
scene.add(planet)

const material = (color, roughness = 0.78, metalness = 0.08, emissive = 0x000000, emissiveIntensity = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity })

function mesh(geometry, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, roughness, metalness, emissive, emissiveIntensity } = {}) {
  const item = new THREE.Mesh(geometry, material(color, roughness, metalness, emissive, emissiveIntensity))
  item.position.set(x, y, z)
  item.rotation.set(rx, ry, rz)
  item.castShadow = true
  item.receiveShadow = true
  return item
}

const world = new THREE.Group()
scene.add(world)
const collisionCircles = []
const interactables = []
const movingCars = []
const vehicles = []
const driverWalkers = []
const driftSmoke = []
const placeholderArchitecture = []

const platform = mesh(new THREE.BoxGeometry(146, 5.5, 146), 0x24252b, { y: -2.8, roughness: 0.94 })
world.add(platform)
const ground = mesh(new THREE.BoxGeometry(140, 0.45, 140), 0x49484d, { y: 0, roughness: 0.96 })
world.add(ground)

function makeAsphaltTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  context.fillStyle = '#2b2c30'
  context.fillRect(0, 0, 256, 256)
  for (let index = 0; index < 7200; index += 1) {
    const value = 28 + Math.floor(random() * 38)
    context.fillStyle = `rgba(${value},${value},${value + 2},${.04 + random() * .12})`
    context.fillRect(random() * 256, random() * 256, .5 + random() * 1.8, .5 + random() * 1.8)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(9, 9)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

const asphaltTexture = makeAsphaltTexture()
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x34353a, map: asphaltTexture, bumpMap: asphaltTexture, bumpScale: .045, roughness: .79, metalness: .1 })
const sidewalkMaterial = material(0x69686c, 0.93, 0.02)
const curbMaterial = material(0xa09da0, 0.82, 0.04)

function addCityRoad(x, z, width, depth) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), roadMaterial)
  road.position.set(x, 0.39, z)
  world.add(road)
  return road
}

function addCityBlock(x, z, width, depth, tone = 0x606065) {
  const block = new THREE.Group()
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.34, depth), sidewalkMaterial.clone())
  slab.material.color.setHex(tone)
  slab.position.y = 0.49
  const curb = new THREE.Mesh(new THREE.BoxGeometry(width + .45, .18, depth + .45), curbMaterial)
  curb.position.y = .37
  block.add(curb, slab)
  block.position.set(x, 0, z)
  world.add(block)
  return block
}

// A compact city grid: a grand boulevard, two cross streets, and two side streets.
addCityRoad(0, 23, 13.5, 92)
addCityRoad(0, -18, 132, 13)
addCityRoad(0, 23, 132, 12)
addCityRoad(-42, 8, 10.5, 122)
addCityRoad(42, 8, 10.5, 122)

;[
  [-56,-43,20,36,0x58585d],[-25,-43,48,36,0x626166],[25,-43,48,36,0x5c5b60],[56,-43,20,36,0x626166],
  [-56,2,20,28,0x626166],[-23,2,24,28,0x666469],[23,2,24,28,0x646267],[56,2,20,28,0x5c5b60],
  [-56,46,20,34,0x5c5b60],[-23,46,24,34,0x666469],[23,46,24,34,0x626166],[56,46,20,34,0x5c5b60],
].forEach(([x,z,width,depth,tone]) => addCityBlock(x,z,width,depth,tone))

function addLaneDash(x, z, vertical = true, length = 2.6) {
  world.add(mesh(new THREE.BoxGeometry(vertical ? .11 : length, .025, vertical ? length : .11), 0xe9e5e0, { x, y: .495, z, emissive: 0x6b6460, emissiveIntensity: .18 }))
}

for (const x of [-42, 0, 42]) {
  const start = x === 0 ? -20 : -61
  for (let z = start; z <= 65; z += 7) addLaneDash(x, z, true)
}
for (const z of [-18, 23]) for (let x = -64; x <= 64; x += 7) addLaneDash(x, z, false)

function addCrosswalk(x, z, horizontalRoad = true) {
  for (let index = -3; index <= 3; index += 1) {
    const stripe = horizontalRoad
      ? mesh(new THREE.BoxGeometry(.7, .03, 4.7), 0xe8e4df, { x: x + index * 1.22, y: .515, z })
      : mesh(new THREE.BoxGeometry(4.7, .03, .7), 0xe8e4df, { x, y: .515, z: z + index * 1.22 })
    world.add(stripe)
  }
}

for (const x of [-42, 0, 42]) for (const z of [-18, 23]) {
  addCrosswalk(x, z - 4.4, true)
  addCrosswalk(x + 4.4, z, false)
}

const boundaryGridMaterial = new THREE.MeshBasicMaterial({
  color: 0xb9f6ff,
  transparent: true,
  opacity: 0,
  wireframe: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const boundaryField = new THREE.Mesh(
  new THREE.BoxGeometry(138, 13.5, 138, 28, 5, 28),
  boundaryGridMaterial,
)
boundaryField.position.y = 7.15
boundaryField.visible = false
world.add(boundaryField)

const boundaryRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xe7fbff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const boundaryRings = [1.1, 4.25, 7.4, 10.55, 13.7].map((height) => {
  const ring = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(137.7, .04, 137.7)),
    new THREE.LineBasicMaterial({ color: 0xe7fbff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  )
  ring.position.y = height
  ring.visible = false
  world.add(ring)
  return ring
})

const boundaryFragmentPositions = new Float32Array(210 * 3)
for (let index = 0; index < 210; index += 1) {
  const side = Math.floor(random() * 4)
  const along = -68.4 + random() * 136.8
  boundaryFragmentPositions[index * 3] = side < 2 ? (side === 0 ? -68.5 : 68.5) : along
  boundaryFragmentPositions[index * 3 + 1] = .7 + random() * 12.9
  boundaryFragmentPositions[index * 3 + 2] = side >= 2 ? (side === 2 ? -68.5 : 68.5) : along
}
const boundaryFragmentGeometry = new THREE.BufferGeometry()
boundaryFragmentGeometry.setAttribute('position', new THREE.BufferAttribute(boundaryFragmentPositions, 3))
const boundaryFragmentMaterial = new THREE.PointsMaterial({
  color: 0xd9fbff,
  size: .22,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const boundaryFragments = new THREE.Points(boundaryFragmentGeometry, boundaryFragmentMaterial)
boundaryFragments.visible = false
world.add(boundaryFragments)

function addLightPost(x, z, red = false) {
  const post = new THREE.Group()
  post.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.8, 8), 0x2a282e, { y: 1.9, metalness: 0.6 }))
  const glowColor = red ? 0xff9aa7 : COLORS.cyan
  post.add(mesh(new THREE.SphereGeometry(0.23, 10, 8), glowColor, { y: 3.86, emissive: glowColor, emissiveIntensity: 1.8 }))
  post.position.set(x, 0.45, z)
  world.add(post)
}

for (const x of [-48,-36,-7,7,36,48]) for (const z of [-54,-31,-9,12,34,58]) {
  if ((Math.abs(x) < 10 && z < -25) || (Math.abs(x - CITY.chatgpt.x) < 10 && Math.abs(z - CITY.chatgpt.z) < 14)) continue
  addLightPost(x, z, (Math.abs(x) + Math.abs(z)) % 3 < 1)
}

function addStreetTree(x, z, scale = 1) {
  const tree = new THREE.Group()
  tree.add(mesh(new THREE.CylinderGeometry(.16 * scale, .22 * scale, 2.2 * scale, 8), 0x3d2b23, { y: 1.1 * scale, roughness: .92 }))
  tree.add(mesh(new THREE.IcosahedronGeometry(1.05 * scale, 1), 0x3f6655, { y: 2.75 * scale, roughness: .96 }))
  tree.position.set(x, .53, z)
  world.add(tree)
}

for (const [x,z] of [[-52,-28],[-33,-28],[33,-28],[52,-28],[-52,16],[-31,16],[31,16],[52,16],[-52,31],[-31,31],[31,31],[52,31],[-52,62],[31,62],[52,62]]) addStreetTree(x,z,.82)

function addStorefront({ x, z, width = 8.5, depth = 7, height = 7.5, rotation = 0, color = 0x26232a, accent = COLORS.red }) {
  const shop = new THREE.Group()
  shop.position.set(x, .5, z)
  shop.rotation.y = rotation
  shop.add(mesh(new THREE.BoxGeometry(width, height, depth), color, { y: height / 2, roughness: .78, metalness: .1 }))
  shop.add(mesh(new THREE.BoxGeometry(width * .88, height * .52, .12), 0x12171c, { y: height * .43, z: depth / 2 + .07, roughness: .2, metalness: .48, emissive: accent, emissiveIntensity: .16 }))
  shop.add(mesh(new THREE.BoxGeometry(width * .96, .32, 1.2), accent, { y: height * .69, z: depth / 2 + .52, roughness: .42, emissive: accent, emissiveIntensity: .45 }))
  shop.add(mesh(new THREE.BoxGeometry(width * .74, .72, .13), 0xe9ddd5, { y: height * .82, z: depth / 2 + .09, roughness: .6, emissive: accent, emissiveIntensity: .14 }))
  shop.add(mesh(new THREE.BoxGeometry(width * .2, 2.6, .16), 0x0b0d10, { y: 1.35, z: depth / 2 + .1, metalness: .42 }))
  for (const offset of [-.29, 0, .29]) {
    shop.add(mesh(new THREE.BoxGeometry(width * .2, 2.15, .1), 0xb5d8e1, { x: width * offset, y: 1.45, z: depth / 2 + .14, roughness: .18, metalness: .3, emissive: 0x506f77, emissiveIntensity: .35 }))
  }
  shop.add(mesh(new THREE.BoxGeometry(width * 1.08, .18, depth * 1.08), 0x8e878b, { y: .14, roughness: .92 }))
  world.add(shop)
  placeholderArchitecture.push(shop)
  collisionCircles.push({ x, z, r: Math.max(width, depth) * .57 })
}

[
  { x: 53, z: -30, rotation: -Math.PI / 2, accent: 0x5ed2d6 },
  { x: 53, z: 9, rotation: -Math.PI / 2, accent: 0xf1a45e },
  { x: 53, z: 36, rotation: -Math.PI / 2, accent: 0xb77cff },
  { x: -53, z: 10, rotation: Math.PI / 2, accent: 0xe76079 },
  { x: 18, z: 55, rotation: Math.PI, accent: 0x6fd8a9 },
  { x: 31, z: 55, rotation: Math.PI, accent: 0xf1c66b },
].forEach(addStorefront)

function makeStreetSignTexture(title, subtitle, accent = '#f3273f') {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  context.fillStyle = '#0b0c10'
  context.fillRect(0, 0, 1024, 512)
  context.fillStyle = accent
  context.fillRect(0, 0, 18, 512)
  context.fillStyle = '#f6f1ed'
  context.font = '800 82px Arial'
  context.fillText(title, 78, 226)
  context.fillStyle = 'rgba(246,241,237,.58)'
  context.font = '700 31px Arial'
  context.fillText(subtitle, 82, 294)
  context.fillStyle = accent
  context.fillRect(82, 344, 250, 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

function addStreetBillboard(x, z, rotation, title, subtitle, accent) {
  const group = new THREE.Group()
  group.position.set(x, .54, z)
  group.rotation.y = rotation
  group.add(mesh(new THREE.BoxGeometry(7.4, 3.7, .22), 0x111217, { y: 4.4, metalness: .68, roughness: .3 }))
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.85, 3.15),
    new THREE.MeshBasicMaterial({ map: makeStreetSignTexture(title, subtitle, accent), toneMapped: false }),
  )
  screen.position.set(0, 4.4, .13)
  group.add(screen)
  for (const supportX of [-2.3, 2.3]) group.add(mesh(new THREE.CylinderGeometry(.1, .14, 4.9, 8), 0x292b31, { x: supportX, y: 2.08, metalness: .72 }))
  world.add(group)
}

addStreetBillboard(24, -27.4, 0, 'SKILLS, PLAYED.', 'LEARN BY DOING · UPGRADVERSE', '#f3273f')
addStreetBillboard(-53.7, 43, Math.PI / 2, 'HUMAN + AI', 'DIRECT THE SYSTEM · KEEP THE EDGE', '#78d9e6')
addStreetBillboard(53.7, -6, -Math.PI / 2, 'BUILD WHAT\'S NEXT', 'LIVE SKILL DISTRICT · OPEN 24/7', '#d97757')

function addStreetFurniture(x, z, rotation = 0, kind = 'bench') {
  const group = new THREE.Group()
  group.position.set(x, .54, z)
  group.rotation.y = rotation
  if (kind === 'bench') {
    group.add(mesh(new THREE.BoxGeometry(2.4, .16, .54), 0x5c4437, { y: .62, roughness: .88 }))
    group.add(mesh(new THREE.BoxGeometry(2.4, .72, .13), 0x5c4437, { y: 1.02, z: .23, roughness: .88 }))
    for (const side of [-.82, .82]) group.add(mesh(new THREE.BoxGeometry(.12, .7, .12), 0x25262b, { x: side, y: .32, metalness: .55 }))
  } else if (kind === 'bin') {
    group.add(mesh(new THREE.CylinderGeometry(.34, .42, .92, 10), 0x252b2d, { y: .46, roughness: .52, metalness: .45 }))
    group.add(mesh(new THREE.TorusGeometry(.31, .05, 6, 18), 0x6ed2b5, { y: .94, rx: Math.PI / 2, emissive: 0x2d725e, emissiveIntensity: .45 }))
  } else {
    group.add(mesh(new THREE.CylinderGeometry(.1, .13, 1.12, 8), 0x3b3d43, { y: .56, metalness: .62 }))
    group.add(mesh(new THREE.CylinderGeometry(.18, .18, .09, 8), 0xf2a65d, { y: 1.06, emissive: 0xf2a65d, emissiveIntensity: .9 }))
  }
  world.add(group)
}

;[
  [-30,-11,0,'bench'],[-13,-11,0,'bench'],[14,16,Math.PI,'bench'],[31,16,Math.PI,'bench'],[-34,31,0,'bench'],[33,31,Math.PI,'bench'],
  [-54,-15,0,'bin'],[-31,17,0,'bin'],[31,-11,0,'bin'],[54,18,0,'bin'],[-11,58,0,'bin'],
].forEach(([x,z,rotation,kind]) => addStreetFurniture(x,z,rotation,kind))
for (const x of [-7.5, 7.5]) for (const z of [-13.2, 18.2, 28.2]) addStreetFurniture(x,z,0,'bollard')

const puddleMaterial = new THREE.MeshPhysicalMaterial({ color: 0x263143, roughness: .13, metalness: .12, transparent: true, opacity: .52, clearcoat: 1, clearcoatRoughness: .08, depthWrite: false })
;[
  [-30,-20,5.2,1.1,.15],[23,-16,4.1,.8,-.2],[-4,16,1.1,5.2,.08],[4,43,.8,4.4,-.14],[-44,8,.75,5.8,.03],[43,49,.82,4.8,-.08],
].forEach(([x,z,width,depth,rotation]) => {
  const puddle = new THREE.Mesh(new THREE.PlaneGeometry(width,depth), puddleMaterial.clone())
  puddle.rotation.set(-Math.PI/2,0,rotation)
  puddle.position.set(x,.505,z)
  puddle.receiveShadow = true
  world.add(puddle)
})

function addBackdropSkyline() {
  const count = 52
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1)
  const bodyMaterial = material(0x22242c, .84, .16)
  const windowMaterial = material(0xc9d6ee, .4, .16, 0x8ba7d8, .72)
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count)
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, .035), windowMaterial, count)
  const bodyDummy = new THREE.Object3D()
  const windowDummy = new THREE.Object3D()
  for (let index = 0; index < count; index += 1) {
    const side = index % 4
    const along = -74 + random() * 148
    const edge = 76 + random() * 20
    const width = 5.5 + random() * 8
    const depth = 5.5 + random() * 8
    const height = 16 + random() * 52
    const x = side < 2 ? (side === 0 ? -edge : edge) : along
    const z = side >= 2 ? (side === 2 ? -edge : edge) : along
    bodyDummy.position.set(x, height / 2 - .4, z)
    bodyDummy.scale.set(width, height, depth)
    bodyDummy.updateMatrix()
    bodies.setMatrixAt(index, bodyDummy.matrix)
    bodies.setColorAt(index, new THREE.Color().setHSL(.64 + random() * .07, .08 + random() * .12, .1 + random() * .09))

    const inwardYaw = side === 0 ? Math.PI / 2 : side === 1 ? -Math.PI / 2 : side === 2 ? 0 : Math.PI
    windowDummy.position.set(
      x + (side === 0 ? width / 2 + .03 : side === 1 ? -width / 2 - .03 : 0),
      height * .56,
      z + (side === 2 ? depth / 2 + .03 : side === 3 ? -depth / 2 - .03 : 0),
    )
    windowDummy.rotation.set(0, inwardYaw, 0)
    windowDummy.scale.set(side < 2 ? depth * .72 : width * .72, height * .6, 1)
    windowDummy.updateMatrix()
    windows.setMatrixAt(index, windowDummy.matrix)
  }
  bodies.castShadow = false
  bodies.receiveShadow = true
  windows.castShadow = false
  world.add(bodies, windows)
}

addBackdropSkyline()

function makeMistTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64,64,3,64,64,62)
  gradient.addColorStop(0,'rgba(210,220,238,.22)')
  gradient.addColorStop(.46,'rgba(146,162,190,.12)')
  gradient.addColorStop(1,'rgba(110,125,155,0)')
  context.fillStyle = gradient
  context.fillRect(0,0,128,128)
  return new THREE.CanvasTexture(canvas)
}

const mistTexture = makeMistTexture()
const cityMist = Array.from({ length: 18 }, (_, index) => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, transparent: true, opacity: .14, depthWrite: false, fog: true }))
  sprite.position.set(-62 + random() * 124, 1.2 + random() * 2.4, -62 + random() * 124)
  sprite.scale.set(14 + random() * 18, 3.8 + random() * 4.5, 1)
  sprite.userData = { speed: .18 + random() * .26, phase: index * .7 }
  world.add(sprite)
  return sprite
})

const windowGeometry = new THREE.BoxGeometry(0.7, 0.82, 0.08)
const windowMaterial = material(0xded4dd, 0.42, 0.08, 0xa35b6a, 0.55)
const windowMatrix = new THREE.Matrix4()

function addTower({ x, z, width, depth, height, color = 0x242128, accent = COLORS.red, rotation = 0, antenna = false }) {
  const group = new THREE.Group()
  group.position.set(x, 0.5, z)
  group.rotation.y = rotation
  group.add(mesh(new THREE.BoxGeometry(width, height, depth), color, { y: height / 2, roughness: 0.82, metalness: 0.14 }))
  group.add(mesh(new THREE.BoxGeometry(width * 0.85, 0.55, depth * 0.85), accent, { y: height + 0.28, emissive: accent, emissiveIntensity: 0.45 }))
  const floors = Math.max(4, Math.floor(height / 3))
  const columns = Math.max(2, Math.floor(width / 1.6))
  const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, floors * columns)
  let index = 0
  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      windowMatrix.makeTranslation((column - (columns - 1) / 2) * 1.18, 2 + floor * 2.55, depth / 2 + 0.045)
      windows.setMatrixAt(index, windowMatrix)
      index += 1
    }
  }
  group.add(windows)
  if (antenna) {
    group.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 7, 8), 0xbcb8c0, { y: height + 3.6, metalness: 0.7 }))
    group.add(mesh(new THREE.SphereGeometry(0.35, 10, 8), COLORS.red, { y: height + 7.2, emissive: COLORS.red, emissiveIntensity: 2.6 }))
  }
  world.add(group)
  placeholderArchitecture.push(group)
  collisionCircles.push({ x, z, r: Math.max(width, depth) * 0.56 })
  return group
}

[
  [-58,-50,8,11,35,0x211f25,COLORS.red,.02,true],[-39,-58,12,8,29,0x28252b,COLORS.cyan,0,false],
  [39,-58,12,8,42,0x1d1b21,COLORS.red,0,true],[58,-48,8,12,33,0x29262d,COLORS.violet,0,false],
  [58,-5,8,13,38,0x201e23,COLORS.red,0,true],[58,47,8,12,31,0x2c282d,COLORS.cyan,0,false],
  [39,59,12,8,36,0x201e23,COLORS.red,0,false],[8,61,10,8,44,0x19181d,COLORS.red,0,true],
  [-7,61,10,8,32,0x29262d,COLORS.violet,0,false],[-53,59,9,8,39,0x201e23,COLORS.red,0,true],
  [-59,35,8,12,30,0x26232a,COLORS.claude,0,false],[-59,-5,8,12,34,0x211f25,COLORS.cyan,0,false],
].forEach(([x,z,width,depth,height,color,accent,rotation,antenna]) => addTower({x,z,width,depth,height,color,accent,rotation,antenna}))

function addCentralBuildingFallback() {
  const group = new THREE.Group()
  group.position.set(CITY.hq.x, 0.5, CITY.hq.z)
  group.add(mesh(new THREE.CylinderGeometry(4.8, 7.4, 25, 8), 0x18161b, { y: 12.5, ry: Math.PI / 8, metalness: 0.22 }))
  group.add(mesh(new THREE.TorusGeometry(6.2, 0.28, 10, 48), COLORS.red, { y: 17, rx: Math.PI / 2, emissive: COLORS.red, emissiveIntensity: 1.8 }))
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.36, 13, 10), 0xa9a5ad, { y: 31, metalness: 0.72 }))
  group.add(mesh(new THREE.OctahedronGeometry(1.05), COLORS.red, { y: 38, emissive: COLORS.red, emissiveIntensity: 2.2 }))
  world.add(group)
  const collision = { x: CITY.hq.x, z: CITY.hq.z, r: 7.2 }
  collisionCircles.push(collision)

  const sign = new THREE.Group()
  sign.position.set(CITY.hq.x, 13.8, CITY.hq.z + 6.55)
  sign.add(mesh(new THREE.BoxGeometry(12.8, 3.7, 0.38), 0x08070a, { metalness: 0.46, roughness: 0.44 }))
  sign.add(mesh(new THREE.BoxGeometry(13.15, 0.12, 0.46), COLORS.red, { y: 1.84, emissive: COLORS.red, emissiveIntensity: 1.7 }))
  sign.add(mesh(new THREE.BoxGeometry(13.15, 0.12, 0.46), COLORS.red, { y: -1.84, emissive: COLORS.red, emissiveIntensity: 1.7 }))
  sign.add(mesh(new THREE.BoxGeometry(0.12, 3.7, 0.46), COLORS.red, { x: -6.48, emissive: COLORS.red, emissiveIntensity: 1.35 }))
  sign.add(mesh(new THREE.BoxGeometry(0.12, 3.7, 0.46), COLORS.red, { x: 6.48, emissive: COLORS.red, emissiveIntensity: 1.35 }))
  world.add(sign)

  new THREE.TextureLoader().load('/assets/upgrad-logo.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 2.69),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
    )
    logo.position.z = 0.205
    sign.add(logo)
  })

  return { group, sign, collision }
}

const centralBuildingFallback = addCentralBuildingFallback()

function loadCentralBuilding() {
  const loader = new GLTFLoader()
  loader.load(
    '/assets/buildings/upgrad_building.glb?v=1',
    (gltf) => {
      const model = gltf.scene
      model.updateMatrixWorld(true)

      const sourceBounds = new THREE.Box3().setFromObject(model)
      const sourceSize = sourceBounds.getSize(new THREE.Vector3())
      const scale = 30 / Math.max(sourceSize.y, 0.001)
      model.scale.setScalar(scale)
      model.updateMatrixWorld(true)

      const scaledBounds = new THREE.Box3().setFromObject(model)
      const scaledSize = scaledBounds.getSize(new THREE.Vector3())
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())
      model.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z)

      model.traverse((child) => {
        if (!child.isMesh) return
        child.frustumCulled = false
        child.castShadow = true
        child.receiveShadow = true
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((entry) => {
          if (!entry) return
          if (entry.map) {
            entry.map.colorSpace = THREE.SRGBColorSpace
            entry.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
          }
          if (entry.normalMap) entry.normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
          if (entry.roughnessMap) entry.roughnessMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
          entry.needsUpdate = true
        })
      })

      const building = new THREE.Group()
      building.name = 'upGrad Headquarters'
      building.position.set(CITY.hq.x, 0.5, CITY.hq.z)
      building.rotation.y = -Math.PI / 2
      building.add(model)
      world.add(building)

      centralBuildingFallback.collision.r = Math.max(scaledSize.x, scaledSize.z) * 0.5 + 0.85
      world.remove(centralBuildingFallback.group, centralBuildingFallback.sign)

      window.__UPGRADVERSE_BUILDING__ = {
        ready: true,
        height: scaledSize.y,
        footprint: { x: scaledSize.x, z: scaledSize.z },
        collisionRadius: centralBuildingFallback.collision.r,
      }
    },
    undefined,
    (error) => {
      console.error('upGrad headquarters failed to load', error)
      window.__UPGRADVERSE_BUILDING__ = { ready: false, error: String(error?.message || error) }
    },
  )
}

loadCentralBuilding()

interactables.push({
  id: 'upgrad',
  title: 'Enter upGrad Skill Shop',
  position: new THREE.Vector3(CITY.hq.x, 0, CITY.hq.z + 11.2),
  radius: 4.6,
  group: centralBuildingFallback.group,
})

function addSkillShop({ id, title, x, z, color, shape = 'round' }) {
  const group = new THREE.Group()
  group.position.set(x, 0.5, z)
  if (shape === 'round') {
    group.add(mesh(new THREE.CylinderGeometry(7.2, 8, 8.2, 24), 0x17151a, { y: 4.1, roughness: 0.72, metalness: 0.24 }))
    group.add(mesh(new THREE.TorusGeometry(6.1, 0.38, 10, 42), color, { y: 8.25, rx: Math.PI / 2, emissive: color, emissiveIntensity: 1.4 }))
    group.add(mesh(new THREE.SphereGeometry(5.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x2b252b, { y: 8.1, roughness: 0.58, metalness: 0.28 }))
  } else {
    group.add(mesh(new THREE.BoxGeometry(13.5, 9.5, 12), 0x1a181d, { y: 4.75, roughness: 0.78, metalness: 0.18 }))
    group.add(mesh(new THREE.BoxGeometry(12.2, 0.42, 10.7), color, { y: 9.72, emissive: color, emissiveIntensity: 1.4 }))
    for (let offset = -4.5; offset <= 4.5; offset += 3) {
      group.add(mesh(new THREE.BoxGeometry(1.25, 5.8, 0.16), color, { x: offset, y: 5.5, z: 6.08, emissive: color, emissiveIntensity: 0.7 }))
    }
  }
  group.add(mesh(new THREE.BoxGeometry(2.5, 3.6, 0.32), 0x070709, { y: 1.8, z: shape === 'round' ? 7.4 : 6.1, metalness: 0.5 }))
  group.add(mesh(new THREE.BoxGeometry(3.2, 0.14, 0.4), color, { y: 3.8, z: shape === 'round' ? 7.42 : 6.12, emissive: color, emissiveIntensity: 1.8 }))
  world.add(group)
  const entranceZ = z + (shape === 'round' ? 8.4 : 7.2)
  interactables.push({ id, title: `Enter ${title}`, position: new THREE.Vector3(x, 0, entranceZ), radius: 4.2, group })
  collisionCircles.push({ x, z, r: shape === 'round' ? 7.6 : 7.1 })
  return group
}

function addChatGPTSkillShop() {
  const group = new THREE.Group()
  group.name = 'ChatGPT Skill Shop'
  group.position.set(CITY.chatgpt.x, 0.5, CITY.chatgpt.z)

  const darkGlass = new THREE.MeshPhysicalMaterial({
    color: 0x111c1a,
    roughness: 0.22,
    metalness: 0.48,
    transparent: true,
    opacity: 0.7,
    transmission: 0.08,
    side: THREE.DoubleSide,
  })
  const portalGlass = new THREE.MeshBasicMaterial({
    color: COLORS.openai,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const plinth = mesh(new THREE.CylinderGeometry(8.2, 8.8, 1.15, 12), 0x101513, { y: 0.58, roughness: 0.72, metalness: 0.42 })
  const floorRing = mesh(new THREE.TorusGeometry(7.55, 0.16, 8, 64), COLORS.openai, { y: 1.2, rx: Math.PI / 2, emissive: COLORS.openai, emissiveIntensity: 2.1 })
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(5.45, 7.55, 13.8, 10, 1, true), darkGlass)
  shell.position.y = 8.05
  const crown = mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.55, 10), 0x0d1312, { y: 15.02, roughness: 0.44, metalness: 0.76 })
  const crownHalo = mesh(new THREE.TorusGeometry(4.35, 0.16, 8, 56), COLORS.cream, { y: 15.36, rx: Math.PI / 2, emissive: COLORS.cream, emissiveIntensity: 1.8 })

  const core = mesh(new THREE.IcosahedronGeometry(2.1, 2), COLORS.openai, { y: 8.7, roughness: 0.24, metalness: 0.28, emissive: COLORS.openai, emissiveIntensity: 2.3 })
  const coreWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.46, 1),
    new THREE.MeshBasicMaterial({ color: COLORS.cream, wireframe: true, transparent: true, opacity: 0.32, depthWrite: false }),
  )
  coreWire.position.y = 8.7

  const rings = [
    { radius: 3.75, color: COLORS.openai, ry: 0.16, rz: 0.12 },
    { radius: 4.45, color: COLORS.cream, ry: 1.1, rz: -0.18 },
    { radius: 5.15, color: COLORS.violet, ry: 2.15, rz: 0.22 },
  ].map(({ radius, color, ry, rz }) => {
    const ring = mesh(new THREE.TorusGeometry(radius, 0.075, 6, 64), color, { y: 8.7, ry, rz, emissive: color, emissiveIntensity: 2 })
    group.add(ring)
    return ring
  })

  const nodes = [
    [-4.4, 5.5, 1.7, COLORS.openai],
    [4.2, 10.5, -0.8, COLORS.cream],
    [-3.5, 12.8, -2.3, COLORS.violet],
  ].map(([x, y, z, color]) => {
    const node = mesh(new THREE.SphereGeometry(0.38, 14, 10), color, { x, y, z, emissive: color, emissiveIntensity: 2.4 })
    node.userData.baseY = y
    group.add(node)
    return node
  })

  const portal = new THREE.Group()
  portal.position.set(0, 3.15, 7.25)
  const portalRing = mesh(new THREE.TorusGeometry(2.05, 0.24, 10, 48), COLORS.openai, { emissive: COLORS.openai, emissiveIntensity: 2.8 })
  const portalFace = new THREE.Mesh(new THREE.CircleGeometry(1.82, 48), portalGlass)
  portalFace.position.z = 0.03
  const portalCore = mesh(new THREE.TorusGeometry(0.72, 0.11, 8, 32), COLORS.cream, { z: 0.08, emissive: COLORS.cream, emissiveIntensity: 2.4 })
  portal.add(portalFace, portalRing, portalCore)

  for (let step = 0; step < 4; step += 1) {
    group.add(mesh(new THREE.BoxGeometry(4.8 - step * 0.45, 0.22, 1.15), step === 3 ? COLORS.openai : 0x252b29, {
      y: 0.36 + step * 0.18,
      z: 8.25 + step * 0.72,
      roughness: 0.58,
      metalness: 0.34,
      emissive: step === 3 ? COLORS.openai : 0,
      emissiveIntensity: step === 3 ? 1.2 : 0,
    }))
  }

  group.add(plinth, floorRing, shell, crown, crownHalo, core, coreWire, portal)
  group.userData = { core, coreWire, rings, nodes, portalRing, portalCore }
  world.add(group)
  interactables.push({ id: 'chatgpt', title: 'Enter ChatGPT Skill Shop', position: new THREE.Vector3(CITY.chatgpt.x, 0, CITY.chatgpt.z + 9.9), radius: 4.2, group })
  collisionCircles.push({ x: CITY.chatgpt.x, z: CITY.chatgpt.z, r: 7.8 })
  return group
}

function addClaudeSkillShop() {
  const group = new THREE.Group()
  group.name = 'Claude Skill Shop'
  group.position.set(CITY.claude.x, 0.5, CITY.claude.z)

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x3b241e,
    roughness: 0.3,
    metalness: 0.34,
    transparent: true,
    opacity: 0.84,
    transmission: 0.04,
    side: THREE.DoubleSide,
  })
  const paperMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.parchment,
    roughness: 0.7,
    metalness: 0.04,
    emissive: 0x5e2b1e,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  })

  const plinth = mesh(new THREE.CylinderGeometry(7.4, 8.1, 1.05, 8), 0x211714, { y: 0.54, ry: Math.PI / 8, roughness: 0.72, metalness: 0.32 })
  const floorHalo = mesh(new THREE.TorusGeometry(6.9, 0.14, 8, 56), COLORS.claude, { y: 1.12, rx: Math.PI / 2, emissive: COLORS.claude, emissiveIntensity: 1.9 })
  const lowerShell = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 6.7, 9.6, 8, 1, false), glass)
  lowerShell.position.y = 5.85
  lowerShell.rotation.y = Math.PI / 8
  const upperShell = mesh(new THREE.CylinderGeometry(3.9, 5.65, 6.4, 8), 0x2b1d19, { y: 13.6, ry: Math.PI / 8, roughness: 0.54, metalness: 0.36 })

  const ribs = []
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4
    const rib = mesh(new THREE.BoxGeometry(0.2, 10.8, 0.45), index % 2 ? COLORS.parchment : COLORS.claude, {
      x: Math.sin(angle) * 5.65,
      y: 6.5,
      z: Math.cos(angle) * 5.65,
      ry: angle,
      emissive: index % 2 ? 0x5a3626 : COLORS.claude,
      emissiveIntensity: index % 2 ? 0.3 : 1.1,
      roughness: 0.5,
    })
    ribs.push(rib)
    group.add(rib)
  }

  const core = mesh(new THREE.OctahedronGeometry(1.55, 1), COLORS.claude, { y: 13.8, roughness: 0.34, metalness: 0.18, emissive: COLORS.claude, emissiveIntensity: 2.15 })
  const coreFrame = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.05, 0),
    new THREE.MeshBasicMaterial({ color: COLORS.parchment, wireframe: true, transparent: true, opacity: 0.48, depthWrite: false }),
  )
  coreFrame.position.y = 13.8

  const rings = [3.1, 3.9].map((radius, index) => {
    const ring = mesh(new THREE.TorusGeometry(radius, 0.08, 6, 56), index ? COLORS.parchment : COLORS.claude, {
      y: 13.8,
      ry: index ? 1.1 : 0.2,
      rz: index ? -0.26 : 0.22,
      emissive: index ? COLORS.parchment : COLORS.claude,
      emissiveIntensity: 1.6,
    })
    group.add(ring)
    return ring
  })

  const pages = []
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3
    const page = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.15, 0.09), paperMaterial.clone())
    page.position.set(Math.sin(angle) * 4.65, 17.3 + Math.sin(index * 1.7) * 0.55, Math.cos(angle) * 4.65)
    page.userData.baseY = page.position.y
    page.rotation.set(index % 2 ? 0.18 : -0.12, angle, index % 2 ? -0.24 : 0.2)
    group.add(page)
    pages.push(page)
  }

  const portal = new THREE.Group()
  portal.position.set(0, 3.05, -6.35)
  const portalBack = mesh(new THREE.BoxGeometry(4.55, 5.35, 0.28), 0x160d0b, { metalness: 0.42, roughness: 0.45 })
  const portalLight = mesh(new THREE.BoxGeometry(3.45, 4.25, 0.08), COLORS.claude, { z: -0.18, emissive: COLORS.claude, emissiveIntensity: 1.8 })
  const portalDoor = mesh(new THREE.BoxGeometry(3.05, 3.9, 0.1), 0x251511, { z: -0.25, roughness: 0.6 })
  const portalGlyph = mesh(new THREE.TorusGeometry(0.72, 0.11, 8, 24), COLORS.parchment, { y: 0.25, z: -0.33, emissive: COLORS.parchment, emissiveIntensity: 1.7 })
  portal.add(portalBack, portalLight, portalDoor, portalGlyph)

  const signCanvas = document.createElement('canvas')
  signCanvas.width = 1024
  signCanvas.height = 256
  const signContext = signCanvas.getContext('2d')
  signContext.fillStyle = '#20120f'
  signContext.fillRect(0, 0, 1024, 256)
  signContext.strokeStyle = '#d97757'
  signContext.lineWidth = 12
  signContext.strokeRect(8, 8, 1008, 240)
  signContext.fillStyle = '#f0dfca'
  signContext.textAlign = 'center'
  signContext.font = '800 104px Arial'
  signContext.fillText('CLAUDE', 512, 132)
  signContext.fillStyle = '#d97757'
  signContext.font = '700 31px Arial'
  signContext.letterSpacing = '9px'
  signContext.fillText('ARTIFACT LAB', 512, 195)
  const signTexture = new THREE.CanvasTexture(signCanvas)
  signTexture.colorSpace = THREE.SRGBColorSpace
  signTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.75, 1.18),
    new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }),
  )
  sign.position.set(0, 6.42, -6.52)
  sign.rotation.y = Math.PI

  for (let step = 0; step < 4; step += 1) {
    group.add(mesh(new THREE.BoxGeometry(4.75 - step * 0.42, 0.21, 1.1), step === 3 ? COLORS.claude : 0x3a2b26, {
      y: 0.34 + step * 0.17,
      z: -7.1 - step * 0.7,
      roughness: 0.66,
      emissive: step === 3 ? COLORS.claude : 0,
      emissiveIntensity: step === 3 ? 1.05 : 0,
    }))
  }

  group.add(plinth, floorHalo, lowerShell, upperShell, core, coreFrame, portal, sign)
  group.userData = { core, coreFrame, rings, pages, portalGlyph }
  world.add(group)
  interactables.push({ id: 'claude', title: 'Enter Claude Skill Shop', position: new THREE.Vector3(CITY.claude.x, 0, CITY.claude.z - 8.4), radius: 4.2, group })
  collisionCircles.push({ x: CITY.claude.x, z: CITY.claude.z, r: 7.5 })
  return group
}

const chatgptBuilding = addChatGPTSkillShop()
const claudeBuilding = addClaudeSkillShop()
const humanBuilding = addSkillShop({ id: 'human', title: 'Human Instincts', x: CITY.human.x, z: CITY.human.z, color: COLORS.cyan, shape: 'box' })

function addWorldWaypoint(position, color) {
  const marker = new THREE.Group()
  const bright = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.38, 5.2, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthWrite: false }))
  beam.position.y = 2.8
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.66), bright)
  diamond.position.y = 5.5
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 8, 32), bright)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.18
  marker.add(beam, diamond, ring)
  marker.position.copy(position)
  marker.userData = { diamond, ring }
  world.add(marker)
  return marker
}
const waypoint = addWorldWaypoint(interactables[0].position, COLORS.openai)

function makeDriftSmokeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(48, 48, 4, 48, 48, 46)
  gradient.addColorStop(0, 'rgba(245,242,244,.82)')
  gradient.addColorStop(.32, 'rgba(220,216,221,.58)')
  gradient.addColorStop(.72, 'rgba(174,171,180,.18)')
  gradient.addColorStop(1, 'rgba(145,143,151,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 96, 96)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const driftSmokeTexture = makeDriftSmokeTexture()
let driftSmokeCursor = 0
for (let index = 0; index < 56; index += 1) {
  const particle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: driftSmokeTexture,
    color: 0xe0dce1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
  }))
  particle.visible = false
  particle.userData.velocity = new THREE.Vector3()
  particle.userData.age = 0
  particle.userData.life = 1
  particle.userData.size = 1
  world.add(particle)
  driftSmoke.push(particle)
}

const smokeLocalPosition = new THREE.Vector3()
const smokeVelocity = new THREE.Vector3()

function emitDriftSmoke(vehicle, intensity) {
  const forwardDirection = vehicleForward(vehicle)
  const sideDirection = vehicleRight(vehicle)
  for (const side of [-1, 1]) {
    const particle = driftSmoke[driftSmokeCursor]
    driftSmokeCursor = (driftSmokeCursor + 1) % driftSmoke.length
    smokeLocalPosition.set(side * vehicle.config.width * .48, vehicle.config.wheelRadius * .42, vehicle.config.length * .32)
    vehicle.root.localToWorld(smokeLocalPosition)
    particle.position.copy(smokeLocalPosition)
    particle.position.x += (random() - .5) * .16
    particle.position.z += (random() - .5) * .16
    particle.userData.age = 0
    particle.userData.life = .58 + intensity * .52 + random() * .18
    particle.userData.size = .48 + intensity * .62 + random() * .2
    smokeVelocity.copy(forwardDirection).multiplyScalar(-.7 - intensity * 1.4)
    smokeVelocity.addScaledVector(sideDirection, -vehicle.steeringInput * (.28 + random() * .36))
    smokeVelocity.y = .36 + intensity * .58 + random() * .2
    particle.userData.velocity.copy(smokeVelocity)
    particle.material.opacity = .46 + intensity * .22
    particle.material.rotation = random() * Math.PI * 2
    particle.scale.setScalar(particle.userData.size)
    particle.visible = true
  }
}

function updateDriftSmoke(dt) {
  driftSmoke.forEach((particle) => {
    if (!particle.visible) return
    particle.userData.age += dt
    const progress = particle.userData.age / particle.userData.life
    if (progress >= 1) {
      particle.visible = false
      particle.material.opacity = 0
      return
    }
    particle.position.addScaledVector(particle.userData.velocity, dt)
    particle.userData.velocity.multiplyScalar(Math.exp(-dt * 1.9))
    particle.userData.velocity.y += dt * .12
    const expansion = particle.userData.size * (1 + progress * 2.25)
    particle.scale.setScalar(expansion)
    particle.material.opacity = (1 - progress) * (1 - progress) * .62
    particle.material.rotation += dt * .38
  })
}

function makeVehicleWheel(radius, width = 0.3) {
  const steeringPivot = new THREE.Group()
  const spinPivot = new THREE.Group()
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), material(0x09090b, 0.78, 0.12))
  tyre.rotation.z = Math.PI / 2
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.47, radius * 0.47, width + 0.02, 10), material(0x8a8d94, 0.28, 0.78))
  hub.rotation.z = Math.PI / 2
  spinPivot.add(tyre, hub)
  steeringPivot.add(spinPivot)
  steeringPivot.userData.spin = spinPivot
  return steeringPivot
}

function makeVehicleProxy(config, color) {
  const proxy = new THREE.Group()
  proxy.name = `${config.kind} proxy body`
  const bodyY = config.wheelRadius + config.height * 0.34
  const bodyHeight = config.kind === 'SUPERCAR' ? config.height * 0.42 : config.height * 0.5
  const lowerBody = mesh(
    new THREE.BoxGeometry(config.width, bodyHeight, config.length * 0.88),
    color,
    { y: bodyY, roughness: config.kind === 'SUV' ? 0.68 : 0.42, metalness: 0.48 },
  )
  proxy.add(lowerBody)

  if (config.kind === 'MOTORBIKE') {
    proxy.add(mesh(new THREE.CapsuleGeometry(config.width * .42, config.length * .34, 5, 10), color, { y: bodyY + .28, z: -.18, rx: Math.PI / 2, metalness: .58, roughness: .34 }))
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .68, .18, config.length * .42), 0x11131a, { y: bodyY + .54, z: .38, metalness: .38, roughness: .5 }))
    proxy.add(mesh(new THREE.CylinderGeometry(.045, .055, .85, 8), 0x9298a3, { x: -.26, y: bodyY + .22, z: -.68, rx: -.15, metalness: .8 }))
    proxy.add(mesh(new THREE.CylinderGeometry(.045, .055, .85, 8), 0x9298a3, { x: .26, y: bodyY + .22, z: -.68, rx: -.15, metalness: .8 }))
  } else if (config.kind === 'SUPERCAR') {
    proxy.add(mesh(new THREE.BoxGeometry(config.width * 0.88, config.height * 0.24, config.length * 0.34), color, { y: bodyY + .33, z: -.72, rx: -.08, metalness: .58, roughness: .34 }))
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .72, config.height * .34, config.length * .34), 0x141921, { y: bodyY + .54, z: .25, rx: .08, metalness: .66, roughness: .24 }))
  } else if (config.kind === 'SUV') {
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .9, config.height * .48, config.length * .5), color, { y: bodyY + .69, z: .12, metalness: .42, roughness: .72 }))
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .78, config.height * .31, config.length * .38), 0x151a20, { y: bodyY + .83, z: -.02, metalness: .62, roughness: .28 }))
  } else if (config.kind === 'SEDAN') {
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .84, config.height * .38, config.length * .46), color, { y: bodyY + .5, z: .05, metalness: .46, roughness: .4 }))
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .72, config.height * .29, config.length * .34), 0x151a21, { y: bodyY + .63, z: -.04, metalness: .66, roughness: .25 }))
  } else {
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .88, config.height * .5, config.length * .48), color, { y: bodyY + .55, z: .08, metalness: .38, roughness: .5 }))
    proxy.add(mesh(new THREE.BoxGeometry(config.width * .72, config.height * .32, config.length * .34), 0x16202a, { y: bodyY + .71, z: -.03, metalness: .58, roughness: .24 }))
  }

  const windshield = mesh(new THREE.BoxGeometry(config.width * .66, .06, config.length * .18), 0x91bad0, { y: bodyY + config.height * .5, z: config.kind === 'MOTORBIKE' ? -.64 : -.34, rx: -.56, metalness: .6, roughness: .15, emissive: 0x253d4a, emissiveIntensity: .35 })
  proxy.add(windshield)
  proxy.add(mesh(new THREE.BoxGeometry(config.width * .96, .11, .12), 0xf2e5d9, { y: bodyY + .03, z: -config.length * .445, emissive: 0xffdfbd, emissiveIntensity: 1.2 }))
  return proxy
}

function makeDriverSilhouette(config) {
  const driver = new THREE.Group()
  driver.add(mesh(new THREE.CapsuleGeometry(.16, .3, 3, 6), 0x24252b, { y: .22, roughness: .7 }))
  driver.add(mesh(new THREE.SphereGeometry(.18, 8, 6), 0xb9a49d, { y: .62, roughness: .8 }))
  driver.position.set(-config.width * .2, config.wheelRadius + config.height * .45, .12)
  return driver
}

function createVehicle({ id, classId, color, x = 0, z = 0, yaw = 0, traffic = false, angle = 0, radius = 38, direction = 1, routeDistance = 0 }) {
  const config = VEHICLE_CLASSES[classId]
  const root = new THREE.Group()
  root.name = `${config.label} vehicle root`
  root.position.set(x, .52, z)
  root.rotation.y = yaw

  const visualRoot = new THREE.Group()
  const proxyBody = makeVehicleProxy(config, color)
  visualRoot.add(proxyBody)
  root.add(visualRoot)

  const wheels = []
  const axleX = config.width * .51
  const axleZ = config.kind === 'MOTORBIKE' ? config.length * .38 : config.length * .31
  for (const front of [true, false]) {
    const sides = config.kind === 'MOTORBIKE' ? [0] : [-1, 1]
    for (const side of sides) {
      const wheel = makeVehicleWheel(config.wheelRadius, config.kind === 'SUV' ? .36 : config.kind === 'MOTORBIKE' ? .12 : .29)
      wheel.position.set(side * axleX, config.wheelRadius, front ? -axleZ : axleZ)
      root.add(wheel)
      wheels.push({ steeringPivot: wheel, spinPivot: wheel.userData.spin, front })
    }
  }

  const brakeMaterial = material(0x6b0a16, .34, .24, COLORS.red, .35)
  const brakeLights = []
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(config.width * .24, .17, .08), brakeMaterial.clone())
    light.position.set(side * config.width * .3, config.wheelRadius + .32, config.length * .445)
    root.add(light)
    brakeLights.push(light)
  }
  const exhaust = mesh(new THREE.BoxGeometry(config.width * .23, .07, .06), 0x85d8f1, { y: config.wheelRadius + .12, z: config.length * .452, emissive: 0x4ca6d4, emissiveIntensity: .18 })
  root.add(exhaust)

  const driverSilhouette = traffic ? makeDriverSilhouette(config) : null
  if (driverSilhouette) root.add(driverSilhouette)
  const vehicle = {
    id, classId, config, root, visualRoot, proxyBody, wheels, brakeLights, exhaust, driverSilhouette,
    state: traffic ? 'traffic' : 'available', traffic, angle, radius, direction, routeDistance,
    speed: traffic ? (5.1 + (vehicles.length % 3) * .7) * direction : 0,
    targetTrafficSpeed: 5.6 + (vehicles.length % 3) * .65,
    velocity: new THREE.Vector3(), steeringInput: 0, throttleInput: 0, brakeInput: 0, handbrakeInput: 0,
    wheelSpin: 0, yieldTimer: 0, enterTimer: 0, hapticTimer: 0, collisionTimer: 0, smokeTimer: 0,
  }
  root.userData.vehicle = vehicle
  world.add(root)
  vehicles.push(vehicle)
  if (traffic) movingCars.push(root)
  return vehicle
}

const TRAFFIC_LOOP = [
  new THREE.Vector3(-42, .52, -18),
  new THREE.Vector3(42, .52, -18),
  new THREE.Vector3(42, .52, 23),
  new THREE.Vector3(-42, .52, 23),
]
const TRAFFIC_SEGMENTS = TRAFFIC_LOOP.map((point, index) => {
  const next = TRAFFIC_LOOP[(index + 1) % TRAFFIC_LOOP.length]
  return { start: point, end: next, length: point.distanceTo(next) }
})
const TRAFFIC_LOOP_LENGTH = TRAFFIC_SEGMENTS.reduce((total, segment) => total + segment.length, 0)
const trafficSamplePosition = new THREE.Vector3()
const trafficSampleDirection = new THREE.Vector3()

function sampleTrafficLoop(distance, position = trafficSamplePosition, direction = trafficSampleDirection) {
  let remaining = ((distance % TRAFFIC_LOOP_LENGTH) + TRAFFIC_LOOP_LENGTH) % TRAFFIC_LOOP_LENGTH
  for (const segment of TRAFFIC_SEGMENTS) {
    if (remaining <= segment.length) {
      const progress = remaining / Math.max(segment.length, .001)
      position.lerpVectors(segment.start, segment.end, progress)
      direction.subVectors(segment.end, segment.start).normalize()
      return { position, direction }
    }
    remaining -= segment.length
  }
  position.copy(TRAFFIC_LOOP[0])
  direction.subVectors(TRAFFIC_LOOP[1], TRAFFIC_LOOP[0]).normalize()
  return { position, direction }
}

const parkedVehicles = [
  createVehicle({ id: 'apex-r8-parked', classId: 'supercar', color: 0xc5c8ce, x: -8.2, z: 31, yaw: 0 }),
  createVehicle({ id: 'terra-defender-parked', classId: 'suv', color: 0x6f7476, x: -36.5, z: -5, yaw: 0 }),
  createVehicle({ id: 'executive-s7-parked', classId: 'sedan', color: 0x232b38, x: 29, z: 15.8, yaw: -Math.PI / 2 }),
  createVehicle({ id: 'pulse-ev-parked', classId: 'ev', color: 0xd8d5cf, x: 8.3, z: 41, yaw: Math.PI }),
  createVehicle({ id: 'neon-sv-parked', classId: 'bike', color: 0x23262d, x: 35.8, z: 16.6, yaw: -Math.PI / 2 }),
  createVehicle({ id: 'crimson-sv-parked', classId: 'bike', color: COLORS.red, x: -9.4, z: 32.2, yaw: 0 }),
]

const trafficVehicles = [
  createVehicle({ id: 'apex-r8-traffic', classId: 'supercar', color: COLORS.red, traffic: true, routeDistance: 8, direction: 1 }),
  createVehicle({ id: 'terra-defender-traffic', classId: 'suv', color: 0x7c8285, traffic: true, routeDistance: 72, direction: -1 }),
  createVehicle({ id: 'executive-s7-traffic', classId: 'sedan', color: COLORS.violet, traffic: true, routeDistance: 138, direction: 1 }),
  createVehicle({ id: 'pulse-ev-traffic', classId: 'ev', color: COLORS.cyan, traffic: true, routeDistance: 210, direction: -1 }),
  createVehicle({ id: 'night-s7-traffic', classId: 'sedan', color: 0x15171c, traffic: true, routeDistance: 42, direction: -1 }),
  createVehicle({ id: 'copper-ev-traffic', classId: 'ev', color: 0xb46b4d, traffic: true, routeDistance: 104, direction: 1 }),
  createVehicle({ id: 'silver-r8-traffic', classId: 'supercar', color: 0xb8bec7, traffic: true, routeDistance: 176, direction: -1 }),
  createVehicle({ id: 'forest-defender-traffic', classId: 'suv', color: 0x43584f, traffic: true, routeDistance: 246, direction: 1 }),
  createVehicle({ id: 'neon-sv-traffic', classId: 'bike', color: 0x191b22, traffic: true, routeDistance: 25, direction: 1 }),
  createVehicle({ id: 'crimson-sv-traffic', classId: 'bike', color: COLORS.red, traffic: true, routeDistance: 192, direction: -1 }),
]

trafficVehicles.forEach((vehicle) => {
  const sample = sampleTrafficLoop(vehicle.routeDistance)
  vehicle.root.position.copy(sample.position)
  const direction = sample.direction.clone().multiplyScalar(vehicle.direction)
  vehicle.root.rotation.y = Math.atan2(-direction.x, -direction.z)
})

window.__UPGRADVERSE_VEHICLES__ = {
  classes: VEHICLE_CLASSES,
  list: vehicles.map((vehicle) => ({ id: vehicle.id, classId: vehicle.classId, label: vehicle.config.label })),
  replaceProxy(id, model) {
    const vehicle = vehicles.find((entry) => entry.id === id)
    if (!vehicle || !model?.isObject3D) return false
    vehicle.proxyBody.visible = false
    model.name = `${vehicle.config.label} GLB body`
    vehicle.visualRoot.add(model)
    return true
  },
  restoreProxy(id) {
    const vehicle = vehicles.find((entry) => entry.id === id)
    if (!vehicle) return false
    vehicle.visualRoot.children.filter((child) => child !== vehicle.proxyBody).forEach((child) => vehicle.visualRoot.remove(child))
    vehicle.proxyBody.visible = true
    return true
  },
}

const cityUpgrade = createCityUpgrade({
  world,
  renderer,
  collisionCircles,
  interactables,
  vehicles,
  placeholderArchitecture,
})

const transportUpgrade = createTransportUpgrade({
  world,
  renderer,
  vehicles,
  getDrivingVehicle: () => state.drivingVehicle,
})

const atmosphereUpgrade = createAtmosphereUpgrade({
  THREE,
  scene,
  world,
  cityHalfExtent: CITY.halfExtent,
})

function makeSyntheticHuman(color = COLORS.red, scale = 1) {
  const root = new THREE.Group()
  const hips = new THREE.Group()
  root.add(hips)
  const torso = mesh(new THREE.CapsuleGeometry(0.55, 1.05, 5, 10), color, { y: 2.35, roughness: 0.56, metalness: 0.22 })
  torso.scale.set(1.08, 1.05, 0.72)
  hips.add(torso)
  hips.add(mesh(new THREE.BoxGeometry(0.88, 0.42, 0.56), 0x252229, { y: 1.38, metalness: 0.4 }))
  const neck = mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.55, 10), 0x77727a, { y: 3.55, metalness: 0.72 })
  hips.add(neck)
  const head = new THREE.Group()
  head.position.y = 4.08
  head.add(mesh(new THREE.SphereGeometry(0.55, 18, 14), 0xb7a49f, { roughness: 0.78 }))
  head.add(mesh(new THREE.TorusGeometry(0.46, 0.12, 8, 24), color, { z: 0.2, rx: Math.PI / 2, emissive: color, emissiveIntensity: 1.2, metalness: 0.6 }))
  head.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 18), 0x131216, { z: 0.2, rx: Math.PI / 2, metalness: 0.75 }))
  hips.add(head)

  const limbMaterial = material(0x77727a, 0.38, 0.72)
  const suitMaterial = material(color, 0.58, 0.24)
  const arms = []
  const legs = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.76, 2.82, 0)
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.72, 4, 8), suitMaterial)
    upperArm.position.y = -0.45
    arm.add(upperArm)
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 4, 8), limbMaterial)
    forearm.position.y = -1.12
    arm.add(forearm)
    hips.add(arm)
    arms.push(arm)

    const leg = new THREE.Group()
    leg.position.set(side * 0.34, 1.28, 0)
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.82, 4, 8), suitMaterial)
    thigh.position.y = -0.5
    leg.add(thigh)
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 8), limbMaterial)
    shin.position.y = -1.28
    leg.add(shin)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.72), material(0x151419, 0.6, 0.3))
    foot.position.set(0, -1.82, -0.12)
    leg.add(foot)
    hips.add(leg)
    legs.push(leg)
  }
  root.userData.rig = { hips, head, arms, legs }
  root.scale.setScalar(scale)
  return root
}

const CHARACTER_ROSTER = [
  { id:'kish-prime', name:'KISH PRIME', role:'Cyber Creative / Adaptive Fighter', type:'cyborg', color:COLORS.red, accent:0xff9aa6, instinct:96, agility:88, tech:94, traits:['VISIONARY','FAST LEARNER','HUMAN EDGE'], bio:'A cybernetic creative strategist who turns instinct into action before the system catches up.', model:'/assets/characters/kish_3d_avatar.glb?v=1' },
  { id:'nova-veer', name:'NOVA VEER', role:'Neural Scout / Velocity Class', type:'male', color:0x16c8aa, accent:0x9affec, instinct:84, agility:97, tech:82, traits:['RAPID SCAN','PARKOUR','FORESIGHT'], bio:'Built for speed and signal discovery. Nova reads the city two moves before everyone else.' },
  { id:'mira-flux', name:'MIRA FLUX', role:'Signal Architect / Tactical Class', type:'female', color:0xeb4f92, accent:0xffb7d7, instinct:91, agility:82, tech:98, traits:['SYSTEM THINKER','FOCUS','OVERDRIVE'], bio:'A precision cyborg who reshapes noisy systems into clear, playable strategies.' },
  { id:'zara-vex', name:'ZARA VEX', role:'Combat Analyst / Reflex Class', type:'female', color:0x8d69ed, accent:0xd1c2ff, instinct:95, agility:94, tech:79, traits:['COUNTER','REFLEX','PATTERN BREAK'], bio:'Human intuition fused with a combat prediction core. Zara learns every opponent in real time.' },
  { id:'axiom-7', name:'AXIOM-7', role:'Synth Guardian / Logic Class', type:'robot', color:0x42bed4, accent:0xb7f6ff, instinct:70, agility:76, tech:100, traits:['SYNTH MIND','DURABLE','ZERO LATENCY'], bio:'A fully synthetic guardian with expressive movement and an uncompromising logic engine.', model:'/assets/characters/third-party/RobotExpressive.glb' },
  { id:'rook-zero', name:'ROOK ZERO', role:'Heavy Protocol / Power Class', type:'heavy', color:0xef6743, accent:0xffb39d, instinct:82, agility:68, tech:90, traits:['HEAVY FRAME','SHIELD','IMPACT'], bio:'A siege-grade learning machine designed to protect the team and break impossible deadlocks.' },
]

function makeRosterAvatar(character, scale = .51) {
  const avatar = makeSyntheticHuman(character.color, scale)
  const rig = avatar.userData.rig
  const isFemale = character.type === 'female'
  const isRobot = character.type === 'robot' || character.type === 'heavy'
  if (isFemale) {
    rig.hips.scale.x = .88
    rig.head.scale.set(.94, .98, .94)
    rig.arms.forEach((arm) => { arm.position.x *= .9; arm.scale.set(.9, 1.02, .9) })
    rig.legs.forEach((leg) => { leg.position.x *= .9; leg.scale.set(.9, 1.03, .9) })
  }
  if (character.type === 'male') {
    rig.hips.scale.set(1.04, 1.02, 1)
    rig.arms.forEach((arm) => { arm.position.x *= 1.05 })
  }
  if (character.type === 'heavy') {
    rig.hips.scale.set(1.17, 1.03, 1.08)
    rig.arms.forEach((arm) => arm.scale.set(1.22, 1.05, 1.22))
    rig.legs.forEach((leg) => leg.scale.set(1.15, 1.02, 1.15))
  }
  const glow = material(character.accent, .25, .78, character.accent, 2.4)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(isRobot ? 1.05 : .82, .12, .5), glow)
  chest.position.set(0, 2.72, .5)
  rig.hips.add(chest)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.25, .12), glow)
  spine.position.set(0, 2.18, -.5)
  rig.hips.add(spine)
  if (isRobot) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.78, .18, .22), glow)
    visor.position.set(0, .06, .48)
    rig.head.add(visor)
    for (const side of [-1, 1]) {
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .55), glow)
      guard.position.set(side * .72, 2.95, 0)
      guard.rotation.z = side * .18
      rig.hips.add(guard)
    }
  } else {
    const temple = new THREE.Mesh(new THREE.TorusGeometry(.59, .035, 6, 24, Math.PI * 1.12), glow)
    temple.rotation.set(Math.PI / 2, 0, -.18)
    rig.head.add(temple)
  }
  avatar.userData.characterId = character.id
  return avatar
}

const player = new THREE.Group()
const defaultCharacter = CHARACTER_ROSTER[0]
const fallbackAvatar = makeRosterAvatar(defaultCharacter)
player.add(fallbackAvatar)
player.userData.rig = fallbackAvatar.userData.rig
const saved = (() => { try { return JSON.parse(localStorage.getItem('upgradverse-checkpoint')) } catch { return null } })()
player.position.set(saved?.x ?? 0, 0.52, saved?.z ?? 27)
const nearestSpawnBuilding = interactables
  .map((location) => ({ location, distance: player.position.distanceTo(location.group.position) }))
  .sort((a,b) => a.distance-b.distance)[0]
const fallbackSpawnYaw = nearestSpawnBuilding?.distance < 17
  ? Math.atan2(
      player.position.x-nearestSpawnBuilding.location.group.position.x,
      player.position.z-nearestSpawnBuilding.location.group.position.z,
    )
  : 0
const restoredSpawnYaw = Number.isFinite(saved?.yaw) ? saved.yaw : fallbackSpawnYaw
player.rotation.y = restoredSpawnYaw
state.cameraYaw = restoredSpawnYaw
state.cameraYawTarget = restoredSpawnYaw
world.add(player)
const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }))
playerShadow.rotation.x = -Math.PI / 2
playerShadow.position.set(player.position.x, 0.55, player.position.z)
world.add(playerShadow)

let avatarMixer = null
let avatarActions = null
let activeAvatarAction = null
let avatarReady = false
let currentAvatarVisual = fallbackAvatar
let selectedCharacter = defaultCharacter
let avatarLoadVersion = 0

function findNamedClip(clips, pattern) {
  return clips.find((clip) => pattern.test(clip.name)) || null
}

function mapAvatarClips(clips) {
  const named = {
    idle: findNamedClip(clips, /idle|wait|stay/i),
    walk: findNamedClip(clips, /walk/i),
    run: findNamedClip(clips, /run|sprint/i),
    jump: findNamedClip(clips, /jump/i),
  }
  if (named.idle && named.walk && named.run) {
    named.jump ||= named.run.clone()
    named.jump.name = `${named.jump.name || 'Run'}_JumpFallback`
    return named
  }

  if (clips.length === 4 && clips.every((clip) => /^NlaTrack/.test(clip.name))) {
    return { idle: clips[0], jump: clips[1], walk: clips[2], run: clips[3] }
  }

  const byDuration = [...clips].sort((a, b) => a.duration - b.duration)
  const run = byDuration[0]
  const idle = byDuration[byDuration.length - 1]
  const middle = byDuration.filter((clip) => clip !== run && clip !== idle).sort((a, b) => a.duration - b.duration)
  return { idle, walk: middle[0], jump: middle[1], run }
}

function stabiliseJumpClip(clip) {
  if (!clip) return null
  const stable = clip.clone()
  stable.tracks = stable.tracks.filter((track) => !/(^|\.)(Root|Armature)\.position$/i.test(track.name))
  return stable
}

function setAvatarAction(name, fade = 0.18) {
  if (!avatarActions || activeAvatarAction === name || !avatarActions[name]) return
  const previous = activeAvatarAction ? avatarActions[activeAvatarAction] : null
  const next = avatarActions[name]
  next.enabled = true
  next.reset()
  next.setEffectiveWeight(1)
  next.setEffectiveTimeScale(name === 'run' ? 1.08 : name === 'walk' ? 2 : 1)
  if (name === 'jump') {
    next.setLoop(THREE.LoopOnce, 1)
    next.clampWhenFinished = true
    next.paused = true
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = false
    next.paused = false
  }
  if (previous) previous.fadeOut(fade)
  next.fadeIn(fade).play()
  activeAvatarAction = name
  if (avatarReady) avatarState.querySelector('span').textContent = selectedCharacter.name
}

function clearControlledAvatar() {
  avatarLoadVersion += 1
  avatarMixer?.stopAllAction()
  avatarMixer = null
  avatarActions = null
  activeAvatarAction = null
  avatarReady = false
  if (currentAvatarVisual) player.remove(currentAvatarVisual)
  currentAvatarVisual = null
  player.userData.rig = null
}

function createAvatarLoader() {
  const manager = new THREE.LoadingManager()
  manager.setURLModifier((url) => /Textures\/colormap\.png(?:$|\?)/i.test(url) ? NEUTRAL_AVATAR_TEXTURE : url)
  return new GLTFLoader(manager)
}

function attachProceduralAvatar(character) {
  const model = makeRosterAvatar(character)
  player.add(model)
  currentAvatarVisual = model
  player.userData.rig = model.userData.rig
  avatarState.classList.add('is-ready')
  avatarState.classList.remove('is-error')
  avatarState.querySelector('span').textContent = character.name
  window.__UPGRADVERSE_AVATAR__ = { ready:true, character:character.id, source:'procedural-cyborg-rig' }
}

function loadPlayerAvatar(character = selectedCharacter) {
  clearControlledAvatar()
  selectedCharacter = character
  localStorage.setItem('upgradverse-character', character.id)
  avatarState.classList.remove('is-ready','is-error')
  avatarState.querySelector('span').textContent = `${character.name} · LOADING`
  if (!character.model) {
    attachProceduralAvatar(character)
    return
  }
  const requestVersion = avatarLoadVersion
  const loader = createAvatarLoader()
  loader.load(
    character.model,
    (gltf) => {
      if (requestVersion !== avatarLoadVersion) return
      const model = gltf.scene
      model.updateMatrixWorld(true)
      const sourceBounds = new THREE.Box3().setFromObject(model)
      const sourceSize = sourceBounds.getSize(new THREE.Vector3())
      const scale = PLAYER_HEIGHT / Math.max(sourceSize.y, 0.001)
      model.scale.setScalar(scale)
      model.updateMatrixWorld(true)
      const scaledBounds = new THREE.Box3().setFromObject(model)
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())
      model.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z)

      model.traverse((child) => {
        if (!child.isMesh) return
        child.frustumCulled = false
        child.castShadow = true
        child.receiveShadow = true
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((entry) => {
          if (!entry) return
          entry.roughness = Math.min(entry.roughness ?? 0.72, 0.72)
          entry.metalness = Math.max(entry.metalness ?? 0.08, 0.08)
          if (entry.map) entry.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
          entry.needsUpdate = true
        })
      })

      const facingRoot = new THREE.Group()
      facingRoot.rotation.y = Math.PI
      facingRoot.add(model)
      player.add(facingRoot)
      currentAvatarVisual = facingRoot

      avatarMixer = new THREE.AnimationMixer(model)
      const clips = mapAvatarClips(gltf.animations)
      clips.jump = stabiliseJumpClip(clips.jump)
      avatarActions = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip).map(([name, clip]) => [name, avatarMixer.clipAction(clip)]))
      avatarReady = true
      setAvatarAction('idle', 0)
      player.userData.rig = null
      avatarState.classList.add('is-ready')
      avatarState.querySelector('span').textContent = character.name
      window.__UPGRADVERSE_AVATAR__ = {
        ready: true,
        character: character.id,
        clips: Object.fromEntries(Object.entries(clips).map(([name, clip]) => [name, { source: clip.name, duration: clip.duration }])),
      }
    },
    undefined,
    (error) => {
      if (requestVersion !== avatarLoadVersion) return
      console.error('upGradVerse avatar failed to load', error)
      avatarState.classList.add('is-error')
      avatarState.querySelector('span').textContent = `${character.name} · FALLBACK`
      attachProceduralAvatar(character)
      window.__UPGRADVERSE_AVATAR__ = { ready: false, character:character.id, fallback:true, error: String(error?.message || error) }
    },
  )
}

const savedCharacterId = localStorage.getItem('upgradverse-character')
selectedCharacter = CHARACTER_ROSTER.find((entry) => entry.id === savedCharacterId) || defaultCharacter
loadPlayerAvatar(selectedCharacter)

const characterPreviewCanvas = $('#character-preview')
const characterTurntable = document.querySelector('.character-turntable')
const characterPreviewScene = new THREE.Scene()
const characterPreviewCamera = new THREE.PerspectiveCamera(32, 1, .05, 30)
characterPreviewCamera.position.set(0, 2.45, 7.2)
characterPreviewCamera.lookAt(0, 2.05, 0)
const characterPreviewRenderer = new THREE.WebGLRenderer({ canvas:characterPreviewCanvas, antialias:true, alpha:true, powerPreference:'high-performance' })
characterPreviewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.15))
characterPreviewRenderer.outputColorSpace = THREE.SRGBColorSpace
characterPreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping
characterPreviewRenderer.toneMappingExposure = 1.28
characterPreviewScene.add(new THREE.HemisphereLight(0xe9efff, 0x301018, 2.4))
const previewKey = new THREE.DirectionalLight(0xffffff, 4.5)
previewKey.position.set(-3, 5, 5)
characterPreviewScene.add(previewKey)
const previewRim = new THREE.PointLight(COLORS.red, 28, 12, 2)
previewRim.position.set(3, 3, -2)
characterPreviewScene.add(previewRim)
const previewGroup = new THREE.Group()
characterPreviewScene.add(previewGroup)
let previewVersion = 0
let previewDragging = false
let previewPointerX = 0
let previewSpin = .34

function clearPreview() {
  previewVersion += 1
  while (previewGroup.children.length) previewGroup.remove(previewGroup.children[0])
}

function fitPreviewModel(model, height = 4.25) {
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())
  const scale = height / Math.max(size.y, .001)
  model.scale.setScalar(scale)
  model.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(model)
  const center = scaled.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -scaled.min.y, -center.z)
  model.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
  })
}

function showCharacterPreview(character) {
  clearPreview()
  previewRim.color.setHex(character.color)
  characterTurntable.classList.toggle('is-kish', character.id === 'kish-prime')
  const version = previewVersion
  if (!character.model) {
    const avatar = makeRosterAvatar(character, .88)
    previewGroup.add(avatar)
    return
  }
  createAvatarLoader().load(character.model, (gltf) => {
    if (version !== previewVersion) return
    const model = cloneSkeleton(gltf.scene)
    fitPreviewModel(model)
    model.rotation.y = 0
    previewGroup.add(model)
  }, undefined, () => {
    if (version !== previewVersion) return
    previewGroup.add(makeRosterAvatar(character, .88))
  })
}

function updateCharacterProfile(character) {
  $('#character-name').textContent = character.name
  $('#character-role').textContent = character.role
  $('#character-bio').textContent = character.bio
  $('#character-traits').innerHTML = character.traits.map((trait) => `<span>${trait}</span>`).join('')
  $('#character-stats').innerHTML = [
    ['INSTINCT',character.instinct],['AGILITY',character.agility],['TECH',character.tech],
  ].map(([label,value]) => `<span><small>${label}</small><i><b style="width:${value}%"></b></i></span>`).join('')
  document.querySelector('.character-select__header em').textContent = `${String(CHARACTER_ROSTER.indexOf(character)+1).padStart(2,'0')} / 06`
  document.querySelector('.character-profile .eyebrow').textContent = character.id === 'kish-prime' ? 'DEFAULT VANGUARD' : character.type === 'robot' || character.type === 'heavy' ? 'SYNTH CLASS' : 'CYBORG CLASS'
}

function selectCharacter(character, announce = true) {
  selectedCharacter = character
  document.querySelectorAll('.character-card').forEach((card) => {
    const active = card.dataset.character === character.id
    card.classList.toggle('is-selected', active)
    card.setAttribute('aria-selected', String(active))
  })
  updateCharacterProfile(character)
  showCharacterPreview(character)
  loadPlayerAvatar(character)
  if (announce) playRumble(state.activeGamepad,'select').catch(()=>{})
}

function selectRelativeCharacter(delta) {
  const currentIndex = CHARACTER_ROSTER.indexOf(selectedCharacter)
  const nextIndex = (currentIndex + delta + CHARACTER_ROSTER.length) % CHARACTER_ROSTER.length
  selectCharacter(CHARACTER_ROSTER[nextIndex])
}

document.querySelectorAll('.character-card').forEach((card) => card.addEventListener('click', () => {
  const character = CHARACTER_ROSTER.find((entry) => entry.id === card.dataset.character)
  if (character) selectCharacter(character)
}))
characterPreviewCanvas.addEventListener('pointerdown', (event) => {
  previewDragging = true
  previewPointerX = event.clientX
  characterPreviewCanvas.setPointerCapture(event.pointerId)
})
characterPreviewCanvas.addEventListener('pointermove', (event) => {
  if (!previewDragging) return
  const delta = event.clientX - previewPointerX
  previewGroup.rotation.y += delta * .012
  previewPointerX = event.clientX
})
characterPreviewCanvas.addEventListener('pointerup', () => { previewDragging = false })

function renderCharacterPreview() {
  const rect = characterPreviewCanvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  if (characterPreviewCanvas.width !== width || characterPreviewCanvas.height !== height) {
    characterPreviewRenderer.setSize(width, height, false)
    characterPreviewCamera.aspect = width / height
    characterPreviewCamera.updateProjectionMatrix()
  }
  if (!previewDragging) previewGroup.rotation.y += .0042 * previewSpin
  previewGroup.position.y = Math.sin(performance.now() * .0014) * .025
  characterPreviewRenderer.render(characterPreviewScene, characterPreviewCamera)
}
characterPreviewRenderer.setAnimationLoop(renderCharacterPreview)
selectCharacter(selectedCharacter, false)

const npcCount = 44
const pedestrianPaths = [
  [-32,-10,-9,-10],[9,-10,32,-10],[-32,15,-9,15],[9,15,32,15],
  [-35,-9,-35,17],[35,-9,35,17],[-9,31,-9,60],[9,31,9,60],
  [-32,31,-32,60],[32,31,32,60],[-26,-27,26,-27],[-52,-27,-52,15],[52,-27,52,15],
]
const npcData = Array.from({ length: npcCount }, (_, index) => {
  const path = pedestrianPaths[index % pedestrianPaths.length]
  const style = index % 7 === 0 ? 'monster' : index % 3 === 0 ? 'cyborg' : 'human'
  const skins = [0x6f4334,0x9b6552,0xc78e72,0xe2b69b,0x5f3d33]
  const outfits = [0x222832,0x633348,0x263f42,0x6f5a38,0x3c315c,0x1f2025]
  return {
    startX: path[0], startZ: path[1], endX: path[2], endZ: path[3],
    phase: random() * 2,
    speed: 0.035 + random() * 0.035,
    scale: 0.43 + random() * 0.12,
    style,
    color: style === 'cyborg' ? (index % 2 ? COLORS.cyan : COLORS.red) : outfits[index % outfits.length],
    skin: style === 'monster' ? (index % 2 ? 0x72629d : 0x4e8b72) : skins[index % skins.length],
  }
})
const npcGeometries = {
  torso: new THREE.CapsuleGeometry(0.48, 0.9, 4, 8), head: new THREE.SphereGeometry(0.43, 10, 8),
  core: new THREE.TorusGeometry(0.38, 0.1, 6, 14), limb: new THREE.CapsuleGeometry(0.12, 0.76, 3, 6),
  visor: new THREE.BoxGeometry(.72,.18,.13), horn: new THREE.ConeGeometry(.13,.48,6),
}
const npcTorso = new THREE.InstancedMesh(npcGeometries.torso, material(0xffffff, .58, .22), npcCount)
const npcHead = new THREE.InstancedMesh(npcGeometries.head, material(0xffffff, .76, .08), npcCount)
const npcCore = new THREE.InstancedMesh(npcGeometries.core, material(0xffffff, .35, .7, 0xffffff, .9), npcCount)
const npcLimbs = new THREE.InstancedMesh(npcGeometries.limb, material(0x706b73, .42, .65), npcCount * 4)
const npcVisors = new THREE.InstancedMesh(npcGeometries.visor, material(0x89eaff,.14,.72,0x4ed3ff,1.5), npcCount)
const npcHorns = new THREE.InstancedMesh(npcGeometries.horn, material(0xd8c0a5,.52,.14), npcCount * 2)
for (const instances of [npcTorso,npcHead,npcCore,npcLimbs,npcVisors,npcHorns]) {
  instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  instances.castShadow = true
  instances.receiveShadow = true
}
npcData.forEach((npc,index) => {
  const color = new THREE.Color(npc.color)
  npcTorso.setColorAt(index,color)
  npcCore.setColorAt(index,color)
  npcHead.setColorAt(index,new THREE.Color(npc.skin))
})
world.add(npcTorso,npcHead,npcCore,npcLimbs,npcVisors,npcHorns)
const npcDummy = new THREE.Object3D()

function setNpcPart(instances, index, x, y, z, yaw, scaleX, scaleY, scaleZ, rotationX = 0) {
  npcDummy.position.set(x,y,z); npcDummy.rotation.set(rotationX,yaw,0); npcDummy.scale.set(scaleX,scaleY,scaleZ); npcDummy.updateMatrix(); instances.setMatrixAt(index,npcDummy.matrix)
}

function updateNpcs(elapsed) {
  npcData.forEach((npc,index) => {
    const cycle = (elapsed * npc.speed + npc.phase) % 2
    const forwardTrip = cycle <= 1
    const progress = forwardTrip ? cycle : 2 - cycle
    const x = THREE.MathUtils.lerp(npc.startX, npc.endX, progress)
    const z = THREE.MathUtils.lerp(npc.startZ, npc.endZ, progress)
    const directionX = (npc.endX - npc.startX) * (forwardTrip ? 1 : -1)
    const directionZ = (npc.endZ - npc.startZ) * (forwardTrip ? 1 : -1)
    const yaw = Math.atan2(-directionX, -directionZ)
    const step = Math.sin(elapsed * 4.2 + npc.phase) * 0.35
    const s = npc.scale
    const cyborg = npc.style === 'cyborg'
    const monster = npc.style === 'monster'
    setNpcPart(npcTorso,index,x,2.12*s,z,yaw,1.05*s,1.04*s,.72*s)
    setNpcPart(npcHead,index,x,3.7*s,z,yaw,s*(monster?1.18:1),s*(monster?1.1:1),s)
    setNpcPart(npcCore,index,x,3.7*s,z+.2*s,yaw+Math.PI/2,cyborg?s:.001,cyborg?s:.001,cyborg?s:.001,Math.PI/2)
    setNpcPart(npcVisors,index,x,3.77*s,z-.39*s,yaw,cyborg?s:.001,cyborg?s:.001,cyborg?s:.001)
    for(let horn=0;horn<2;horn+=1){
      const side=horn?1:-1
      setNpcPart(npcHorns,index*2+horn,x+side*.22*s,4.13*s,z,yaw,monster?s:.001,monster?s*.9:.001,monster?s:.001,side*.2)
    }
    for (let limb=0;limb<4;limb+=1) {
      const side = limb%2===0 ? -1 : 1
      const isLeg = limb>=2
      const localX = side*(isLeg?.3:.68)*s
      const localY = (isLeg?1.02:2.26)*s
      const swing = (side*(isLeg?step:-step))
      const offsetX = localX*Math.cos(yaw)
      const offsetZ = -localX*Math.sin(yaw)
      setNpcPart(npcLimbs,index*4+limb,x+offsetX,localY,z+offsetZ,yaw,s,s,s,swing)
    }
  })
  ;[npcTorso,npcHead,npcCore,npcLimbs,npcVisors,npcHorns].forEach((instances) => { instances.instanceMatrix.needsUpdate = true })
}

const riggedCitizens = []

function loadRiggedCitizens() {
  const loader = new GLTFLoader()
  loader.load('/assets/characters/third-party/RobotExpressive.glb', (gltf) => {
    const walkingClip = gltf.animations.find((clip) => /walking/i.test(clip.name)) || gltf.animations[0]
    const paths = pedestrianPaths.slice(0, 8)
    paths.forEach((path, index) => {
      const model = cloneSkeleton(gltf.scene)
      model.updateMatrixWorld(true)
      const sourceBounds = new THREE.Box3().setFromObject(model)
      const sourceSize = sourceBounds.getSize(new THREE.Vector3())
      model.scale.setScalar((1.72 + (index % 3) * .08) / Math.max(sourceSize.y, .001))
      model.updateMatrixWorld(true)
      const scaledBounds = new THREE.Box3().setFromObject(model)
      model.position.y = -scaledBounds.min.y
      model.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material = child.material.clone()
          const tint = [0xe6e7ea,0x677985,0x925464,0x75648f,0x55776f,0x8a6d4d,0x50535c,0x9b404c][index]
          child.material.color.lerp(new THREE.Color(tint), .34)
          child.material.metalness = Math.max(.34, child.material.metalness || 0)
          child.material.roughness = Math.min(.56, child.material.roughness ?? .56)
        }
      })
      const root = new THREE.Group()
      root.position.set(path[0], .54, path[1])
      root.add(model)
      const mixer = new THREE.AnimationMixer(model)
      if (walkingClip) mixer.clipAction(walkingClip).setEffectiveTimeScale(.82 + index * .025).play()
      world.add(root)
      riggedCitizens.push({ root, mixer, path, phase: random() * 2, speed: .042 + random() * .02 })
    })
    window.__UPGRADVERSE_CITIZENS__ = { ready: true, rigged: riggedCitizens.length, procedural: npcCount }
  }, undefined, (error) => {
    console.warn('Rigged robot citizens unavailable; procedural population remains active.', error)
    window.__UPGRADVERSE_CITIZENS__ = { ready: false, rigged: 0, procedural: npcCount }
  })
}

function updateRiggedCitizens(dt, elapsed) {
  riggedCitizens.forEach((citizen) => {
    const [startX,startZ,endX,endZ] = citizen.path
    const cycle = (elapsed * citizen.speed + citizen.phase) % 2
    const forwardTrip = cycle <= 1
    const progress = forwardTrip ? cycle : 2 - cycle
    citizen.root.position.x = THREE.MathUtils.lerp(startX,endX,progress)
    citizen.root.position.z = THREE.MathUtils.lerp(startZ,endZ,progress)
    const directionX = (endX-startX) * (forwardTrip ? 1 : -1)
    const directionZ = (endZ-startZ) * (forwardTrip ? 1 : -1)
    citizen.root.rotation.y = Math.atan2(-directionX,-directionZ)
    citizen.mixer.update(dt)
  })
}

loadRiggedCitizens()

const labelAnchors = {
  upgrad: new THREE.Vector3(CITY.hq.x, 31.5, CITY.hq.z),
  chatgpt: new THREE.Vector3(CITY.chatgpt.x, 17.2, CITY.chatgpt.z),
  human: new THREE.Vector3(CITY.human.x, 13.3, CITY.human.z),
  claude: new THREE.Vector3(CITY.claude.x, 20.1, CITY.claude.z),
  arena: new THREE.Vector3(23, 7.2, 46),
}
function updateLabel(id, vector) {
  const node = $(`#label-${id}`)
  const projected = vector.clone().project(camera)
  const visible = projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15
  node.style.opacity = visible ? '1' : '0'
  node.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`
  node.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`
}

function placeRadarMarker(node, target) {
  const dx = target.x - player.position.x
  const dz = target.z - player.position.z
  const cosine = Math.cos(state.cameraYaw), sine = Math.sin(state.cameraYaw)
  let radarX = (dx * cosine - dz * sine) * 1.28
  let radarY = (dx * sine + dz * cosine) * 1.28
  const edge = Math.hypot(radarX / 67, radarY / 45)
  if (edge > 1) { radarX /= edge; radarY /= edge }
  node.style.left = `${77 + radarX}px`; node.style.top = `${55 + radarY}px`
}

function updateObjectiveVisuals() {
  const upgrad = interactables.find((entry) => entry.id === 'upgrad')
  const chatgpt = interactables.find((entry) => entry.id === 'chatgpt')
  const human = interactables.find((entry) => entry.id === 'human')
  const claude = interactables.find((entry) => entry.id === 'claude')
  const arena = interactables.find((entry) => entry.id === 'arena')
  placeRadarMarker(radarUpgrad, upgrad.position); placeRadarMarker(radarChatgpt, chatgpt.position); placeRadarMarker(radarHuman, human.position); placeRadarMarker(radarClaude, claude.position); placeRadarMarker(radarArena, arena.position)
  const objective = state.objectiveId === 'upgrad' ? upgrad : state.objectiveId === 'human' ? human : state.objectiveId === 'claude' ? claude : state.objectiveId === 'arena' ? arena : chatgpt
  const distance = Math.hypot(objective.position.x-player.position.x,objective.position.z-player.position.z)
  const metres = Math.max(0,Math.round(distance))
  radarTitle.textContent = objective.id === 'upgrad' ? 'UPGRAD SKILL SHOP' : objective.id === 'chatgpt' ? 'CHATGPT SKILL SHOP' : objective.id === 'claude' ? 'CLAUDE SKILL SHOP' : objective.id === 'arena' ? 'VERSE FIGHT RING' : 'HUMAN INSTINCTS'
  radarDistance.textContent = distance < 4.35 ? 'LOCATION REACHED · PRESS E' : `${metres} M · FOLLOW MARKER`
  navigationTarget.textContent = objective.id === 'upgrad' ? 'upGrad Skill Shop' : objective.id === 'chatgpt' ? 'ChatGPT Skill Shop' : objective.id === 'claude' ? 'Claude Skill Shop' : objective.id === 'arena' ? 'Verse Fight Ring' : 'Human Instincts'
  navigationMeta.textContent = distance < 4.35 ? 'Entrance reached' : `${metres} m away`
  objectiveDistance.textContent = objective.id === 'chatgpt' ? (distance < 4.35 ? 'Entrance reached' : `${metres} m away`) : 'Live district'
  claudeDistance.textContent = objective.id === 'claude' ? (distance < 4.35 ? 'Entrance reached' : `${metres} m away`) : 'New district'
  waypoint.position.copy(objective.position)
  waypoint.children.forEach((child) => {
    if (child.material?.color) child.material.color.setHex(objective.id === 'upgrad' ? COLORS.red : objective.id === 'chatgpt' ? COLORS.openai : objective.id === 'claude' ? COLORS.claude : objective.id === 'arena' ? COLORS.violet : COLORS.cyan)
  })
}

function setPaused(value) {
  state.paused = value
  pauseScreen.classList.toggle('is-visible', value)
  pauseScreen.setAttribute('aria-hidden', String(!value))
}

function openLocation(location) {
  if (!location) return
  state.modalOpen = true; state.modalLocationId = location.id; state.paused = true
  const upgrad = location.id === 'upgrad'
  const chatgpt = location.id === 'chatgpt'
  const claude = location.id === 'claude'
  const arena = location.id === 'arena'
  $('#modal-eyebrow').textContent = upgrad ? 'SKILL SHOP 03 / COURSE ARCADE' : chatgpt ? 'SKILL SHOP 01 / LIVE LAB' : claude ? 'SKILL SHOP 02 / ARTIFACT STUDIO' : arena ? 'LIVE EVENT / HUMAN × MACHINE' : 'ASSESSMENT DISTRICT / CONNECTED'
  $('#modal-title').textContent = upgrad ? 'upGrad Skill Shop' : chatgpt ? 'ChatGPT Skill Shop' : claude ? 'Claude Skill Shop' : arena ? 'Verse Fight Ring' : 'Human Instincts'
  $('#modal-copy').textContent = upgrad
    ? 'Three visual course missions: find trustworthy data, repair a full-stack pipeline, then allocate a campaign budget to hit the target.'
    : chatgpt
    ? 'Three visual missions: match the task to a model, build its memory packet, then repair and verify a failed code session.'
    : claude
      ? 'A living artifact studio for visual reasoning, long-context synthesis, and building polished work from complex source material.'
      : arena
        ? 'Step into an original neon octagon. Read the opponent, combine six moves, and prove human instinct can outfight machine precision.'
        : 'A visual decision game that measures how you direct, question and improve AI output across five human-instinct parameters.'
  $('#modal-status').textContent = upgrad || chatgpt || claude ? '03 VISUAL CHALLENGES · ~02 MIN · REWARD SAVES' : arena ? '06 MOVES · LIVE SCORE · CROWD AUDIO' : 'EXPERIENCE LINK RESERVED'
  $('#modal-primary').textContent = upgrad ? 'ENTER COURSE ARCADE' : chatgpt ? 'ENTER LIVE LAB' : claude ? 'ENTER ARTIFACT STUDIO' : arena ? 'ENTER THE OCTAGON' : 'ENTER HUMAN INSTINCTS'
  locationModal.classList.add('is-visible'); locationModal.setAttribute('aria-hidden','false')
  playRumble(state.activeGamepad,'success').catch(()=>{})
}
function closeLocation() { state.modalOpen=false; state.modalLocationId=null; state.paused=false; locationModal.classList.remove('is-visible'); locationModal.setAttribute('aria-hidden','true') }

function pulseVehicleHaptic(strongMagnitude, weakMagnitude, duration = 70) {
  const actuator = state.activeGamepad?.vibrationActuator || state.activeGamepad?.hapticActuators?.[0]
  if (!actuator) return
  if (typeof actuator.playEffect === 'function') {
    const effect = actuator.effects?.includes('dual-rumble') ? 'dual-rumble' : actuator.effects?.[0] || 'dual-rumble'
    actuator.playEffect(effect, { startDelay: 0, duration, strongMagnitude, weakMagnitude }).catch(() => {})
  } else if (typeof actuator.pulse === 'function') {
    actuator.pulse(Math.max(strongMagnitude, weakMagnitude), duration).catch(() => {})
  }
}

const skillShop = createChatGPTSkillShop({
  onExit() {
    state.keys.clear()
    state.paused = false
    state.modalOpen = false
    state.modalLocationId = null
    renderer.domElement.focus({ preventScroll: true })
  },
  onReward(reward) {
    savePill.textContent = `${reward.badge} · SKILL CORE SAVED`
    savePill.classList.add('is-visible')
    clearTimeout(state.lastSave)
    state.lastSave = setTimeout(() => {
      savePill.classList.remove('is-visible')
      savePill.textContent = 'CHECKPOINT SAVED'
    }, 1700)
  },
  onHaptic(type) {
    const preset = type === 'impact' ? 'impact' : type === 'success' ? 'success' : 'select'
    playRumble(state.activeGamepad, preset).catch(() => {})
  },
})

const claudeSkillShop = createClaudeSkillShop({
  onExit() {
    state.keys.clear()
    state.paused = false
    state.modalOpen = false
    state.modalLocationId = null
    renderer.domElement.focus({ preventScroll: true })
  },
  onReward(reward) {
    savePill.textContent = `${reward.badge} · CLAUDE CORE SAVED`
    savePill.classList.add('is-visible')
    clearTimeout(state.lastSave)
    state.lastSave = setTimeout(() => {
      savePill.classList.remove('is-visible')
      savePill.textContent = 'CHECKPOINT SAVED'
    }, 1700)
  },
  onHaptic(type) {
    const preset = type === 'impact' ? 'impact' : type === 'success' ? 'success' : 'select'
    playRumble(state.activeGamepad, preset).catch(() => {})
  },
})

const upgradSkillShop = createUpgradSkillShop({
  host: shell,
  onClose() {
    state.keys.clear()
    state.paused = false
    state.modalOpen = false
    state.modalLocationId = null
    renderer.domElement.focus({ preventScroll: true })
  },
  onReward(reward) {
    savePill.textContent = `${reward.badge || 'COURSE CORE'} · UPGRAD CORE SAVED`
    savePill.classList.add('is-visible')
    clearTimeout(state.lastSave)
    state.lastSave = setTimeout(() => {
      savePill.classList.remove('is-visible')
      savePill.textContent = 'CHECKPOINT SAVED'
    }, 1700)
  },
  onHaptic: sendExperienceHaptic,
})

function sendExperienceHaptic(type) {
  const preset = type === 'impact' ? 'impact' : type === 'success' ? 'success' : 'select'
  playRumble(state.activeGamepad, preset).catch(() => {})
  window.upGradVerseInput?.sendPhoneHaptic?.(preset)
}

const arenaGame = createVerseArena3D({
  scene,
  world,
  camera,
  onExit() {
    cityUpgrade.arena.root.visible = true
    shell.classList.remove('is-arena-open')
    state.keys.clear()
    state.paused = false
    state.modalOpen = false
    state.modalLocationId = null
    renderer.domElement.focus({ preventScroll: true })
  },
  onReward(reward) {
    savePill.textContent = `${String(reward.score).padStart(4, '0')} PTS · ARENA CORE SAVED`
    savePill.classList.add('is-visible')
    clearTimeout(state.lastSave)
    state.lastSave = setTimeout(() => {
      savePill.classList.remove('is-visible')
      savePill.textContent = 'CHECKPOINT SAVED'
    }, 1900)
  },
  onHaptic: sendExperienceHaptic,
})

function launchChatGPTSkillShop() {
  state.keys.clear()
  locationModal.classList.remove('is-visible')
  locationModal.setAttribute('aria-hidden', 'true')
  state.modalOpen = false
  state.modalLocationId = null
  state.paused = true
  skillShop.launch()
}

function launchClaudeSkillShop() {
  state.keys.clear()
  locationModal.classList.remove('is-visible')
  locationModal.setAttribute('aria-hidden', 'true')
  state.modalOpen = false
  state.modalLocationId = null
  state.paused = true
  claudeSkillShop.launch()
}

function launchUpgradSkillShop() {
  state.keys.clear()
  locationModal.classList.remove('is-visible')
  locationModal.setAttribute('aria-hidden', 'true')
  state.modalOpen = false
  state.modalLocationId = null
  state.paused = true
  upgradSkillShop.launch()
}

function launchVerseArena() {
  state.keys.clear()
  locationModal.classList.remove('is-visible')
  locationModal.setAttribute('aria-hidden', 'true')
  state.modalOpen = false
  state.modalLocationId = null
  state.paused = true
  cityUpgrade.arena.root.visible = false
  shell.classList.add('is-arena-open')
  arenaGame.launch()
}

let boundaryImpactCooldown = 0
let boundaryImpactTimer = 0

function triggerBoundaryImpact(strength = .6) {
  const now = Date.now()
  if (now < boundaryImpactCooldown) return
  boundaryImpactCooldown = now + 420
  shell.style.setProperty('--boundary-hit', String(THREE.MathUtils.clamp(strength, .35, 1)))
  shell.classList.remove('is-boundary-impact')
  void shell.offsetWidth
  shell.classList.add('is-boundary-impact')
  clearTimeout(boundaryImpactTimer)
  boundaryImpactTimer = setTimeout(() => shell.classList.remove('is-boundary-impact'), 260)
  pulseVehicleHaptic(.12 + strength * .16, .36 + strength * .34, 105)
}

function updateSimulationBoundary(dt, elapsed) {
  const trackedPosition = state.drivingVehicle?.root.position || player.position
  const edge = Math.max(Math.abs(trackedPosition.x), Math.abs(trackedPosition.z))
  const target = state.started ? THREE.MathUtils.smoothstep(edge, 60.5, 68.2) : 0
  state.boundaryIntensity = THREE.MathUtils.lerp(state.boundaryIntensity, target, 1 - Math.exp(-dt * 6.5))
  const intensity = state.boundaryIntensity
  const visible = intensity > .008
  const pulse = .78 + Math.sin(elapsed * 10.5) * .12 + Math.sin(elapsed * 23.7) * .07
  boundaryField.visible = visible
  boundaryFragments.visible = visible
  boundaryGridMaterial.opacity = intensity * .23 * pulse
  boundaryFragmentMaterial.opacity = intensity * .72 * pulse
  boundaryField.rotation.y = 0
  boundaryFragments.rotation.y = 0
  boundaryRings.forEach((ring, index) => {
    ring.visible = visible
    ring.material.opacity = intensity * (.11 + ((index + Math.floor(elapsed * 5)) % 3 === 0 ? .19 : .06))
    ring.scale.setScalar(1 + Math.sin(elapsed * 4.2 + index) * .0009)
  })
  shell.style.setProperty('--boundary-strength', intensity.toFixed(3))
  shell.classList.toggle('is-near-boundary', visible)
}

function vehicleForward(vehicle, target = new THREE.Vector3()) {
  return target.set(-Math.sin(vehicle.root.rotation.y), 0, -Math.cos(vehicle.root.rotation.y))
}

function vehicleRight(vehicle, target = new THREE.Vector3()) {
  return target.set(Math.cos(vehicle.root.rotation.y), 0, -Math.sin(vehicle.root.rotation.y))
}

function isOpenWorldPosition(position, clearance = PLAYER_RADIUS) {
  if (Math.abs(position.x) > CITY.halfExtent - clearance || Math.abs(position.z) > CITY.halfExtent - clearance) return false
  return collisionCircles.every((circle) => Math.hypot(position.x - circle.x, position.z - circle.z) >= circle.r + clearance)
}

function setVehicleBrakeLights(vehicle, active) {
  vehicle.brakeLights.forEach((light) => {
    light.material.emissiveIntensity = THREE.MathUtils.lerp(light.material.emissiveIntensity, active ? 4.4 : .35, .26)
    light.material.color.setHex(active ? 0xff243e : 0x6b0a16)
  })
}

function updateVehicleHud(vehicle) {
  if (!vehicle) return
  const kmh = Math.round(Math.abs(vehicle.speed) * 3.6)
  vehicleSpeed.textContent = String(kmh).padStart(3, '0')
  vehicleClass.textContent = vehicle.config.kind
  vehicleName.textContent = vehicle.config.label.toUpperCase()
  vehicleGear.textContent = state.pendingExit
    ? 'SAFE EXIT · BRAKING'
    : vehicle.handbrakeInput > .1 ? 'HANDBRAKE · DRIFT'
    : vehicle.speed < -.35 ? 'REVERSE' : vehicle.brakeInput > .1 ? 'BRAKING' : vehicle.throttleInput > .1 ? 'ENGINE DRIVE' : Math.abs(vehicle.speed) > .5 ? 'COASTING' : 'ENGINE IDLE'
  vehicleCamera.textContent = VEHICLE_CAMERAS[state.vehicleCameraMode].name
}

function enterVehicle(vehicle) {
  if (!vehicle || state.drivingVehicle) return
  state.pendingVehicle = null
  state.pendingExit = false
  state.drivingVehicle = vehicle
  state.nearVehicle = null
  state.nearLocation = null
  state.vehicleCameraMode = 0
  state.vehicleCameraYawOffset = 0
  state.vehicleCameraPitch = -.03
  state.vehicleCameraInputTimer = 0
  vehicle.state = 'player'
  vehicle.traffic = false
  vehicle.speed = Math.abs(vehicle.speed) < .4 ? 0 : vehicle.speed
  vehicle.velocity.copy(vehicleForward(vehicle)).multiplyScalar(vehicle.speed)
  if (vehicle.driverSilhouette) vehicle.driverSilhouette.visible = false
  player.visible = false
  playerShadow.visible = false
  player.position.copy(vehicle.root.position)
  state.grounded = true
  state.jumpOffset = 0
  state.jumpElapsed = 0
  state.sprinting = false
  setAvatarAction('idle', .12)
  interactionPrompt.classList.remove('is-visible')
  vehicleHud.classList.add('is-visible')
  shell.classList.add('is-driving')
  updateVehicleHud(vehicle)
  playRumble(state.activeGamepad, 'success').catch(() => {})
}

function exitVehicle() {
  const vehicle = state.drivingVehicle
  if (!vehicle) return
  if (Math.abs(vehicle.speed) > .8) {
    state.pendingExit = true
    updateVehicleHud(vehicle)
    return
  }
  const rightVector = vehicleRight(vehicle)
  const sideDistance = vehicle.config.width * .5 + 1.05
  const preferred = vehicle.root.position.clone().addScaledVector(rightVector, -sideDistance)
  const alternate = vehicle.root.position.clone().addScaledVector(rightVector, sideDistance)
  const exitPosition = isOpenWorldPosition(preferred, PLAYER_RADIUS) ? preferred : alternate
  if (!isOpenWorldPosition(exitPosition, PLAYER_RADIUS)) exitPosition.copy(vehicle.root.position).addScaledVector(vehicleForward(vehicle), vehicle.config.length * .65)
  resolveCollision(exitPosition)

  vehicle.speed = 0
  vehicle.velocity.set(0, 0, 0)
  vehicle.steeringInput = 0
  vehicle.handbrakeInput = 0
  vehicle.state = 'available'
  setVehicleBrakeLights(vehicle, false)
  state.drivingVehicle = null
  state.pendingExit = false
  player.position.set(exitPosition.x, .52, exitPosition.z)
  player.rotation.y = vehicle.root.rotation.y
  player.visible = true
  playerShadow.visible = true
  state.cameraYaw = vehicle.root.rotation.y
  state.cameraYawTarget = vehicle.root.rotation.y
  state.cameraPitch = CAMERA_PITCH
  state.cameraPitchTarget = CAMERA_PITCH
  state.cameraDistance = CAMERA_DISTANCE
  state.cameraDistanceTarget = CAMERA_DISTANCE
  state.cameraInputTimer = 0
  state.moveMagnitude = 0
  vehicleHud.classList.remove('is-visible')
  shell.classList.remove('is-driving')
  setAvatarAction('idle', .12)
  playRumble(state.activeGamepad, 'success').catch(() => {})
}

function cycleVehicleCamera() {
  if (!state.drivingVehicle) return
  state.vehicleCameraMode = (state.vehicleCameraMode + 1) % VEHICLE_CAMERAS.length
  state.vehicleCameraYawOffset = 0
  state.vehicleCameraPitch = state.vehicleCameraMode === 2 ? -.015 : -.03
  state.vehicleCameraInputTimer = 0
  updateVehicleHud(state.drivingVehicle)
  pulseVehicleHaptic(.05, .28, 65)
}

function spawnVehicleDriver(vehicle) {
  if (!vehicle.driverSilhouette?.visible) return
  vehicle.driverSilhouette.visible = false
  const driver = makeSyntheticHuman(0xe6e1e4, .43)
  const side = vehicleRight(vehicle)
  driver.position.copy(vehicle.root.position).addScaledVector(side, -vehicle.config.width * .72)
  driver.position.y = .52
  driver.rotation.y = vehicle.root.rotation.y + Math.PI * .5
  world.add(driver)
  driverWalkers.push({
    group: driver,
    direction: side.clone().multiplyScalar(-1).addScaledVector(vehicleForward(vehicle), .35).normalize(),
    elapsed: 0,
    duration: 5.2,
    phase: random() * Math.PI * 2,
  })
}

function requestVehicle(vehicle) {
  if (!vehicle || state.pendingVehicle || state.drivingVehicle) return
  if (vehicle.state === 'available') {
    enterVehicle(vehicle)
    return
  }
  if (vehicle.state !== 'traffic') return
  state.pendingVehicle = vehicle
  state.nearVehicle = null
  vehicle.state = 'yielding'
  vehicle.yieldTimer = 0
  interactionPrompt.classList.add('is-visible')
  $('#interaction-title').textContent = `${vehicle.config.label} yielding safely…`
  pulseVehicleHaptic(.08, .34, 90)
}

function tryInteract() {
  if (state.drivingVehicle) { exitVehicle(); return }
  if (state.pendingVehicle) return
  if (state.nearVehicle) { requestVehicle(state.nearVehicle); return }
  if (!state.modalOpen && state.nearLocation) openLocation(state.nearLocation)
}
function triggerJump() {
  if (!state.started || state.paused || state.modalOpen || state.drivingVehicle || state.pendingVehicle || !state.grounded) return
  state.grounded=false; state.jumpVelocity=JUMP_VELOCITY; state.jumpElapsed=0; setAvatarAction('jump', .1); playRumble(state.activeGamepad,'select').catch(()=>{})
}

function resolveCollision(next) {
  const edgeLimit = CITY.halfExtent - .6
  if (Math.abs(next.x) > edgeLimit || Math.abs(next.z) > edgeLimit) {
    next.x = THREE.MathUtils.clamp(next.x, -edgeLimit, edgeLimit)
    next.z = THREE.MathUtils.clamp(next.z, -edgeLimit, edgeLimit)
    triggerBoundaryImpact(.48)
  }
  collisionCircles.forEach((circle) => {
    const dx=next.x-circle.x,dz=next.z-circle.z,distance=Math.hypot(dx,dz),minimum=circle.r+PLAYER_RADIUS
    if (distance<minimum) { const safe=Math.max(distance,.001); next.x=circle.x+(dx/safe)*minimum; next.z=circle.z+(dz/safe)*minimum }
  })
  vehicles.forEach((vehicle) => {
    if (vehicle === state.drivingVehicle || vehicle.state === 'yielding' || vehicle.state === 'driver-exiting') return
    const dx = next.x - vehicle.root.position.x
    const dz = next.z - vehicle.root.position.z
    const distance = Math.hypot(dx, dz)
    const minimum = vehicle.config.width * .54 + PLAYER_RADIUS
    if (distance < minimum) {
      const safe = Math.max(distance, .001)
      next.x = vehicle.root.position.x + dx / safe * minimum
      next.z = vehicle.root.position.z + dz / safe * minimum
    }
  })
}

const clock = new THREE.Clock()
const forward = new THREE.Vector3(), right = new THREE.Vector3(), desiredMove = new THREE.Vector3(), nextPosition = new THREE.Vector3()
const cameraTarget = new THREE.Vector3(), desiredCamera = new THREE.Vector3()
const vehicleNextPosition = new THREE.Vector3(), vehicleDesiredVelocity = new THREE.Vector3()
const vehicleCameraTarget = new THREE.Vector3(), vehicleCameraPosition = new THREE.Vector3(), vehicleLookTarget = new THREE.Vector3()
let fpsFrames=0,fpsElapsed=0,saveTimer=0

function moveToward(value, target, amount) {
  if (value < target) return Math.min(value + amount, target)
  return Math.max(value - amount, target)
}

function updateVehicleWheels(vehicle, dt) {
  vehicle.wheelSpin += vehicle.speed * dt / Math.max(vehicle.config.wheelRadius, .01)
  vehicle.wheels.forEach((wheel) => {
    wheel.spinPivot.rotation.x = vehicle.wheelSpin
    wheel.steeringPivot.rotation.y = wheel.front ? -vehicle.steeringInput * .48 : 0
  })
}

function registerVehicleImpact(vehicle, severity = 1) {
  if (vehicle.collisionTimer > 0) return
  vehicle.collisionTimer = .48
  vehicle.speed *= -.22
  vehicle.velocity.multiplyScalar(-.18)
  audio.collision(severity)
  playRumble(state.activeGamepad, 'impact').catch(() => {})
  vehicle.visualRoot.position.y = Math.min(.11, severity * .08)
}

function resolveVehicleCollision(vehicle, next) {
  let collided = false
  if (Math.abs(next.x) > VEHICLE_WORLD_RADIUS || Math.abs(next.z) > VEHICLE_WORLD_RADIUS) {
    next.x = THREE.MathUtils.clamp(next.x, -VEHICLE_WORLD_RADIUS, VEHICLE_WORLD_RADIUS)
    next.z = THREE.MathUtils.clamp(next.z, -VEHICLE_WORLD_RADIUS, VEHICLE_WORLD_RADIUS)
    collided = true
    triggerBoundaryImpact(Math.min(1, .42 + Math.abs(vehicle.speed) / 18))
  }
  const clearance = vehicle.config.width * .56
  collisionCircles.forEach((circle) => {
    const dx = next.x - circle.x
    const dz = next.z - circle.z
    const distance = Math.hypot(dx, dz)
    const minimum = circle.r + clearance
    if (distance < minimum) {
      const safe = Math.max(distance, .001)
      next.x = circle.x + dx / safe * minimum
      next.z = circle.z + dz / safe * minimum
      collided = true
    }
  })
  vehicles.forEach((other) => {
    if (other === vehicle || other.state === 'driver-exiting') return
    const dx = next.x - other.root.position.x
    const dz = next.z - other.root.position.z
    const distance = Math.hypot(dx, dz)
    const minimum = (vehicle.config.width + other.config.width) * .48
    if (distance < minimum) {
      const safe = Math.max(distance, .001)
      next.x = other.root.position.x + dx / safe * minimum
      next.z = other.root.position.z + dz / safe * minimum
      collided = true
    }
  })
  if (collided) registerVehicleImpact(vehicle, Math.min(1, Math.abs(vehicle.speed) / 10))
}

function updateDriverWalkers(dt, elapsed) {
  for (let index = driverWalkers.length - 1; index >= 0; index -= 1) {
    const walker = driverWalkers[index]
    walker.elapsed += dt
    walker.group.position.addScaledVector(walker.direction, dt * 1.65)
    const rig = walker.group.userData.rig
    if (rig) {
      const step = Math.sin(elapsed * 8.5 + walker.phase)
      rig.arms[0].rotation.x = step * .62
      rig.arms[1].rotation.x = -step * .62
      rig.legs[0].rotation.x = -step * .66
      rig.legs[1].rotation.x = step * .66
    }
    if (walker.elapsed > walker.duration) {
      world.remove(walker.group)
      driverWalkers.splice(index, 1)
    }
  }
}

function updateTrafficVehicles(dt) {
  trafficVehicles.forEach((vehicle) => {
    vehicle.collisionTimer = Math.max(0, vehicle.collisionTimer - dt)
    const distanceToPlayer = player.position.distanceTo(vehicle.root.position)
    if (vehicle.state === 'traffic') {
      const yieldingToPedestrian = !state.drivingVehicle && !state.pendingVehicle && player.visible && distanceToPlayer < 6.4
      const targetSpeed = yieldingToPedestrian ? 0 : vehicle.targetTrafficSpeed * vehicle.direction
      const response = yieldingToPedestrian ? 11.5 : 3.2
      vehicle.speed = moveToward(vehicle.speed, targetSpeed, response * dt)
      setVehicleBrakeLights(vehicle, yieldingToPedestrian)
    } else if (vehicle.state === 'yielding') {
      vehicle.speed = moveToward(vehicle.speed, 0, 12.5 * dt)
      setVehicleBrakeLights(vehicle, true)
      if (Math.abs(vehicle.speed) < .12) {
        vehicle.speed = 0
        vehicle.state = 'driver-exiting'
        vehicle.yieldTimer = 0
        spawnVehicleDriver(vehicle)
        pulseVehicleHaptic(.05, .24, 70)
      }
    } else if (vehicle.state === 'driver-exiting') {
      vehicle.yieldTimer += dt
      setVehicleBrakeLights(vehicle, true)
      if (vehicle.yieldTimer > 1.2) {
        vehicle.state = 'available'
        if (state.pendingVehicle === vehicle) enterVehicle(vehicle)
      }
    }

    if (vehicle.state === 'traffic' || vehicle.state === 'yielding') {
      vehicle.routeDistance += vehicle.speed * dt
      const sample = sampleTrafficLoop(vehicle.routeDistance)
      vehicle.root.position.copy(sample.position)
      const routeDirection = sample.direction.clone().multiplyScalar(vehicle.direction)
      const targetYaw = Math.atan2(-routeDirection.x, -routeDirection.z)
      const yawDelta = Math.atan2(Math.sin(targetYaw - vehicle.root.rotation.y), Math.cos(targetYaw - vehicle.root.rotation.y))
      vehicle.root.rotation.y += yawDelta * Math.min(1, dt * 5.8)
      vehicle.velocity.copy(routeDirection).multiplyScalar(Math.abs(vehicle.speed))
      vehicle.steeringInput = THREE.MathUtils.clamp(yawDelta * 1.8, -1, 1)
      updateVehicleWheels(vehicle, dt)
      vehicle.exhaust.material.emissiveIntensity = .18 + Math.min(1.1, Math.abs(vehicle.speed) * .055)
    }
  })
}

function updateDrivenVehicle(dt) {
  const vehicle = state.drivingVehicle
  if (!vehicle) return
  vehicle.collisionTimer = Math.max(0, vehicle.collisionTimer - dt)
  vehicle.hapticTimer = Math.max(0, vehicle.hapticTimer - dt)
  vehicle.smokeTimer = Math.max(0, vehicle.smokeTimer - dt)

  const keyboardSteer = (state.keys.has('KeyD') || state.keys.has('ArrowRight') ? 1 : 0) - (state.keys.has('KeyA') || state.keys.has('ArrowLeft') ? 1 : 0)
  // DualSense horizontal input is mirrored against the vehicle's yaw convention.
  // Invert only the controller axis; keyboard A/D already steers correctly.
  const rawAnalogSteer = THREE.MathUtils.clamp(-state.gamepadMove.x, -1, 1)
  const analogSteer = Math.sign(rawAnalogSteer) * Math.pow(Math.abs(rawAnalogSteer), 1.45)
  const steeringInput = Math.abs(keyboardSteer) > 0 ? keyboardSteer : analogSteer
  const rightTrigger = state.gamepadButtons[7]?.value || 0
  const leftTrigger = state.gamepadButtons[6]?.value || 0
  const handbrakeInput = state.keys.has('Space') || Boolean(state.gamepadButtons[2]?.pressed || state.gamepadButtons[2]?.value > .42)
  let throttleInput = Math.max(state.keys.has('KeyW') || state.keys.has('ArrowUp') ? 1 : 0, rightTrigger)
  let brakeInput = Math.max(state.keys.has('KeyS') || state.keys.has('ArrowDown') ? 1 : 0, leftTrigger)
  if (state.pendingExit) { throttleInput = 0; brakeInput = 1 }
  vehicle.throttleInput = throttleInput
  vehicle.brakeInput = brakeInput
  vehicle.handbrakeInput = handbrakeInput ? 1 : 0
  vehicle.steeringInput = THREE.MathUtils.lerp(vehicle.steeringInput, steeringInput, 1 - Math.exp(-dt * (handbrakeInput ? 8.5 : 6.2)))

  if (throttleInput > .03) {
    if (vehicle.speed < -.15) vehicle.speed = moveToward(vehicle.speed, 0, vehicle.config.brake * throttleInput * dt)
    else vehicle.speed = Math.min(vehicle.config.maxForward, vehicle.speed + vehicle.config.acceleration * throttleInput * dt)
  }
  if (brakeInput > .03) {
    if (vehicle.speed > .15) vehicle.speed = moveToward(vehicle.speed, 0, vehicle.config.brake * brakeInput * dt)
    else vehicle.speed = Math.max(-vehicle.config.maxReverse, vehicle.speed - vehicle.config.reverseAcceleration * brakeInput * dt)
  }
  if (throttleInput <= .03 && brakeInput <= .03) {
    const drag = vehicle.config.coastDrag + Math.abs(vehicle.speed) * Math.abs(vehicle.speed) * vehicle.config.aeroDrag
    vehicle.speed = moveToward(vehicle.speed, 0, drag * dt)
  }
  if (handbrakeInput && Math.abs(vehicle.speed) > 1.2) {
    vehicle.speed = moveToward(vehicle.speed, 0, (2.2 + Math.abs(vehicle.speed) * .08) * dt)
  }

  const speedRatio = THREE.MathUtils.clamp(Math.abs(vehicle.speed) / vehicle.config.maxForward, 0, 1)
  const driftIntensity = THREE.MathUtils.clamp(
    speedRatio * Math.abs(vehicle.steeringInput) * (.72 + brakeInput * .9),
    0,
    1,
  )
  if (handbrakeInput && Math.abs(vehicle.steeringInput) > .2 && Math.abs(vehicle.speed) > 3.2 && vehicle.smokeTimer <= 0) {
    emitDriftSmoke(vehicle, driftIntensity)
    vehicle.smokeTimer = brakeInput > .18 ? .034 : .052
  }
  const steeringAuthority = THREE.MathUtils.lerp(.9, .28, speedRatio) * (handbrakeInput ? 1.55 : 1)
  const rollingAuthority = THREE.MathUtils.clamp(Math.abs(vehicle.speed) / 2.2, .12, 1)
  const reverseDirection = vehicle.speed < 0 ? -1 : 1
  vehicle.root.rotation.y += vehicle.steeringInput * vehicle.config.steering * steeringAuthority * rollingAuthority * reverseDirection * dt

  const currentForward = vehicleForward(vehicle)
  vehicleDesiredVelocity.copy(currentForward).multiplyScalar(vehicle.speed)
  if (vehicle.velocity.lengthSq() < .001) vehicle.velocity.copy(vehicleDesiredVelocity)
  const slipLoss = Math.abs(vehicle.steeringInput) * speedRatio * .52
  const grip = handbrakeInput && speedRatio > .12 ? 1.45 : vehicle.config.grip * (1 - slipLoss)
  vehicle.velocity.lerp(vehicleDesiredVelocity, 1 - Math.exp(-Math.max(2.4, grip) * dt))
  vehicleNextPosition.copy(vehicle.root.position).addScaledVector(vehicle.velocity, dt)
  resolveVehicleCollision(vehicle, vehicleNextPosition)
  vehicle.root.position.copy(vehicleNextPosition)
  vehicle.root.position.y = .52

  updateVehicleWheels(vehicle, dt)
  setVehicleBrakeLights(vehicle, brakeInput > .08 || handbrakeInput || state.pendingExit)
  vehicle.exhaust.material.emissiveIntensity = .18 + throttleInput * 1.6 + speedRatio * .55
  const visualLean = vehicle.config.kind === 'MOTORBIKE' ? .24 : .055
  vehicle.visualRoot.rotation.z = THREE.MathUtils.lerp(vehicle.visualRoot.rotation.z, -vehicle.steeringInput * speedRatio * visualLean, 1 - Math.exp(-dt * (vehicle.config.kind === 'MOTORBIKE' ? 8.5 : 6)))
  vehicle.visualRoot.rotation.x = THREE.MathUtils.lerp(vehicle.visualRoot.rotation.x, (brakeInput - throttleInput) * .032, 1 - Math.exp(-dt * 7))
  vehicle.visualRoot.position.y = THREE.MathUtils.lerp(vehicle.visualRoot.position.y, 0, 1 - Math.exp(-dt * 8))

  const cameraInput = Math.hypot(state.gamepadCamera.x, state.gamepadCamera.y)
  if (cameraInput > .035) state.vehicleCameraInputTimer = 1.25
  else state.vehicleCameraInputTimer = Math.max(0, state.vehicleCameraInputTimer - dt)
  state.vehicleCameraYawOffset -= state.gamepadCamera.x * dt * 2.25
  state.vehicleCameraPitch = THREE.MathUtils.clamp(state.vehicleCameraPitch + state.gamepadCamera.y * dt * 1.3, -.34, .38)
  if (state.vehicleCameraInputTimer <= 0) state.vehicleCameraYawOffset = THREE.MathUtils.lerp(state.vehicleCameraYawOffset, 0, 1 - Math.exp(-dt * 2.2))

  if (vehicle.hapticTimer <= 0 && throttleInput > .7 && speedRatio > .52) {
    pulseVehicleHaptic(.035 + speedRatio * .035, .12 + speedRatio * .12, 54)
    vehicle.hapticTimer = .72
  }
  if (vehicle.hapticTimer <= 0 && Math.abs(vehicle.steeringInput) > .78 && speedRatio > .68) {
    pulseVehicleHaptic(.08, .24, 74)
    vehicle.hapticTimer = .46
  }
  if (vehicle.hapticTimer <= 0 && handbrakeInput && speedRatio > .18) {
    pulseVehicleHaptic(.12 + speedRatio * .08, .38 + speedRatio * .18, 72)
    vehicle.hapticTimer = .24
  }

  player.position.copy(vehicle.root.position)
  player.position.y = .52
  state.nearLocation = null
  state.nearVehicle = null
  interactionPrompt.classList.remove('is-visible')
  updateVehicleHud(vehicle)
  if (state.pendingExit && Math.abs(vehicle.speed) <= .8) exitVehicle()
}

function updatePlayer(dt,elapsed) {
  const keyX=(state.keys.has('KeyD')||state.keys.has('ArrowRight')?1:0)-(state.keys.has('KeyA')||state.keys.has('ArrowLeft')?1:0)
  const keyY=(state.keys.has('KeyW')||state.keys.has('ArrowUp')?1:0)-(state.keys.has('KeyS')||state.keys.has('ArrowDown')?1:0)
  const inputX=Math.abs(keyX)>0?keyX:state.gamepadMove.x
  const inputY=Math.abs(keyY)>0?keyY:-state.gamepadMove.y
  const magnitude=state.pendingVehicle ? 0 : Math.min(1,Math.hypot(inputX,inputY))
  const cameraInput=Math.hypot(state.gamepadCamera.x,state.gamepadCamera.y)
  if(cameraInput>.035) state.cameraInputTimer=1.45
  else state.cameraInputTimer=Math.max(0,state.cameraInputTimer-dt)
  state.cameraYawTarget-=state.gamepadCamera.x*dt*2.35
  state.cameraPitchTarget=THREE.MathUtils.clamp(state.cameraPitchTarget+state.gamepadCamera.y*dt*1.55,-.62,.92)
  forward.set(-Math.sin(state.cameraYaw),0,-Math.cos(state.cameraYaw)); right.set(Math.cos(state.cameraYaw),0,-Math.sin(state.cameraYaw))
  desiredMove.copy(forward).multiplyScalar(inputY).addScaledVector(right,inputX)
  if (desiredMove.lengthSq()>1) desiredMove.normalize()
  if (state.pendingVehicle) desiredMove.set(0, 0, 0)
  const rightTrigger = state.gamepadButtons[7]
  const sprint=state.keys.has('ShiftLeft')||state.keys.has('ShiftRight')||Boolean(rightTrigger?.pressed||rightTrigger?.value>.25)
  state.moveMagnitude=magnitude
  state.sprinting=sprint&&magnitude>.06
  const speed=sprint?SPRINT_SPEED:WALK_SPEED
  nextPosition.copy(player.position).addScaledVector(desiredMove,speed*dt); resolveCollision(nextPosition); player.position.x=nextPosition.x; player.position.z=nextPosition.z
  if (!state.grounded) {
    state.jumpElapsed += dt
    state.jumpVelocity-=JUMP_GRAVITY*dt; state.jumpOffset+=state.jumpVelocity*dt
    if (avatarActions?.jump) {
      const progress = THREE.MathUtils.clamp(state.jumpElapsed / JUMP_AIR_TIME, 0, 1)
      const eased = progress * progress * (3 - 2 * progress)
      avatarActions.jump.time = avatarActions.jump.getClip().duration * (.04 + eased * .92)
    }
    if (state.jumpOffset<=0) { state.jumpOffset=0; state.jumpVelocity=0; state.jumpElapsed=0; state.grounded=true; playRumble(state.activeGamepad,'select').catch(()=>{}) }
  }
  const rig=player.userData.rig
  let bob=0,step=0
  if (magnitude>.06) {
    const targetAngle=Math.atan2(-desiredMove.x,-desiredMove.z); let delta=targetAngle-player.rotation.y; delta=Math.atan2(Math.sin(delta),Math.cos(delta)); player.rotation.y+=delta*Math.min(1,dt*12)
    if(state.cameraInputTimer<=0){const followDelta=Math.atan2(Math.sin(player.rotation.y-state.cameraYawTarget),Math.cos(player.rotation.y-state.cameraYawTarget));state.cameraYawTarget+=followDelta*Math.min(1,dt*1.25)}
    step=Math.sin(elapsed*(sprint?14:9.5)); if (!avatarReady) bob=Math.abs(Math.sin(elapsed*(sprint?14:9.5)))*.028
  }
  player.position.y=.52+state.jumpOffset+bob
  if (rig) {
    rig.arms[0].rotation.x=step*.62*magnitude; rig.arms[1].rotation.x=-step*.62*magnitude
    rig.legs[0].rotation.x=-step*.68*magnitude; rig.legs[1].rotation.x=step*.68*magnitude
    rig.hips.rotation.x=THREE.MathUtils.lerp(rig.hips.rotation.x,sprint&&magnitude>.1?-.12:0,dt*8)
    rig.head.rotation.y=Math.sin(elapsed*.75)*.06
  }
  setAvatarAction(!state.grounded ? 'jump' : magnitude>.06 ? (sprint ? 'run' : 'walk') : 'idle')
  if (avatarActions?.walk && activeAvatarAction === 'walk') avatarActions.walk.setEffectiveTimeScale(1.25 + magnitude * .75)
  state.nearLocation=interactables.map((location)=>({location,distance:player.position.distanceTo(location.position)})).filter(({distance})=>distance<=4.35).sort((a,b)=>a.distance-b.distance)[0]?.location||null
  state.nearVehicle = vehicles
    .filter((vehicle) => vehicle.state === 'available' || vehicle.state === 'traffic')
    .map((vehicle) => ({ vehicle, distance: player.position.distanceTo(vehicle.root.position) }))
    .filter(({ distance }) => distance <= VEHICLE_INTERACT_RADIUS)
    .sort((a, b) => a.distance - b.distance)[0]?.vehicle || null
  const showInteraction = state.started && !state.modalOpen && Boolean(state.pendingVehicle || state.nearVehicle || state.nearLocation)
  interactionPrompt.classList.toggle('is-visible', showInteraction)
  if (state.pendingVehicle) $('#interaction-title').textContent = `${state.pendingVehicle.config.label} preparing for you…`
  else if (state.nearVehicle) $('#interaction-title').textContent = state.nearVehicle.state === 'traffic' ? `Signal ${state.nearVehicle.config.label} to stop` : `Drive ${state.nearVehicle.config.label}`
  else if (state.nearLocation) $('#interaction-title').textContent=state.nearLocation.title
  saveTimer+=dt
  if (saveTimer>4 && magnitude>.04) {
    saveTimer=0; localStorage.setItem('upgradverse-checkpoint',JSON.stringify({x:+player.position.x.toFixed(2),z:+player.position.z.toFixed(2),yaw:+state.cameraYaw.toFixed(4)}))
    savePill.classList.add('is-visible'); clearTimeout(state.lastSave); state.lastSave=setTimeout(()=>savePill.classList.remove('is-visible'),900)
  }
}

function updateVehicleCamera(dt) {
  const vehicle = state.drivingVehicle
  const cameraMode = VEHICLE_CAMERAS[state.vehicleCameraMode]
  const yaw = vehicle.root.rotation.y + state.vehicleCameraYawOffset
  const speedRatio = THREE.MathUtils.clamp(Math.abs(vehicle.speed) / vehicle.config.maxForward, 0, 1)
  const lookAhead = vehicleForward(vehicle, vehicleLookTarget).multiplyScalar(1.4 + speedRatio * 3.5)

  if (state.vehicleCameraMode === 2) {
    vehicleCameraPosition.set(-vehicle.config.width * .19, vehicle.config.wheelRadius + vehicle.config.height * .55, -vehicle.config.length * .08)
    vehicle.root.localToWorld(vehicleCameraPosition)
    const horizontal = Math.cos(state.vehicleCameraPitch)
    vehicleLookTarget.set(
      -Math.sin(yaw) * horizontal,
      -Math.sin(state.vehicleCameraPitch),
      -Math.cos(yaw) * horizontal,
    ).multiplyScalar(18).add(vehicleCameraPosition)
    camera.position.lerp(vehicleCameraPosition, 1 - Math.exp(-dt * 16))
    camera.lookAt(vehicleLookTarget)
  } else {
    vehicleCameraTarget.copy(vehicle.root.position)
    vehicleCameraTarget.y += cameraMode.targetHeight
    vehicleCameraTarget.add(lookAhead)
    const distance = cameraMode.distance + speedRatio * (state.vehicleCameraMode === 0 ? 1.8 : .75)
    const horizontal = Math.cos(state.vehicleCameraPitch) * distance
    vehicleCameraPosition.set(
      vehicle.root.position.x + Math.sin(yaw) * horizontal,
      vehicle.root.position.y + cameraMode.height + Math.sin(state.vehicleCameraPitch) * distance,
      vehicle.root.position.z + Math.cos(yaw) * horizontal,
    )

    const rayX = vehicleCameraPosition.x - vehicleCameraTarget.x
    const rayZ = vehicleCameraPosition.z - vehicleCameraTarget.z
    let cameraTravel = 1
    for (const circle of collisionCircles) {
      const offsetX = vehicleCameraTarget.x - circle.x
      const offsetZ = vehicleCameraTarget.z - circle.z
      const a = rayX * rayX + rayZ * rayZ
      const b = 2 * (offsetX * rayX + offsetZ * rayZ)
      const c = offsetX * offsetX + offsetZ * offsetZ - (circle.r + .45) ** 2
      const discriminant = b * b - 4 * a * c
      if (discriminant <= 0 || a < .0001) continue
      const hit = (-b - Math.sqrt(discriminant)) / (2 * a)
      if (hit > .08 && hit < cameraTravel) cameraTravel = Math.max(.2, hit - .04)
    }
    if (cameraTravel < 1) vehicleCameraPosition.lerpVectors(vehicleCameraTarget, vehicleCameraPosition, cameraTravel)
    camera.position.lerp(vehicleCameraPosition, 1 - Math.exp(-dt * 8.5))
    camera.lookAt(vehicleCameraTarget)
  }

  const targetFov = cameraMode.fov + (state.vehicleCameraMode === 0 ? speedRatio * 4.5 : speedRatio * 2)
  const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 6))
  if (Math.abs(nextFov - camera.fov) > .01) { camera.fov = nextFov; camera.updateProjectionMatrix() }
}

function updateCamera(dt) {
  if (arenaGame.isOpen()) { arenaGame.updateCamera(camera, dt); return }
  if (state.drivingVehicle) { updateVehicleCamera(dt); return }
  const ease=1-Math.exp(-dt*10.5)
  const yawDelta=Math.atan2(Math.sin(state.cameraYawTarget-state.cameraYaw),Math.cos(state.cameraYawTarget-state.cameraYaw))
  state.cameraYaw+=yawDelta*ease; state.cameraPitch=THREE.MathUtils.lerp(state.cameraPitch,state.cameraPitchTarget,ease); state.cameraDistance=THREE.MathUtils.lerp(state.cameraDistance,state.cameraDistanceTarget,ease)
  const sprintPullback=state.sprinting ? .72 : 0
  const orbitDistance=state.cameraDistance+sprintPullback
  const horizontal=Math.cos(state.cameraPitch)*orbitDistance,vertical=Math.sin(state.cameraPitch)*orbitDistance
  const shoulderX=Math.cos(state.cameraYaw)*.28,shoulderZ=-Math.sin(state.cameraYaw)*.28
  cameraTarget.set(player.position.x+shoulderX,player.position.y+1.34,player.position.z+shoulderZ)
  desiredCamera.set(cameraTarget.x+Math.sin(state.cameraYaw)*horizontal,Math.max(.72,cameraTarget.y+1.55+vertical),cameraTarget.z+Math.cos(state.cameraYaw)*horizontal)

  const rayX=desiredCamera.x-cameraTarget.x,rayZ=desiredCamera.z-cameraTarget.z
  let cameraTravel=1
  for(const circle of collisionCircles){
    const offsetX=cameraTarget.x-circle.x,offsetZ=cameraTarget.z-circle.z
    const a=rayX*rayX+rayZ*rayZ,b=2*(offsetX*rayX+offsetZ*rayZ),c=offsetX*offsetX+offsetZ*offsetZ-(circle.r+.32)**2
    const discriminant=b*b-4*a*c
    if(discriminant<=0||a<.0001)continue
    const hit=(-b-Math.sqrt(discriminant))/(2*a)
    if(hit>.08&&hit<cameraTravel)cameraTravel=Math.max(.18,hit-.035)
  }
  if(cameraTravel<1)desiredCamera.lerpVectors(cameraTarget,desiredCamera,cameraTravel)

  const targetFov=state.sprinting?CAMERA_FOV_SPRINT:CAMERA_FOV
  const nextFov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-dt*5.5))
  if(Math.abs(nextFov-camera.fov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix()}
  camera.position.lerp(desiredCamera,1-Math.exp(-dt*8.5)); camera.lookAt(cameraTarget)
}

function animate() {
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.05),elapsed=clock.elapsedTime
  if (state.started&&!state.paused) {
    if (state.drivingVehicle) updateDrivenVehicle(dt)
    else updatePlayer(dt,elapsed)
    updateTrafficVehicles(dt)
    updateDriverWalkers(dt, elapsed)
    updateDriftSmoke(dt)
    updateRiggedCitizens(dt, elapsed)
  }
  if (avatarMixer&&state.started&&!state.paused) avatarMixer.update(dt)
  updateSimulationBoundary(dt, elapsed)
  updateCamera(dt); updateNpcs(elapsed)
  cityMist.forEach((mist,index)=>{
    mist.position.x+=mist.userData.speed*dt
    mist.position.z+=Math.sin(elapsed*.08+mist.userData.phase)*dt*.07
    if(mist.position.x>68)mist.position.x=-68
    mist.material.opacity=.08+(Math.sin(elapsed*.22+index)*.5+.5)*.1
  })
  cityUpgrade.update(dt, elapsed, player.position, state.started && !state.paused)
  transportUpgrade.update(dt, elapsed)
  atmosphereUpgrade.update(elapsed, dt)
  arenaGame.update(dt)
  const drivenVehicle=state.drivingVehicle
  const drivenSpeedRatio=drivenVehicle?THREE.MathUtils.clamp(Math.abs(drivenVehicle.speed)/drivenVehicle.config.maxForward,0,1):0
  const drivenDrift=drivenVehicle?THREE.MathUtils.clamp(drivenSpeedRatio*Math.abs(drivenVehicle.steeringInput)*(drivenVehicle.handbrakeInput?.72:.28),0,1):0
  audio.update({
    driving:Boolean(drivenVehicle),
    vehicleType:drivenVehicle?.classId||drivenVehicle?.config.kind||'sedan',
    speedRatio:drivenSpeedRatio,
    speed:drivenVehicle?.speed||0,
    throttle:drivenVehicle?.throttleInput||0,
    brake:drivenVehicle?.brakeInput||0,
    handbrake:Boolean(drivenVehicle?.handbrakeInput),
    steering:drivenVehicle?.steeringInput||0,
    driftIntensity:drivenDrift,
  })
  playerShadow.position.x=player.position.x;playerShadow.position.z=player.position.z;playerShadow.scale.setScalar(1-Math.min(state.jumpOffset/1.8,.34))
  const chatgptPulse = .96 + Math.sin(elapsed * 2.1) * .045
  chatgptBuilding.userData.core.scale.setScalar(chatgptPulse)
  chatgptBuilding.userData.core.rotation.y = elapsed * .28
  chatgptBuilding.userData.coreWire.rotation.set(elapsed * .12, -elapsed * .2, elapsed * .08)
  chatgptBuilding.userData.rings.forEach((ring, index) => { ring.rotation.y += dt * (.11 + index * .035) * (index % 2 ? -1 : 1) })
  chatgptBuilding.userData.nodes.forEach((node, index) => { node.position.y = node.userData.baseY + Math.sin(elapsed * (1.25 + index * .18) + index) * .22 })
  chatgptBuilding.userData.portalRing.rotation.z = elapsed * .18
  chatgptBuilding.userData.portalCore.rotation.z = -elapsed * .42
  claudeBuilding.userData.core.rotation.y = -elapsed * .34
  claudeBuilding.userData.coreFrame.rotation.set(elapsed * .1, elapsed * .19, -elapsed * .08)
  claudeBuilding.userData.rings.forEach((ring, index) => { ring.rotation.y += dt * (.09 + index * .05) * (index ? -1 : 1) })
  claudeBuilding.userData.pages.forEach((page, index) => {
    page.position.y = page.userData.baseY + Math.sin(elapsed * 1.4 + index * .8) * .22
    page.rotation.z += dt * .035 * (index % 2 ? -1 : 1)
  })
  claudeBuilding.userData.portalGlyph.rotation.z = elapsed * .22
  humanBuilding.rotation.y=Math.sin(elapsed*.18+1)*.003
  waypoint.userData.diamond.rotation.y=elapsed*1.35;waypoint.userData.diamond.position.y=5.5+Math.sin(elapsed*2.4)*.18;waypoint.userData.ring.scale.setScalar(1+Math.sin(elapsed*2.1)*.08)
  distantStars.rotation.y=elapsed*.0025;galaxyStars.rotation.y=elapsed*.0018
  updateLabel('upgrad',labelAnchors.upgrad);updateLabel('chatgpt',labelAnchors.chatgpt);updateLabel('human',labelAnchors.human);updateLabel('claude',labelAnchors.claude);updateLabel('arena',labelAnchors.arena);updateObjectiveVisuals()
  renderer.render(scene,camera)
  fpsFrames+=1;fpsElapsed+=dt
  if(fpsElapsed>=1){$('#performance-pill').textContent=`${Math.round(fpsFrames/fpsElapsed)} FPS · LIVE CITY`;fpsFrames=0;fpsElapsed=0}
}

const adapter = new GamepadAdapter({
  onConnection(gamepad){
    state.activeGamepad=gamepad
    const phone=Boolean(gamepad?.id?.includes('Phone Controller'))
    controllerState.classList.toggle('is-connected',Boolean(gamepad))
    controllerState.querySelector('span').textContent=phone?'PHONE LINK READY':gamepad?'GAMEPAD CONNECTED':'KEYBOARD READY'
  },
  onSnapshot(snapshot){state.gamepadMove=snapshot.move;state.gamepadCamera=snapshot.camera;state.gamepadButtons=snapshot.buttons},
  onAction(event){
    if(upgradSkillShop.isOpen()){upgradSkillShop.handleGamepad(event);return}
    if(skillShop.isOpen()){skillShop.handleGamepad(event);return}
    if(claudeSkillShop.isOpen()){claudeSkillShop.handleGamepad(event);return}
    if(arenaGame.isOpen()){arenaGame.handleGamepad(event);return}
    if(!state.started && [12,14].includes(event.index)){selectRelativeCharacter(-1);return}
    if(!state.started && [13,15].includes(event.index)){selectRelativeCharacter(1);return}
    if(event.index===0){if(!state.started)$('#enter-world').click();else if(state.modalOpen)$('#modal-primary').click();else triggerJump()}
    if(event.index===3&&state.started){if(state.modalOpen)$('#modal-primary').click();else tryInteract()}
    if(event.index===1&&state.modalOpen)closeLocation()
    if(event.index===9&&state.started&&!state.modalOpen)setPaused(!state.paused)
    if(event.index===11){
      if(state.drivingVehicle)cycleVehicleCamera()
      else{state.cameraYaw=player.rotation.y;state.cameraPitch=CAMERA_PITCH;state.cameraYawTarget=player.rotation.y;state.cameraPitchTarget=CAMERA_PITCH}
    }
  },
})
adapter.start()

window.addEventListener('keydown',(event)=>{
  if(event.code==='KeyM'){audio.toggle().catch(()=>{});event.preventDefault();return}
  if(!state.started && !document.querySelector('#entry-screen')?.classList.contains('is-hidden')){
    if(['ArrowLeft','ArrowUp'].includes(event.code)){selectRelativeCharacter(-1);event.preventDefault();return}
    if(['ArrowRight','ArrowDown'].includes(event.code)){selectRelativeCharacter(1);event.preventDefault();return}
  }
  if(upgradSkillShop.isOpen()){upgradSkillShop.handleKey(event);return}
  if(skillShop.isOpen()){skillShop.handleKey(event);return}
  if(claudeSkillShop.isOpen()){claudeSkillShop.handleKey(event);return}
  if(arenaGame.isOpen()){arenaGame.handleKey(event);return}
  state.keys.add(event.code)
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault()
  if(event.code==='Space'&&!state.drivingVehicle)triggerJump()
  if(event.code==='KeyE'||event.code==='Enter'){if(!state.started)$('#enter-world').click();else if(state.modalOpen)$('#modal-primary').click();else tryInteract()}
  if(event.code==='Escape'&&state.modalOpen)closeLocation()
  if(event.code==='KeyP'&&state.started&&!state.modalOpen)setPaused(!state.paused)
  if(event.code==='KeyV'&&state.started&&state.drivingVehicle&&!event.repeat)cycleVehicleCamera()
  if(event.code==='KeyI'){state.cameraPitchTarget=THREE.MathUtils.clamp(state.cameraPitchTarget-.14,-.62,.92);state.cameraInputTimer=1.45}
  if(event.code==='KeyK'){state.cameraPitchTarget=THREE.MathUtils.clamp(state.cameraPitchTarget+.14,-.62,.92);state.cameraInputTimer=1.45}
  if(event.code==='KeyJ'){state.cameraYawTarget+=.16;state.cameraInputTimer=1.45}if(event.code==='KeyL'){state.cameraYawTarget-=.16;state.cameraInputTimer=1.45}
  if(event.code==='KeyF'){
    if(state.drivingVehicle){state.vehicleCameraYawOffset=0;state.vehicleCameraPitch=state.vehicleCameraMode===2?-.015:-.03;state.vehicleCameraInputTimer=0}
    else{state.cameraYaw=player.rotation.y;state.cameraPitch=CAMERA_PITCH;state.cameraYawTarget=player.rotation.y;state.cameraPitchTarget=CAMERA_PITCH}
  }
})
window.addEventListener('keyup',(event)=>{
  if(arenaGame.isOpen()){arenaGame.handleKey(event);return}
  state.keys.delete(event.code)
})
renderer.domElement.addEventListener('pointerdown',(event)=>{state.pointerDown=true;state.pointerX=event.clientX;state.pointerY=event.clientY;renderer.domElement.setPointerCapture(event.pointerId)})
renderer.domElement.addEventListener('pointermove',(event)=>{
  if(!state.pointerDown||state.paused)return
  const deltaX=event.clientX-state.pointerX,deltaY=event.clientY-state.pointerY
  if(state.drivingVehicle){state.vehicleCameraYawOffset-=deltaX*.0048;state.vehicleCameraPitch=THREE.MathUtils.clamp(state.vehicleCameraPitch+deltaY*.0035,-.34,.38);state.vehicleCameraInputTimer=1.5}
  else{state.cameraYawTarget-=deltaX*.0048;state.cameraPitchTarget=THREE.MathUtils.clamp(state.cameraPitchTarget+deltaY*.0038,-.62,.92);state.cameraInputTimer=1.6}
  state.pointerX=event.clientX;state.pointerY=event.clientY
})
renderer.domElement.addEventListener('pointerup',()=>{state.pointerDown=false})
renderer.domElement.addEventListener('wheel',(event)=>{if(state.drivingVehicle)return;state.cameraDistanceTarget=THREE.MathUtils.clamp(state.cameraDistanceTarget+event.deltaY*.008,6.4,13.2);state.cameraInputTimer=1.2},{passive:true})

audioState.addEventListener('click',()=>audio.toggle().catch(()=>{}))
$('#enter-world').addEventListener('click',()=>{state.started=true;audio.start().catch(()=>{});cityUpgrade.startAudio().catch(()=>{});$('#entry-screen').classList.add('is-hidden');characterPreviewRenderer.setAnimationLoop(null);renderer.domElement.focus({preventScroll:true});playRumble(state.activeGamepad,'success').catch(()=>{})})
navigationToggle.addEventListener('click',()=>{
  const open=navigationPanel.classList.toggle('is-open')
  navigationToggle.setAttribute('aria-expanded',String(open))
  playRumble(state.activeGamepad,'select').catch(()=>{})
})
$('#modal-close').addEventListener('click',closeLocation)
$('#modal-primary').addEventListener('click',()=>{
  if(state.modalLocationId==='upgrad')launchUpgradSkillShop()
  else if(state.modalLocationId==='chatgpt')launchChatGPTSkillShop()
  else if(state.modalLocationId==='claude')launchClaudeSkillShop()
  else if(state.modalLocationId==='arena')launchVerseArena()
  else{
    closeLocation();playRumble(state.activeGamepad,'success').catch(()=>{})
  }
})
document.querySelectorAll('[data-focus]').forEach((button)=>button.addEventListener('click',()=>{
  const target=interactables.find((entry)=>entry.id===button.dataset.focus);if(!target)return;state.objectiveId=target.id;document.querySelectorAll('[data-focus]').forEach((item)=>item.classList.toggle('is-active',item===button));navigationPanel.classList.remove('is-open');navigationToggle.setAttribute('aria-expanded','false');playRumble(state.activeGamepad,'select').catch(()=>{})
}))
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight)})
window.addEventListener('beforeunload',()=>adapter.stop())

const skillShopPreview = new URLSearchParams(window.location.search).get('skillshop')
const cityPreview = new URLSearchParams(window.location.search).get('city')
if(cityPreview==='arena'){
  state.started=true
  state.objectiveId='arena'
  $('#entry-screen').classList.add('is-hidden')
  player.position.set(23, .52, 34)
  player.rotation.y=Math.PI
  state.cameraYaw=Math.PI
  state.cameraYawTarget=Math.PI
  document.querySelectorAll('[data-focus]').forEach((item)=>item.classList.toggle('is-active',item.dataset.focus==='arena'))
}else if(cityPreview==='preview'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  player.position.set(0, .52, 34)
  player.rotation.y=0
  state.cameraYaw=0
  state.cameraYawTarget=0
}else if(cityPreview==='bike'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  player.position.set(-9.4, .52, 34.8)
  player.rotation.y=Math.PI
  state.cameraYaw=Math.PI
  state.cameraYawTarget=Math.PI
}else if(skillShopPreview==='preview'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  launchChatGPTSkillShop()
}else if(skillShopPreview==='upgrad'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  launchUpgradSkillShop()
}else if(skillShopPreview==='entrance'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  player.position.set(CITY.chatgpt.x, .52, CITY.chatgpt.z + 13)
  player.rotation.y=0
  state.cameraYaw=0
  state.cameraYawTarget=0
}else if(skillShopPreview==='claude'){
  state.started=true
  state.objectiveId='claude'
  $('#entry-screen').classList.add('is-hidden')
  player.position.set(CITY.claude.x, .52, CITY.claude.z - 12)
  player.rotation.y=Math.PI
  state.cameraYaw=Math.PI
  state.cameraYawTarget=Math.PI
  document.querySelectorAll('[data-focus]').forEach((item)=>item.classList.toggle('is-active',item.dataset.focus==='claude'))
}else if(skillShopPreview==='claude-lab'){
  state.started=true
  $('#entry-screen').classList.add('is-hidden')
  launchClaudeSkillShop()
}

updateCamera(1)
animate()
