/**
 * EmberTrace – scroll-driven globe behind the story page.
 *
 * The only light on the globe is the real fire record: one point per 0.25° cell, sized by its
 * mean yearly detections (story.json). Orbits are illustrative (radii exaggerated so they read);
 * they appear in launch order as the story reaches each satellite.
 *
 * `stage` is written by the page's ScrollTriggers: one 0..1 progress value per story section.
 * The scene eases toward it every frame, so it follows the scroll without jumping.
 */

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { StoryData } from './storyData';

const DEG = Math.PI / 180;

/** lat/lon on a unit sphere, with lon 0 facing +z (camera side) before rotation. */
function latLonToVec(lat: number, lon: number, r = 1): THREE.Vector3 {
  return new THREE.Vector3(
    r * Math.cos(lat * DEG) * Math.sin(lon * DEG),
    r * Math.sin(lat * DEG),
    r * Math.cos(lat * DEG) * Math.cos(lon * DEG),
  );
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// ---- Fire points ----

const fireVertex = /* glsl */ `
  attribute float aSize;
  attribute float aHeat;
  uniform float uGlow;
  uniform float uPixelRatio;
  varying float vHeat;
  varying float vFacing;
  void main() {
    vHeat = aHeat;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // fade points on the far side of the globe
    vec3 n = normalize((modelViewMatrix * vec4(position, 0.0)).xyz);
    vFacing = smoothstep(-0.05, 0.25, dot(n, normalize(-mv.xyz)));
    gl_PointSize = aSize * uPixelRatio * (0.6 + 0.6 * uGlow) * (3.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fireFragment = /* glsl */ `
  uniform float uGlow;
  varying float vHeat;
  varying float vFacing;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 cool = vec3(0.85, 0.25, 0.05);
    vec3 hot = vec3(1.0, 0.82, 0.45);
    vec3 col = mix(cool, hot, vHeat);
    gl_FragColor = vec4(col, a * vFacing * (0.25 + 0.75 * uGlow));
  }
`;

function FirePoints({ cells, glow }: { cells: StoryData['cells']; glow: React.MutableRefObject<number> }) {
  const gl = useThree((s) => s.gl);
  const { geometry, uniforms } = useMemo(() => {
    const max = Math.max(...cells.map((c) => c[2]));
    const pos = new Float32Array(cells.length * 3);
    const size = new Float32Array(cells.length);
    const heat = new Float32Array(cells.length);
    cells.forEach(([lat, lon, v], i) => {
      latLonToVec(lat, lon, 1.002).toArray(pos, i * 3);
      const h = Math.sqrt(v / max);
      size[i] = 2 + 9 * h;
      heat[i] = h;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1));
    return {
      geometry: g,
      uniforms: { uGlow: { value: 0 }, uPixelRatio: { value: gl.getPixelRatio() } },
    };
  }, [cells, gl]);

  useFrame(() => {
    uniforms.uGlow.value = glow.current;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        vertexShader={fireVertex}
        fragmentShader={fireFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---- Globe body: dark sphere, faint graticule, rim light ----

function Graticule() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let lat = -75; lat <= 75; lat += 15)
      for (let lon = -180; lon < 180; lon += 3) push(latLonToVec(lat, lon, 1.001), latLonToVec(lat, lon + 3, 1.001));
    for (let lon = -180; lon < 180; lon += 15)
      for (let lat = -90; lat < 90; lat += 3) push(latLonToVec(lat, lon, 1.001), latLonToVec(lat + 3, lon, 1.001));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#2a3a63" transparent opacity={0.35} depthWrite={false} />
    </lineSegments>
  );
}

const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const rimFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
    gl_FragColor = vec4(0.35, 0.5, 0.95, f * 0.55);
  }
`;

function Body() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshBasicMaterial color="#0b1328" />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial
          vertexShader={rimVertex}
          fragmentShader={rimFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Graticule />
    </>
  );
}

// ---- Orbits (near-polar, like the real sun-synchronous orbits; radii exaggerated) ----

interface OrbitSpec {
  color: string;
  radius: number;
  node: number; // rotation of the orbit plane around the polar axis, degrees
  speed: number;
}

