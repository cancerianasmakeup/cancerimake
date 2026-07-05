"use client";

import dynamic from "next/dynamic";

// El canvas 3D solo tiene sentido en el cliente (three.js) y no debe
// bloquear el render de la home: se carga aparte, sin SSR.
const CrabScene = dynamic(() => import("./CrabScene"), { ssr: false });

export default function CrabCompanion3D() {
  return <CrabScene />;
}
