"use client";

// Cangrejito 3D miniatura girando en loop (para títulos/acentos).
// Reusa el GLB de la home; clona la escena para no pisar la normalización
// del cangrejo grande si se navega entre páginas.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/pink-crab.glb";

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

function SpinningCrab() {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.position.set(0, 0, 0);
    clone.scale.setScalar(1);
    const box = new THREE.Box3().setFromObject(clone);
    const dim = new THREE.Vector3();
    box.getSize(dim);
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    clone.scale.multiplyScalar(1 / maxDim);
    const box2 = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    clone.position.sub(center);
    return clone;
  }, [scene]);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 1.1;
    }
  });

  return (
    <group ref={group} scale={1.55}>
      {/* Misma corrección de orientación que el cangrejo grande */}
      <group rotation={[0, Math.PI, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <primitive object={model} rotation={[Math.PI / 2, 0, -Math.PI / 2]} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);

export default function MiniCrab3DScene() {
  return (
    <span
      aria-hidden
      className="inline-block align-middle w-14 h-14 md:w-20 md:h-20 pointer-events-none [&_*]:!pointer-events-none"
    >
      <Canvas
        camera={{ position: [0, 0.15, 2.6], fov: 35 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[3, 4, 4]} intensity={2.2} color="#fff5f7" />
        <directionalLight position={[-3, 1, 2]} intensity={1.1} color="#ffd3de" />
        <directionalLight position={[0, 2, -4]} intensity={1.3} color="#ff8fa3" />
        <EnvLight />
        <SpinningCrab />
      </Canvas>
    </span>
  );
}