function Orbit({ spec, visible }: { spec: OrbitSpec; visible: () => number }) {
  const ring = useRef<THREE.LineLoop>(null);
  const sat = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(0, Math.cos(a) * spec.radius, Math.sin(a) * spec.radius);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [spec.radius]);

  useFrame((state) => {
    const v = visible();
    if (ring.current) (ring.current.material as THREE.LineBasicMaterial).opacity = 0.55 * v;
    if (sat.current) {
      const a = state.clock.elapsedTime * spec.speed;
      sat.current.position.set(0, Math.cos(a) * spec.radius, Math.sin(a) * spec.radius);
      (sat.current.material as THREE.MeshBasicMaterial).opacity = v;
      sat.current.visible = v > 0.01;
    }
  });

  return (
    <group rotation={[0, spec.node * DEG, 8 * DEG]}>
      <lineLoop ref={ring} geometry={geometry}>
        <lineBasicMaterial color={spec.color} transparent opacity={0} depthWrite={false} />
      </lineLoop>
      <mesh ref={sat}>
        <sphereGeometry args={[0.018, 12, 8]} />
        <meshBasicMaterial color={spec.color} transparent opacity={0} />
      </mesh>
    </group>
  );
}

const MODIS_ORBITS: OrbitSpec[] = [
  { color: '#c084fc', radius: 1.3, node: 20, speed: 0.35 }, // Terra
  { color: '#60a5fa', radius: 1.37, node: 65, speed: 0.3 }, // Aqua
];
const VIIRS_ORBITS: OrbitSpec[] = [
  { color: '#34d399', radius: 1.45, node: 110, speed: 0.27 }, // S-NPP
  { color: '#34d399', radius: 1.52, node: 150, speed: 0.25 }, // NOAA-20
  { color: '#34d399', radius: 1.59, node: 190, speed: 0.23 }, // NOAA-21
];

// ---- Scene: everything the scroll drives ----

const INDIA = { lat: 22, lon: 79 };

function Scene({
  data,
  stage,
  reducedMotion,
}: {
  data: StoryData;
  stage: React.MutableRefObject<number[]>;
  reducedMotion: boolean;
}) {
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const glow = useRef(0.3);
  const eased = useRef([0, 0, 0, 0, 0]);
  const orbitVisibility = useRef([0, 0, 0, 0, 0]);

  useFrame((state, delta) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 4);
    stage.current.forEach((v, i) => (eased.current[i] += (v - eased.current[i]) * k));
    const [, jump, more, scale, explore] = eased.current;

    // Before the story reaches India the globe drifts gently either side of it, then settles facing it.
    const drift = reducedMotion ? 0.2 : 0.2 + 0.15 * Math.sin(state.clock.elapsedTime * 0.12);
    const facing = smooth(Math.max(scale, explore));
    if (spin.current) spin.current.rotation.y = -INDIA.lon * DEG + (1 - facing) * drift;
    if (tilt.current) tilt.current.rotation.x = INDIA.lat * DEG * (0.4 + 0.6 * facing);

    glow.current = 0.3 + 0.7 * smooth(scale * 1.4);

    // Desktop: globe sits right of the text column; zooms in and centres on India at the end.
    const wide = state.size.width >= 900;
    const zoom = smooth(explore);
    // Lens shift (not a sideways camera move) so the globe is seen head-on and India stays centred on it.
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.set(0, 0, 4.2 - 1.1 * zoom);
    cam.filmOffset = wide ? -8.5 + 0.5 * zoom : 0;
    cam.updateProjectionMatrix();

    orbitVisibility.current = [
      smooth(jump * 2) * (1 - smooth(scale * 1.6)),
      smooth(jump * 2 - 0.4) * (1 - smooth(scale * 1.6)),
      smooth(more * 3) * (1 - smooth(scale * 1.6)),
      smooth(more * 3 - 1) * (1 - smooth(scale * 1.6)),
      smooth(more * 3 - 2) * (1 - smooth(scale * 1.6)),
    ];
  });

  const orbits = [...MODIS_ORBITS, ...VIIRS_ORBITS];

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <Body />
        <FirePoints cells={data.cells} glow={glow} />
        {orbits.map((spec, i) => (
          <Orbit key={i} spec={spec} visible={() => orbitVisibility.current[i]} />
        ))}
      </group>
    </group>
  );
}

export default function Globe(props: {
  data: StoryData;
  stage: React.MutableRefObject<number[]>;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      flat
      aria-hidden="true"
    >
      <Scene {...props} />
    </Canvas>
  );
}
