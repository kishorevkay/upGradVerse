import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

const VEHICLE_ASSETS = Object.freeze({
  supercar: '/assets/vehicles/third-party/sports-car-a.glb',
  suv: '/assets/vehicles/third-party/suv.glb',
  sedan: '/assets/vehicles/third-party/sports-car-b.glb',
  ev: '/assets/vehicles/third-party/sports-car-b.glb',
  bike: '/assets/vehicles/third-party/suzuki-sv650.glb',
})

const DEFAULT_HERO_ASSET = '/assets/characters/kish_3d_avatar.glb'
const tempPosition = new THREE.Vector3()
const tempAhead = new THREE.Vector3()
const tempTangent = new THREE.Vector3()
const tempScale = new THREE.Vector3()
const tempQuaternion = new THREE.Quaternion()
const tempMatrix = new THREE.Matrix4()

function configureModel(root, renderer, { shadows = true, brighten = false } = {}) {
  const anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1
  root.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = shadows
    child.receiveShadow = shadows
    child.frustumCulled = true
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    child.material = materials.map((source) => {
      const material = source?.clone ? source.clone() : source
      if (!material) return material
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace
        material.map.anisotropy = anisotropy
      }
      material.roughness = Math.min(.76, Math.max(.24, material.roughness ?? .56))
      material.metalness = Math.min(.82, Math.max(.08, material.metalness ?? .24))
      if (brighten && material.color) material.color.offsetHSL(0, .025, .035)
      material.needsUpdate = true
      return material
    })
    if (child.material.length === 1) child.material = child.material[0]
  })
}

function fitModel(model, target, renderer, { floor = .02, shadows = true } = {}) {
  configureModel(model, renderer, { shadows, brighten: true })
  model.updateMatrixWorld(true)
  let bounds = new THREE.Box3().setFromObject(model)
  let size = bounds.getSize(new THREE.Vector3())

  // All world vehicles travel down local -Z. Rotate side-on source models once.
  if (size.x > size.z) {
    model.rotation.y += Math.PI / 2
    model.updateMatrixWorld(true)
    bounds = new THREE.Box3().setFromObject(model)
    size = bounds.getSize(new THREE.Vector3())
  }

  const scale = Math.min(
    target.x / Math.max(size.x, .001),
    target.y / Math.max(size.y, .001),
    target.z / Math.max(size.z, .001),
  )
  model.scale.multiplyScalar(scale)
  model.updateMatrixWorld(true)
  bounds = new THREE.Box3().setFromObject(model)
  const center = bounds.getCenter(new THREE.Vector3())
  model.position.set(-center.x, floor - bounds.min.y, -center.z)
  model.updateMatrixWorld(true)
  return model
}

function makeGlowStrip(color, width, depth) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(width, .035, depth),
    new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: .9 }),
  )
  strip.position.y = .08
  return strip
}

function addVehicleLightKit(vehicle) {
  if (vehicle.visualRoot.userData.transportLightKit) return
  const kit = new THREE.Group()
  kit.name = 'Transport underglow kit'
  kit.userData.transportLightKit = true
  const color = vehicle.config.kind === 'MOTORBIKE' ? 0xff3155 : vehicle.classId === 'suv' ? 0xffb05a : 0x48ddff
  const strip = makeGlowStrip(color, vehicle.config.width * .7, vehicle.config.length * .58)
  strip.position.y = .04
  kit.add(strip)
  vehicle.visualRoot.add(kit)
  vehicle.visualRoot.userData.transportLightKit = kit
}

function removeCompetingBodies(vehicle, keep) {
  const root = vehicle.visualRoot
  if (!root) return
  for (const child of [...root.children]) {
    if (child === vehicle.proxyBody || child === keep) continue
    if (child.userData?.transportLightKit || child.userData?.transportRider) continue
    if (child.userData?.transportVehicleBody || /(?:licensed\s+)?GLB body/i.test(child.name || '')) root.remove(child)
  }
  if (vehicle.proxyBody) vehicle.proxyBody.visible = false
  vehicle.wheels?.forEach(({ steeringPivot }) => { steeringPivot.visible = false })
}

