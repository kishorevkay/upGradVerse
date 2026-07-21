const DEFAULT_HALF_EXTENT = 69
const MIST_CARD_COUNT = 28
const PARTICLE_COUNT = 144
const FLYER_COUNT = 6

function seededRandom(seed = 73129) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = state * 16807 % 2147483647
    return (state - 1) / 2147483646
  }
}

function addResource(set, resource) {
  set.add(resource)
  return resource
}

function finishInstances(mesh) {
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingBox?.()
  mesh.computeBoundingSphere?.()
  return mesh
}

export function createAtmosphereUpgrade({ THREE, scene, world, cityHalfExtent } = {}) {
  if (!THREE || !scene?.add) {
    throw new Error('createAtmosphereUpgrade requires { THREE, scene }.')
  }

  const parent = world?.add ? world : scene
  const extent = Number.isFinite(cityHalfExtent) && cityHalfExtent > 0
    ? cityHalfExtent
    : DEFAULT_HALF_EXTENT
  const random = seededRandom(Math.round(extent * 1009) + 413)
  const root = new THREE.Group()
  root.name = 'Atmosphere Upgrade'
  parent.add(root)

  const geometries = new Set()
  const materials = new Set()
  const dummy = new THREE.Object3D()
  const tempColor = new THREE.Color()

  // These translucent horizon shells sit inside the existing scene fog. The
  // scene's fog object and tuning are intentionally left untouched.
  const fogGeometry = addResource(
    geometries,
    new THREE.CylinderGeometry(1, 1, 1, 64, 1, true),
  )
  fogGeometry.setAttribute('aLayerAlpha', new THREE.InstancedBufferAttribute(
    new Float32Array([0.07, 0.048, 0.032]),
    1,
  ))
  fogGeometry.setAttribute('aLayerWarmth', new THREE.InstancedBufferAttribute(
    new Float32Array([0.78, 0.42, 0.16]),
    1,
  ))

  const fogMaterial = addResource(materials, new THREE.ShaderMaterial({
    name: 'Dusk horizon fog layers',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
    toneMapped: false,
    vertexShader: `
      attribute float aLayerAlpha;
      attribute float aLayerWarmth;
      varying vec2 vUv;
      varying float vLayerAlpha;
      varying float vLayerWarmth;

      void main() {
        vUv = uv;
        vLayerAlpha = aLayerAlpha;
        vLayerWarmth = aLayerWarmth;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vLayerAlpha;
      varying float vLayerWarmth;

      void main() {
        float lowerFade = smoothstep(0.01, 0.18, vUv.y);
        float upperFade = 1.0 - smoothstep(0.40, 0.98, vUv.y);
        float horizonBand = 0.58 + 0.42 * exp(-pow((vUv.y - 0.30) * 4.8, 2.0));
        vec3 cool = vec3(0.22, 0.25, 0.36);
        vec3 warm = vec3(0.49, 0.31, 0.38);
        vec3 color = mix(cool, warm, vLayerWarmth * (1.0 - vUv.y * 0.65));
        gl_FragColor = vec4(color, vLayerAlpha * lowerFade * upperFade * horizonBand);
      }
    `,
  }))

  const horizonFog = new THREE.InstancedMesh(fogGeometry, fogMaterial, 3)
  horizonFog.name = 'Layered dusk horizon haze'
  horizonFog.frustumCulled = false
  horizonFog.renderOrder = 3
  const fogBaseRadius = extent + Math.max(27, extent * 0.38)
  for (let index = 0; index < 3; index += 1) {
    const radius = fogBaseRadius + index * Math.max(34, extent * 0.45)
    dummy.position.set(0, 17 + index * 5, 0)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(radius, 51 + index * 20, radius)
    dummy.updateMatrix()
    horizonFog.setMatrixAt(index, dummy.matrix)
  }
  finishInstances(horizonFog)
  root.add(horizonFog)

  const mistGeometry = addResource(geometries, new THREE.PlaneGeometry(1, 1, 1, 1))
  const mistPhases = new Float32Array(MIST_CARD_COUNT)
  const mistDrifts = new Float32Array(MIST_CARD_COUNT)
  const mistDensities = new Float32Array(MIST_CARD_COUNT)
  mistGeometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(mistPhases, 1))
  mistGeometry.setAttribute('aDrift', new THREE.InstancedBufferAttribute(mistDrifts, 1))
  mistGeometry.setAttribute('aDensity', new THREE.InstancedBufferAttribute(mistDensities, 1))

  const mistMaterial = addResource(materials, new THREE.ShaderMaterial({
    name: 'Procedural volumetric mist cards',
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      attribute float aPhase;
      attribute float aDrift;
      attribute float aDensity;
      varying vec2 vUv;
      varying float vDensity;

      void main() {
        vec4 center = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.x += sin(uTime * aDrift + aPhase) * 10.0;
        center.z += cos(uTime * aDrift * 0.73 + aPhase * 1.31) * 7.0;
        center.y += sin(uTime * 0.08 + aPhase) * 0.42;

        vec2 cardSize = vec2(
          length(instanceMatrix[0].xyz),
          length(instanceMatrix[1].xyz)
        );
        vec4 mvPosition = modelViewMatrix * center;
        mvPosition.xy += position.xy * cardSize;
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv;
        vDensity = aDensity;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vDensity;

      float cloudLobe(vec2 p, vec2 center, vec2 radius) {
        vec2 q = (p - center) / radius;
        return exp(-dot(q, q) * 2.1);
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float body = cloudLobe(p, vec2(-0.42, 0.02), vec2(0.72, 0.48));
        body += cloudLobe(p, vec2(0.02, 0.12), vec2(0.92, 0.58));
        body += cloudLobe(p, vec2(0.50, -0.08), vec2(0.68, 0.42));
        float breakup = 0.79
          + sin(p.x * 10.0 + p.y * 5.0 + uTime * 0.025) * 0.09
          + sin(p.x * 19.0 - p.y * 11.0) * 0.06;
        float alpha = smoothstep(0.10, 0.82, body * breakup) * vDensity * 0.16;
        vec3 color = mix(vec3(0.38, 0.42, 0.55), vec3(0.58, 0.43, 0.50), vUv.y * 0.45);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }))

  const mistCards = new THREE.InstancedMesh(mistGeometry, mistMaterial, MIST_CARD_COUNT)
  mistCards.name = 'Slow procedural cloud wisps'
  mistCards.frustumCulled = false
  mistCards.renderOrder = 4
  const mistSpread = extent + 30
  for (let index = 0; index < MIST_CARD_COUNT; index += 1) {
    const distant = index >= MIST_CARD_COUNT * 0.58
    const radius = distant
      ? extent + 26 + random() * 52
      : 12 + random() * Math.max(18, extent - 8)
    const angle = random() * Math.PI * 2
    const width = (distant ? 28 : 15) + random() * (distant ? 35 : 24)
    const height = (distant ? 7 : 3.6) + random() * (distant ? 9 : 5.4)
    dummy.position.set(
      Math.cos(angle) * radius + (random() - 0.5) * mistSpread * 0.18,
      (distant ? 5 : 1.4) + random() * (distant ? 17 : 5.5),
      Math.sin(angle) * radius + (random() - 0.5) * mistSpread * 0.18,
    )
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(width, height, 1)
    dummy.updateMatrix()
    mistCards.setMatrixAt(index, dummy.matrix)
    mistPhases[index] = random() * Math.PI * 2
    mistDrifts[index] = 0.018 + random() * 0.038
    mistDensities[index] = distant ? 0.56 + random() * 0.28 : 0.38 + random() * 0.30
  }
  mistGeometry.getAttribute('aPhase').needsUpdate = true
  mistGeometry.getAttribute('aDrift').needsUpdate = true
  mistGeometry.getAttribute('aDensity').needsUpdate = true
  finishInstances(mistCards)
  root.add(mistCards)

  const skylineCount = 104
  const skylineGeometry = addResource(geometries, new THREE.BoxGeometry(1, 1, 1))
  const skylineMaterial = addResource(materials, new THREE.MeshBasicMaterial({
    name: 'Far skyline silhouettes',
    color: 0xffffff,
    vertexColors: true,
    fog: true,
    toneMapped: false,
  }))
  const skyline = new THREE.InstancedMesh(skylineGeometry, skylineMaterial, skylineCount)
  skyline.name = 'Infinite four-sided skyline'
  skyline.castShadow = false
  skyline.receiveShadow = false
  const skylineBase = extent + Math.max(55, extent * 0.72)
  const skylineSpan = skylineBase * 1.18
  const capSpecs = []

  for (let index = 0; index < skylineCount; index += 1) {
    const side = index % 4
    const slot = Math.floor(index / 4)
    const slotsPerSide = skylineCount / 4
    const along = -skylineSpan + (slot + 0.5) / slotsPerSide * skylineSpan * 2
      + (random() - 0.5) * skylineSpan * 0.055
    const edge = skylineBase + random() * Math.max(24, extent * 0.38)
    const width = 7 + random() * 13
    const depth = 8 + random() * 14
    const height = 18 + Math.pow(random(), 0.72) * 70
    const x = side < 2 ? (side === 0 ? -edge : edge) : along
    const z = side >= 2 ? (side === 2 ? -edge : edge) : along

    dummy.position.set(x, height * 0.5 - 0.4, z)
    dummy.rotation.set(0, random() * 0.08 - 0.04, 0)
    dummy.scale.set(width, height, depth)
    dummy.updateMatrix()
    skyline.setMatrixAt(index, dummy.matrix)
    tempColor.setHSL(
      0.62 + random() * 0.065,
      0.13 + random() * 0.12,
      0.055 + random() * 0.045,
    )
    skyline.setColorAt(index, tempColor)

    if (index % 4 === 0) capSpecs.push({
      x,
      y: height + 1.6,
      z,
      radius: Math.min(width, depth) * (0.22 + random() * 0.12),
      height: 3.2 + random() * 8,
    })
  }
  skyline.instanceColor.needsUpdate = true
  finishInstances(skyline)
  root.add(skyline)

  const capGeometry = addResource(geometries, new THREE.ConeGeometry(1, 1, 6))
  const skylineCaps = new THREE.InstancedMesh(capGeometry, skylineMaterial, capSpecs.length)
  skylineCaps.name = 'Distant skyline roof forms'
  skylineCaps.castShadow = false
  skylineCaps.receiveShadow = false
  for (let index = 0; index < capSpecs.length; index += 1) {
    const cap = capSpecs[index]
    dummy.position.set(cap.x, cap.y, cap.z)
    dummy.rotation.set(0, index * 0.71, 0)
    dummy.scale.set(cap.radius, cap.height, cap.radius)
    dummy.updateMatrix()
    skylineCaps.setMatrixAt(index, dummy.matrix)
    tempColor.setHSL(0.64, 0.18, 0.055 + index % 3 * 0.012)
    skylineCaps.setColorAt(index, tempColor)
  }
  skylineCaps.instanceColor.needsUpdate = true
  finishInstances(skylineCaps)
  root.add(skylineCaps)

  const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
  const particlePhases = new Float32Array(PARTICLE_COUNT)
  const particleSpeeds = new Float32Array(PARTICLE_COUNT)
  const particleSizes = new Float32Array(PARTICLE_COUNT)
  const particleWarmth = new Float32Array(PARTICLE_COUNT)
  const particleRange = extent + 24
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3
    particlePositions[offset] = (random() - 0.5) * particleRange * 2
    particlePositions[offset + 1] = random() * 38
    particlePositions[offset + 2] = (random() - 0.5) * particleRange * 2
    particlePhases[index] = random() * Math.PI * 2
    particleSpeeds[index] = 0.035 + random() * 0.11
    particleSizes[index] = 0.7 + random() * 1.35
    particleWarmth[index] = random() > 0.78 ? 1 : 0
  }

  const particleGeometry = addResource(geometries, new THREE.BufferGeometry())
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  particleGeometry.setAttribute('aPhase', new THREE.BufferAttribute(particlePhases, 1))
  particleGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(particleSpeeds, 1))
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1))
  particleGeometry.setAttribute('aWarmth', new THREE.BufferAttribute(particleWarmth, 1))

  const particleMaterial = addResource(materials, new THREE.ShaderMaterial({
    name: 'Subtle airborne dusk particles',
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      attribute float aWarmth;
      varying float vWarmth;
      varying float vFade;

      void main() {
        vec3 animated = position;
        animated.y = mod(position.y + uTime * aSpeed, 38.0);
        animated.x += sin(uTime * 0.08 + aPhase) * 0.65;
        animated.z += cos(uTime * 0.065 + aPhase * 1.7) * 0.65;
        vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * 34.0 / max(2.0, -mvPosition.z), 0.65, 3.2);
        vWarmth = aWarmth;
        vFade = 0.34 + 0.66 * smoothstep(0.0, 5.0, animated.y);
      }
    `,
    fragmentShader: `
      varying float vWarmth;
      varying float vFade;

      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float radius = length(p);
        float alpha = (1.0 - smoothstep(0.16, 0.5, radius)) * 0.34 * vFade;
        vec3 color = mix(vec3(0.58, 0.73, 0.91), vec3(1.0, 0.64, 0.48), vWarmth);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }))
  const particles = new THREE.Points(particleGeometry, particleMaterial)
  particles.name = 'Airborne dusk particles'
  particles.frustumCulled = false
  particles.renderOrder = 5
  root.add(particles)

  const flyerBodyGeometry = addResource(geometries, new THREE.ConeGeometry(0.42, 2.8, 5))
  flyerBodyGeometry.rotateX(Math.PI / 2)
  const flyerBodyMaterial = addResource(materials, new THREE.MeshBasicMaterial({
    name: 'Distant flyer silhouettes',
    color: 0x080a10,
    fog: true,
    toneMapped: false,
  }))
  const flyerBodies = new THREE.InstancedMesh(flyerBodyGeometry, flyerBodyMaterial, FLYER_COUNT)
  flyerBodies.name = 'Moving distant flying silhouettes'
  flyerBodies.frustumCulled = false

  const flyerLightGeometry = addResource(geometries, new THREE.SphereGeometry(0.13, 6, 4))
  const flyerLightMaterial = addResource(materials, new THREE.MeshBasicMaterial({
    name: 'Distant flyer navigation lights',
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }))
  const flyerLights = new THREE.InstancedMesh(flyerLightGeometry, flyerLightMaterial, FLYER_COUNT * 2)
  flyerLights.name = 'Moving distant flying lights'
  flyerLights.frustumCulled = false
  flyerLights.renderOrder = 6

  const flyers = Array.from({ length: FLYER_COUNT }, (_, index) => ({
    radius: extent + 43 + index * 8 + random() * 14,
    height: 27 + random() * 38,
    phase: random() * Math.PI * 2,
    speed: (0.022 + random() * 0.018) * (index % 2 ? -1 : 1),
    verticalPhase: random() * Math.PI * 2,
    scale: 0.72 + random() * 0.55,
  }))

  for (let index = 0; index < FLYER_COUNT * 2; index += 1) {
    flyerLights.setColorAt(index, tempColor.setHex(index % 2 ? 0xff795f : 0x72dfff))
  }
  flyerLights.instanceColor.needsUpdate = true
  root.add(flyerBodies, flyerLights)

  let localElapsed = 0
  let disposed = false

  function update(elapsed, dt) {
    if (disposed) return
    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0
    localElapsed = Number.isFinite(elapsed) ? elapsed : localElapsed + safeDt
    mistMaterial.uniforms.uTime.value = localElapsed
    particleMaterial.uniforms.uTime.value = localElapsed

    for (let index = 0; index < FLYER_COUNT; index += 1) {
      const flyer = flyers[index]
      const angle = flyer.phase + localElapsed * flyer.speed
      const cosAngle = Math.cos(angle)
      const sinAngle = Math.sin(angle)
      const x = cosAngle * flyer.radius
      const z = sinAngle * flyer.radius * 0.82
      const y = flyer.height + Math.sin(localElapsed * 0.11 + flyer.verticalPhase) * 3.1
      const tangentX = -sinAngle * Math.sign(flyer.speed)
      const tangentZ = cosAngle * 0.82 * Math.sign(flyer.speed)
      const yaw = Math.atan2(tangentX, tangentZ)
      const pulse = 0.82 + Math.sin(localElapsed * 1.7 + flyer.phase) * 0.16

      dummy.position.set(x, y, z)
      dummy.rotation.set(0, yaw, Math.sin(localElapsed * 0.07 + flyer.phase) * 0.04)
      dummy.scale.set(flyer.scale, flyer.scale, flyer.scale)
      dummy.updateMatrix()
      flyerBodies.setMatrixAt(index, dummy.matrix)

      const rightX = Math.cos(yaw)
      const rightZ = -Math.sin(yaw)
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const side = sideIndex === 0 ? -1 : 1
        dummy.position.set(
          x + rightX * side * flyer.scale * 0.72,
          y + 0.04,
          z + rightZ * side * flyer.scale * 0.72,
        )
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(flyer.scale * pulse)
        dummy.updateMatrix()
        flyerLights.setMatrixAt(index * 2 + sideIndex, dummy.matrix)
      }
    }
    flyerBodies.instanceMatrix.needsUpdate = true
    flyerLights.instanceMatrix.needsUpdate = true
  }

  update(0, 0)

  function dispose() {
    if (disposed) return
    disposed = true
    parent.remove(root)
    root.clear()
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    geometries.clear()
    materials.clear()
  }

  return { update, dispose }
}
