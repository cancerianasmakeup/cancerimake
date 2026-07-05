"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/pink-crab.glb";

// ------------------------------------------------------------------
// Cangrejo 3D "compañero" de la home:
//  - Al entrar: centrado abajo de BIENVENIDA (sigue al ancla #crab-3d-anchor)
//  - Al scrollear: nada hacia la izquierda, después hacia la derecha
//  - Se desvanece antes de las categorías para no molestar
// Todo con easing suave (damping por frame) y flotación constante.
// ------------------------------------------------------------------

// Entorno de reflejos generado localmente (RoomEnvironment viene con three,
// no descarga nada). Sin esto los materiales metálicos del GLB se ven negros.
function EnvLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CrabModel({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const started = useRef(false);

  // Normalizar tamaño del modelo: que su dimensión máxima sea 1 unidad
  const normalized = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const dim = new THREE.Vector3();
    box.getSize(dim);
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center); // centrar en el origen
    scene.scale.multiplyScalar(1 / maxDim);
    // Materiales con transparencia habilitada para poder desvanecer
    scene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          m.transparent = true;
        }
      }
    });
    return scene;
  }, [scene]);

  useFrame((state, dt) => {
    if (!group.current) return;
    const H = window.innerHeight || 1;
    const W = window.innerWidth || 1;

    // El cangrejo vive SIEMPRE en su slot debajo de BIENVENIDA: sigue al
    // ancla y se va con el scroll como un elemento más de la página.
    let anchorF = { fx: 0.5, fy: 0.38 };
    const el = document.getElementById("crab-3d-anchor");
    if (el) {
      const r = el.getBoundingClientRect();
      anchorF = {
        fx: (r.left + r.width / 2) / W,
        fy: (r.top + r.height / 2) / H,
      };
    }

    // Pantalla → mundo (plano z=0, cámara perspectiva mirando -z)
    const persp = camera as THREE.PerspectiveCamera;
    const dist = persp.position.z;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
    const visW = visH * (size.width / size.height);
    const targetX = (anchorF.fx - 0.5) * visW;
    const targetY = -(anchorF.fy - 0.5) * visH;

    // Tamaño deseado en px → escala en mundo
    const desiredPx = Math.min(0.7 * W, 400);
    const worldPerPx = visH / size.height;
    const targetScale = Math.max(0.001, desiredPx * worldPerPx);

    // Primer frame: aparecer directo en el ancla (sin viaje desde 0,0)
    if (!started.current) {
      pos.current.set(targetX, targetY, 0);
      group.current.scale.setScalar(targetScale * 0.6);
      started.current = true;
    }

    // Seguir al ancla con respuesta rápida (el scroll no debe "flotar")
    const k = 1 - Math.exp(-dt * 14);
    pos.current.x += (targetX - pos.current.x) * k;
    pos.current.y += (targetY - pos.current.y) * k;
    group.current.position.copy(pos.current);
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * (1 - Math.exp(-dt * 4));
    group.current.scale.setScalar(s);

    // Giro en loop izquierda ↔ derecha para lucir el 3D
    if (inner.current && !reducedMotion) {
      const yaw = Math.sin(state.clock.elapsedTime * 0.55) * 0.55;
      inner.current.rotation.y = yaw;
      // Leve inclinación acompañando el giro, le da vida
      inner.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.55 + Math.PI / 2) * 0.05;
    }

  });

  return (
    <group ref={group}>
      <Float speed={2.2} rotationIntensity={0.12} floatIntensity={0.9} floatingRange={[-0.06, 0.06]}>
        <group ref={inner}>
          {/* Corrección de orientación: el GLB viene de canto; estas
              rotaciones lo dejan bien de frente (cara delantera hacia la
              cámara) con las pinzas hacia arriba y patas abajo, como el logo */}
          <group rotation={[0, Math.PI, 0]}>
            <group rotation={[0, 0, Math.PI / 2]}>
              <primitive object={normalized} rotation={[Math.PI / 2, 0, -Math.PI / 2]} />
            </group>
          </group>
        </group>
      </Float>
    </group>
  );
}

useGLTF.preload(MODEL_URL);

export default function CrabScene() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  return (
    <div
      // OJO: R3F fuerza pointer-events:auto en su canvas, que al ser fixed
      // full-screen se tragaba TODOS los clicks de la home. Los selectores
      // [&_*] apagan pointer-events en todo el subárbol.
      className="fixed inset-0 z-30 pointer-events-none [&_*]:!pointer-events-none"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0.4, 8], fov: 35 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        {/* Iluminación rosada glam: pensada para que el cangrejo brille
            sobre el fondo negro de la home (key fuerte + rim rosa) */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 5]} intensity={2.6} color="#fff5f7" />
        <directionalLight position={[-5, 2, 3]} intensity={1.4} color="#ffd3de" />
        <directionalLight position={[0, 3, -5]} intensity={1.6} color="#ff8fa3" />
        <pointLight position={[0, -3, 4]} intensity={1.1} color="#ff8fa3" />
        <EnvLight />
        <CrabModel reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
