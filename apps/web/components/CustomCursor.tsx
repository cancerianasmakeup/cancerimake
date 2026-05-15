"use client";

// Halo decorativo con cangrejito que sigue al mouse en desktop.
// - Sólo se activa si el dispositivo tiene puntero fino (mouse) → mobile/touch no carga nada
// - No reemplaza el cursor nativo: se le suma encima como capa visual
// - Lag suave del halo (easing) + sway sutil del cangrejito + scale al hover sobre interactivos

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const haloRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const crabRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let haloX = mouseX;
    let haloY = mouseY;
    let t = 0;
    let hovering = false;
    let visible = false;
    let rafId = 0;

    const show = () => {
      visible = true;
      if (haloRef.current) haloRef.current.style.opacity = "1";
      if (dotRef.current) dotRef.current.style.opacity = "1";
    };
    const hide = () => {
      visible = false;
      if (haloRef.current) haloRef.current.style.opacity = "0";
      if (dotRef.current) dotRef.current.style.opacity = "0";
    };

    const isInteractive = (el: Element | null): boolean => {
      let cur: Element | null = el;
      let depth = 0;
      while (cur && depth < 6) {
        const tag = cur.tagName;
        if (
          tag === "A" ||
          tag === "BUTTON" ||
          tag === "INPUT" ||
          tag === "SELECT" ||
          tag === "TEXTAREA" ||
          tag === "LABEL"
        )
          return true;
        const role = (cur as HTMLElement).getAttribute?.("role");
        if (role === "button" || role === "link") return true;
        cur = cur.parentElement;
        depth++;
      }
      return false;
    };

    const onMove = (e: MouseEvent) => {
      if (!visible) show();
      mouseX = e.clientX;
      mouseY = e.clientY;
      hovering = isInteractive(e.target as Element);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    };

    const onLeave = () => hide();
    const onDown = () => {
      if (haloRef.current) haloRef.current.style.setProperty("--press", "0.85");
    };
    const onUp = () => {
      if (haloRef.current) haloRef.current.style.setProperty("--press", "1");
    };

    const tick = () => {
      haloX += (mouseX - haloX) * 0.18;
      haloY += (mouseY - haloY) * 0.18;
      t += 0.045;
      if (haloRef.current) {
        const baseScale = hovering ? 1.7 : 1;
        const press = parseFloat(haloRef.current.style.getPropertyValue("--press") || "1");
        haloRef.current.style.transform = `translate3d(${haloX}px, ${haloY}px, 0) translate(-50%, -50%) scale(${baseScale * press})`;
      }
      if (crabRef.current) {
        const angle = Math.sin(t) * 14;
        const bob = Math.cos(t * 1.4) * 1.2;
        crabRef.current.style.transform = `translateY(${bob}px) rotate(${angle}deg)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div
        ref={haloRef}
        aria-hidden
        className="cancer-cursor cancer-cursor--halo"
        style={{ ["--press" as any]: "1" }}
      >
        <span ref={crabRef} className="cancer-cursor__crab" aria-hidden>
          🦀
        </span>
      </div>
      <div ref={dotRef} aria-hidden className="cancer-cursor cancer-cursor--dot" />
    </>
  );
}
