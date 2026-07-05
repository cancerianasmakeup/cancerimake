"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/cancerianas-carousel.glb";

// Carrusel 3D del hero: tira curva de cards (card_1..card_6 en el GLB).
//  - En reposo se balancea suavemente de frente
//  - Se puede arrastrar horizontalmente para girarlo
//  - Al tocar una card, el carrusel la centra, se acerca y se agranda para
//    verla en grande; tocando de nuevo (o afuera) vuelve a su lugar.

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

// Extrae el número de card desde nombres tipo "card_3_front" / "card_3_edge0"
function cardIndexFromName(name: string): number | null {
  const m = name.match(/^card_(\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

function CarouselModel({
  rotY,
  lastInteract,
  focused,
}: {
  rotY: React.MutableRefObject<number>;
  lastInteract: React.MutableRefObject<number>;
  focused: number | null;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef<THREE.Group>(null);
  const started = useRef(false);
  // Offset z actual de cada card (para adelantar la enfocada con suavidad)
  const cardOffsets = useRef<Map<number, number>>(new Map());

  // Normalizar + reparar el modelo:
  //  - escala a dimensión máxima 1 y centrado
  //  - algunas cards vienen con la cara apuntando hacia adentro (normales
  //    inconsistentes): se detectan y se les invierte winding + UVs para que
  //    todas miren al frente con el texto legible
  //  - materiales con luz real (el GLB viene unlit) para que las cards se
  //    sombreen entre sí
  const normalized = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const dim = new THREE.Vector3();
    box.getSize(dim);
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    scene.scale.multiplyScalar(1 / maxDim);
    const box2 = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    scene.position.sub(center);
    scene.updateMatrixWorld(true);

    const flipWinding = (geo: THREE.BufferGeometry) => {
      const idx = geo.getIndex();
      if (!idx) return;
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);
        idx.setX(i + 1, c);
        idx.setX(i + 2, b);
      }
      idx.needsUpdate = true;
    };
    scene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry as THREE.BufferGeometry;
      const isFront = /^card_\d+_front/.test(mesh.name);

      if (isFront && geo.getIndex()) {
        // Normal del primer triángulo en coordenadas de mundo: si apunta
        // hacia +z (quedaría de espaldas tras el volteo en X), se da vuelta.
        const idx = geo.getIndex()!;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(0)).applyMatrix4(mesh.matrixWorld);
        const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(1)).applyMatrix4(mesh.matrixWorld);
        const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(2)).applyMatrix4(mesh.matrixWorld);
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        // El modelo trae escalas negativas (espejo): con invertir el winding
        // alcanza — la cara correcta queda hacia la cámara y la textura ya
        // se lee derecha (la escala espejada compensa la vista).
        if (n.z < 0) {
          flipWinding(geo);
        }
      }

      // Posición base para poder adelantar la card enfocada
      (mesh.userData as any).baseZ = mesh.position.z;

      // Material con iluminación (el original es unlit) + sombras
      geo.computeVertexNormals();
      const old = mesh.material as THREE.Material & { map?: THREE.Texture };
      const mat = new THREE.MeshStandardMaterial({
        map: old.map ?? null,
        vertexColors: !!geo.attributes.color,
        roughness: 0.82,
        metalness: 0.04,
        transparent: true,
        side: isFront ? THREE.FrontSide : THREE.DoubleSide,
      });
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return scene;
  }, [scene]);

  useFrame((state, dt) => {
    if (!group.current) return;
    if (!started.current) {
      group.current.rotation.y = rotY.current;
      started.current = true;
    }

    const idle = performance.now() - lastInteract.current > 1500;

    if (focused != null) {
      // Servo: girar hasta que la card elegida quede centrada en pantalla
      const node = normalized.getObjectByName(`card_${focused}_front`);
      if (node) {
        const p = new THREE.Vector3();
        node.getWorldPosition(p);
        rotY.current -= p.x * dt * 2.2;
      }
    } else if (idle) {
      // Balanceo suave de frente (la tira es de una sola cara)
      const sway = Math.sin(state.clock.elapsedTime * 0.5) * 0.28;
      rotY.current += (sway - rotY.current) * (1 - Math.exp(-dt * 1.4));
    }

    const k = 1 - Math.exp(-dt * 5);
    group.current.rotation.y += (rotY.current - group.current.rotation.y) * (1 - Math.exp(-dt * 8));

    // Acercar y agrandar cuando hay una card en foco
    const targetZ = focused != null ? 1.7 : 0;
    const targetY = focused != null ? 0.3 : 0;
    const targetScale = focused != null ? 7.2 : 6.0;
    group.current.position.z += (targetZ - group.current.position.z) * k;
    group.current.position.y += (targetY - group.current.position.y) * k;
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * k;
    group.current.scale.setScalar(s);

    // Adelantar la card enfocada para que quede POR DELANTE de sus vecinas
    // (en el espacio local pre-volteo, hacia la cámara es -z) y atenuar
    // el resto para que el foco sea inconfundible.
    for (let i = 1; i <= 6; i++) {
      const targetOff = focused === i ? -0.5 : 0;
      const cur = cardOffsets.current.get(i) ?? 0;
      const next = cur + (targetOff - cur) * k;
      cardOffsets.current.set(i, next);
      const targetOpacity = focused == null || focused === i ? 1 : 0.35;
      normalized.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (cardIndexFromName(o.name) === i && mesh.isMesh) {
          mesh.position.z = ((mesh.userData as any).baseZ ?? 0) + next;
          const m = mesh.material as THREE.Material & { opacity: number };
          m.opacity += (targetOpacity - m.opacity) * k;
        }
      });
    }
  });

  return (
    <group ref={group} scale={6.0}>
      {/* El GLB viene boca abajo y de espaldas: el giro en X lo endereza
          mostrando la cara real de las cards */}
      <primitive object={normalized} rotation={[Math.PI, 0, 0]} />
    </group>
  );
}

