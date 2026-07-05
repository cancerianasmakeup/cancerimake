"use client";

import dynamic from "next/dynamic";

// Mini cangrejo 3D girando — carga diferida (three.js solo en cliente)
const MiniCrab3DScene = dynamic(() => import("./MiniCrab3DScene"), {
  ssr: false,
  loading: () => (
    <span className="inline-block align-middle w-14 h-14 md:w-20 md:h-20" aria-hidden />
  ),
});

export default function MiniCrab3D() {
  return <MiniCrab3DScene />;
}