function attachVehicleBodies(vehicles, sources, renderer) {
  const attached = []
  for (const vehicle of vehicles) {
    const source = sources[vehicle.classId]
    if (!source?.scene || !vehicle?.visualRoot || !vehicle?.config) continue
    const model = source.scene.clone(true)
    model.name = `${vehicle.config.label || vehicle.classId} transport GLB body`
    model.userData.transportVehicleBody = true
    fitModel(model, {
      x: vehicle.config.width * .99,
      y: vehicle.config.height * (vehicle.config.kind === 'MOTORBIKE' ? 1.02 : 1.08),
      z: vehicle.config.length * .99,
    }, renderer, {
      floor: vehicle.config.kind === 'MOTORBIKE' ? .055 : .018,
      shadows: !vehicle.traffic,
    })
    removeCompetingBodies(vehicle, model)
    vehicle.visualRoot.add(model)
    vehicle.model = model
    vehicle.userData ||= {}
    vehicle.userData.transportBody = model
    addVehicleLightKit(vehicle)
    attached.push(vehicle)
  }
  return attached
}

function poseRider(model) {
  const bones = new Map()
  model.traverse((node) => {
    if (node.isBone || /^(?:Pelvis|Waist|Spine|L_|R_)/.test(node.name || '')) bones.set(node.name, node)
  })
  const rotate = (name, x = 0, y = 0, z = 0) => {
    const bone = bones.get(name)
    if (!bone) return
    bone.rotation.x += x
    bone.rotation.y += y
    bone.rotation.z += z
  }

  rotate('Pelvis', -.12)
  rotate('Waist', .18)
  rotate('Spine01', .18)
  rotate('Spine02', .16)
  rotate('L_Thigh', -1.08, 0, -.08)
  rotate('R_Thigh', -1.08, 0, .08)
  rotate('L_Calf', 1.46)
  rotate('R_Calf', 1.46)
  rotate('L_Foot', -.32)
  rotate('R_Foot', -.32)
  rotate('L_Clavicle', 0, 0, -.15)
  rotate('R_Clavicle', 0, 0, .15)
  rotate('L_Upperarm', -1.06, -.08, -.42)
  rotate('R_Upperarm', -1.06, .08, .42)
  rotate('L_Forearm', -1.05, 0, -.2)
  rotate('R_Forearm', -1.05, 0, .2)
  rotate('L_Hand', -.18)
  rotate('R_Hand', -.18)
  model.updateMatrixWorld(true)
}

function makeRider(source, renderer) {
  const rider = new THREE.Group()
  rider.name = 'Mounted hero rider'
  rider.userData.transportRider = true
  rider.visible = false

  const facingRoot = new THREE.Group()
  facingRoot.rotation.y = Math.PI
  const model = cloneSkeleton(source.scene)
  configureModel(model, renderer, { shadows: true })
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())
  model.scale.setScalar(1.72 / Math.max(size.y, .001))
  model.updateMatrixWorld(true)
  const scaledBounds = new THREE.Box3().setFromObject(model)
  const center = scaledBounds.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -scaledBounds.min.y - .55, -center.z)
  poseRider(model)
  facingRoot.add(model)
  rider.add(facingRoot)
  return rider
}

function createFlyingCraft(source, renderer, index) {
  const craft = new THREE.Group()
  craft.name = `Aerial lane vehicle ${index + 1}`
  const body = source?.scene ? source.scene.clone(true) : new THREE.Mesh(
    new THREE.CapsuleGeometry(.72, 2.2, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x273142, metalness: .74, roughness: .28 }),
  )
  if (source?.scene) fitModel(body, { x: 1.65, y: .85, z: 3.7 }, renderer, { floor: 0, shadows: false })
  else body.rotation.x = Math.PI / 2
  body.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
  })
  craft.add(body)

  const accent = [0x4be7ff, 0xff3155, 0xd16cff][index % 3]
  const underglow = makeGlowStrip(accent, 1.18, 2.55)
  underglow.position.y = -.13
  craft.add(underglow)
  for (const side of [-1, 1]) {
    const thruster = new THREE.Mesh(
      new THREE.SphereGeometry(.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }),
    )
    thruster.scale.set(1, .55, 2.5)
    thruster.position.set(side * .58, .04, 1.48)
    craft.add(thruster)
  }
  craft.userData.flight = {
    centerX: index % 2 ? 8 : -6,
    centerZ: index % 3 === 0 ? 4 : index % 3 === 1 ? -8 : 10,
    radiusX: 46 + (index % 3) * 8,
    radiusZ: 31 + ((index + 1) % 3) * 6,
    height: 18 + (index % 3) * 4.6,
    speed: (.026 + (index % 2) * .006) * (index % 2 ? -1 : 1),
    phase: index * (Math.PI * 2 / 6),
    bank: 0,
  }
  return craft
}