// Puente para exponer cámara y escena al contenedor (raycast manual del tap)
function ThreeBridge({
  out,
}: {
  out: React.MutableRefObject<{ camera: THREE.Camera; scene: THREE.Scene } | null>;
}) {
  const { camera, scene } = useThree();
  useEffect(() => {
    out.current = { camera, scene };
  }, [camera, scene, out]);
  return null;
}

export default function Carousel3DScene() {
  const rotY = useRef(0);
  const lastInteract = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const downPos = useRef({ x: 0, y: 0 });
  const moved = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const three = useRef<{ camera: THREE.Camera; scene: THREE.Scene } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [focused, setFocused] = useState<number | null>(null);
  const focusedRef = useRef<number | null>(null);
  focusedRef.current = focused;

  // Tap → raycast manual contra las cards (independiente de los eventos de R3F)
  const handleTap = (clientX: number, clientY: number) => {
    const ctx = three.current;
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!ctx || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1
    );
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, ctx.camera);
    const hits = rc.intersectObjects(ctx.scene.children, true);
    for (const h of hits) {
      const n = cardIndexFromName(h.object?.name ?? "");
      if (n != null) {
        lastInteract.current = performance.now();
        setFocused(focusedRef.current === n ? null : n);
        return;
      }
    }
    // Tap al vacío: soltar el foco
    if (focusedRef.current != null) setFocused(null);
  };

  return (
    <div className="w-full">
      <div
        ref={wrapRef}
        className={`w-full h-[240px] md:h-[380px] select-none ${
          focused != null ? "cursor-zoom-out" : grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          dragging.current = true;
          moved.current = 0;
          downPos.current = { x: e.clientX, y: e.clientY };
          lastX.current = e.clientX;
          lastInteract.current = performance.now();
          if (focusedRef.current == null) setGrabbing(true);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          moved.current = Math.max(
            moved.current,
            Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
          );
          if (focusedRef.current != null) return; // en foco no se gira a mano
          const dx = e.clientX - lastX.current;
          lastX.current = e.clientX;
          rotY.current += dx * 0.008;
          lastInteract.current = performance.now();
        }}
        onPointerUp={(e) => {
          const wasTap = dragging.current && moved.current < 8;
          dragging.current = false;
          setGrabbing(false);
          lastInteract.current = performance.now();
          if (wasTap) handleTap(e.clientX, e.clientY);
        }}
        onPointerLeave={() => {
          dragging.current = false;
          setGrabbing(false);
        }}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0.55, 5.8], fov: 35 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ThreeBridge out={three} />
          <ambientLight intensity={0.9} />
          <directionalLight
            position={[3, 5, 6]}
            intensity={2.0}
            color="#fff8f9"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0004}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-camera-near={0.5}
            shadow-camera-far={25}
          />
          <directionalLight position={[-5, 2, 4]} intensity={0.8} color="#ffe0e8" />
          <EnvLight />
          <Suspense fallback={null}>
            <CarouselModel rotY={rotY} lastInteract={lastInteract} focused={focused} />
            {/* Sombra de apoyo bajo la tira */}
            <ContactShadows
              position={[0, -0.85, 0]}
              opacity={0.5}
              scale={16}
              blur={2.4}
              far={4}
              resolution={512}
              frames={Infinity}
            />
          </Suspense>
        </Canvas>
      </div>
      <p className="text-center text-white/40 text-xs mt-1">
        {focused != null
          ? "Tocá de nuevo (o afuera) para volver"
          : "Tocá una imagen para verla de cerca · arrastrá para girar"}
      </p>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
