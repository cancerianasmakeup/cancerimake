"use client";

import dynamic from "next/dynamic";

// Carga diferida del carrusel 3D (three.js solo corre en el cliente).
// Mientras carga muestra un placeholder con el alto reservado.
const Carousel3DScene = dynamic(() => import("./Carousel3DScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[240px] md:h-[380px] flex items-center justify-center">
      <div className="w-40 h-40 rounded-full bg-rose-deep/20 blur-3xl animate-soft-pulse" />
    </div>
  ),
});

export default function Carousel3D() {
  return <Carousel3DScene />;
}