function createMetro(world) {
  const root = new THREE.Group()
  root.name = 'Elevated cyber metro system'
  world.add(root)

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-58, 12.5, -36),
    new THREE.Vector3(-18, 13.8, -43),
    new THREE.Vector3(48, 13.2, -35),
    new THREE.Vector3(58, 14.4, -5),
    new THREE.Vector3(24, 12.8, 4),
    new THREE.Vector3(55, 14.6, 33),
    new THREE.Vector3(13, 13.4, 51),
    new THREE.Vector3(-47, 14.2, 39),
    new THREE.Vector3(-58, 13.1, 8),
    new THREE.Vector3(-22, 12.6, 2),
    new THREE.Vector3(-55, 13.8, -13),
  ], true, 'catmullrom', .18)

  const beam = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 240, .2, 6, true),
    new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: .42, metalness: .78 }),
  )
  beam.receiveShadow = false
  root.add(beam)
  const guide = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 240, .042, 5, true),
    new THREE.MeshBasicMaterial({ color: 0x52e5ff, toneMapped: false }),
  )
  root.add(guide)

  const supportGeometry = new THREE.CylinderGeometry(.18, .28, 1, 7)
  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x252c39, roughness: .52, metalness: .68 })
  const supports = new THREE.InstancedMesh(supportGeometry, supportMaterial, 24)
  supports.frustumCulled = true
  for (let index = 0; index < 24; index += 1) {
    curve.getPointAt(index / 24, tempPosition)
    tempScale.set(1, tempPosition.y, 1)
    tempQuaternion.identity()
    tempMatrix.compose(new THREE.Vector3(tempPosition.x, tempPosition.y * .5, tempPosition.z), tempQuaternion, tempScale)
    supports.setMatrixAt(index, tempMatrix)
  }
  supports.instanceMatrix.needsUpdate = true
  root.add(supports)

  const carBodyGeometry = new THREE.BoxGeometry(2.05, 1.55, 5.4)
  const carBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: .3, metalness: .62 })
  const glassGeometry = new THREE.BoxGeometry(1.86, .58, 3.8)
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x13253a, emissive: 0x2ccbe5, emissiveIntensity: .42, roughness: .18, metalness: .72 })
  const lightGeometry = new THREE.BoxGeometry(1.25, .08, 4.7)
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff3155, toneMapped: false })
  const carriages = []
  for (let index = 0; index < 4; index += 1) {
    const carriage = new THREE.Group()
    carriage.name = `Metro carriage ${index + 1}`
    const body = new THREE.Mesh(carBodyGeometry, carBodyMaterial)
    body.castShadow = index === 0
    carriage.add(body)
    const glass = new THREE.Mesh(glassGeometry, glassMaterial)
    glass.position.y = .35
    carriage.add(glass)
    const light = new THREE.Mesh(lightGeometry, lightMaterial)
    light.position.y = -.8
    carriage.add(light)
    root.add(carriage)
    carriages.push(carriage)
  }
  return { root, curve, carriages }
}

function updateFlyingCraft(craft, elapsed) {
  const flight = craft.userData.flight
  const angle = flight.phase + elapsed * flight.speed * Math.PI * 2
  const nextAngle = angle + Math.sign(flight.speed) * .012
  craft.position.set(
    flight.centerX + Math.cos(angle) * flight.radiusX,
    flight.height + Math.sin(elapsed * .72 + flight.phase) * .42,
    flight.centerZ + Math.sin(angle) * flight.radiusZ,
  )
  tempAhead.set(
    flight.centerX + Math.cos(nextAngle) * flight.radiusX,
    craft.position.y,
    flight.centerZ + Math.sin(nextAngle) * flight.radiusZ,
  )
  craft.lookAt(tempAhead)
  tempTangent.subVectors(tempAhead, craft.position).normalize()
  const targetBank = THREE.MathUtils.clamp(tempTangent.x * .22, -.18, .18)
  flight.bank = THREE.MathUtils.lerp(flight.bank, targetBank, .08)
  craft.rotateZ(flight.bank)
}

function updateMetro(metro, elapsed) {
  const lead = (elapsed * .018) % 1
  metro.carriages.forEach((carriage, index) => {
    const t = (lead - index * .0125 + 1) % 1
    const aheadT = (t + .0015) % 1
    metro.curve.getPointAt(t, tempPosition)
    metro.curve.getPointAt(aheadT, tempAhead)
    carriage.position.copy(tempPosition)
    carriage.lookAt(tempAhead)
  })
}

export function createTransportUpgrade({
  world,
  renderer,
  vehicles = [],
  getDrivingVehicle = () => null,
  heroAssetUrl = DEFAULT_HERO_ASSET,
} = {}) {
  if (!world?.isObject3D) throw new TypeError('createTransportUpgrade requires a Three.js world Object3D')
  if (!Array.isArray(vehicles)) throw new TypeError('createTransportUpgrade requires a vehicles array')

  const loader = new GLTFLoader()
  const assetPromises = new Map()
  const load = (url) => {
    const base = globalThis.location?.origin ? `${globalThis.location.origin}/` : import.meta.url
    const resolvedUrl = new URL(url, base).href
    if (!assetPromises.has(resolvedUrl)) assetPromises.set(resolvedUrl, loader.loadAsync(resolvedUrl))
    return assetPromises.get(resolvedUrl)
  }

  const metro = createMetro(world)
  const flyingCraft = []
  let rider = null
  let mountedVehicle = null
  let elapsedFallback = 0
  let cleanupClock = 0
  let attachedVehicles = []

  const vehicleSourcesPromise = Promise.all(Object.entries(VEHICLE_ASSETS).map(async ([classId, url]) => [classId, await load(url)]))
    .then((entries) => {
      const sources = Object.fromEntries(entries)
      attachedVehicles = attachVehicleBodies(vehicles, sources, renderer)
      const aerialSources = [sources.supercar, sources.ev, sources.sedan]
      for (let index = 0; index < 6; index += 1) {
        const craft = createFlyingCraft(aerialSources[index % aerialSources.length], renderer, index)
        world.add(craft)
        flyingCraft.push(craft)
      }
      return { sources, attachedVehicles, flyingCraft }
    })

  const riderPromise = load(heroAssetUrl)
    .then((source) => {
      rider = makeRider(source, renderer)
      return rider
    })

  const ready = Promise.allSettled([vehicleSourcesPromise, riderPromise]).then((results) => ({
    vehicles: attachedVehicles.length,
    flyingCars: flyingCraft.length,
    riderReady: Boolean(rider),
    metroReady: true,
    errors: results.filter((result) => result.status === 'rejected').map((result) => String(result.reason?.message || result.reason)),
  }))

  function update(dt = 0, elapsed) {
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), .1)
    elapsedFallback += safeDt
    const now = Number.isFinite(elapsed) ? elapsed : elapsedFallback

    flyingCraft.forEach((craft) => updateFlyingCraft(craft, now))
    updateMetro(metro, now)

    let drivingVehicle = null
    try { drivingVehicle = getDrivingVehicle?.() || null } catch { drivingVehicle = null }
    const isBike = drivingVehicle?.config?.kind === 'MOTORBIKE'
    if (rider && isBike) {
      if (mountedVehicle !== drivingVehicle) {
        drivingVehicle.visualRoot.add(rider)
        rider.position.set(0, .2, .16)
        rider.rotation.set(.03, 0, 0)
        mountedVehicle = drivingVehicle
      }
      rider.visible = true
      const speedRatio = THREE.MathUtils.clamp(Math.abs(drivingVehicle.speed || 0) / Math.max(drivingVehicle.config.maxForward || 1, 1), 0, 1)
      rider.rotation.x = THREE.MathUtils.lerp(rider.rotation.x, -.035 - speedRatio * .11, 1 - Math.exp(-safeDt * 7))
      rider.rotation.z = THREE.MathUtils.lerp(rider.rotation.z, (drivingVehicle.steeringInput || 0) * speedRatio * .07, 1 - Math.exp(-safeDt * 8))
    } else if (rider) {
      rider.visible = false
      mountedVehicle = null
    }

    // cityUpgrade may finish loading after this module. Periodic cleanup keeps a
    // single licensed body per vehicle without touching controls or physics.
    cleanupClock += safeDt
    if (cleanupClock >= 1.5) {
      cleanupClock = 0
      attachedVehicles.forEach((vehicle) => {
        const keep = vehicle.userData?.transportBody
        if (!keep) return
        removeCompetingBodies(vehicle, keep)
        if (keep.parent !== vehicle.visualRoot) vehicle.visualRoot.add(keep)
        vehicle.model = keep
      })
    }
  }

  return { update, ready }
}
