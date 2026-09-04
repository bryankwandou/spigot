"use client";

import { useEffect, useRef } from "react";

type Drop = {
  lane: number;
  y: number;
  speed: number;
  size: number;
  hue: number;
  /** Below this the drop has joined the pool and stops being drawn. */
  pooled: boolean;
};

const LANES = 4;
const TRACK = ["#5eead4", "#38bdf8", "#6366f1", "#38bdf8"];

/**
 * The hero visual: four upstream faucets dripping into one shared account.
 *
 * It is a picture of the actual mechanism rather than decoration. Four lanes,
 * one per upstream, each dripping at its own rate; a lane that is refusing
 * stops dripping and dims, which is what the board underneath is reporting in
 * words. What falls collects on a single line — the treasury — and leaves it
 * again as grants.
 *
 * Written on a 2D context rather than WebGL on purpose. The whole scene is a
 * few hundred filled paths a frame, it starts instantly with no shader
 * compile, and it stays smooth on integrated graphics, which is what most
 * people reading a devnet tool are on.
 */
export function Relay({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const drops: Drop[] = [];
    // Per-lane openness. A lane at 0 is a faucet that is refusing; it drifts
    // between states slowly so the scene keeps changing without ever being
    // busy about it.
    const open = [0.9, 0.55, 0.75, 0.3];
    const phase = open.map(() => Math.random() * Math.PI * 2);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    size();

    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const laneX = (i: number) => ((i + 0.5) / LANES) * w;
    const poolY = () => h * 0.72;

    const spawn = (t: number) => {
      for (let i = 0; i < LANES; i++) {
        // Slow sinusoidal drift, one phase per lane so they never sync up.
        const openness = 0.5 + 0.5 * Math.sin(t / 5200 + phase[i]);
        open[i] = openness;
        if (Math.random() < openness * 0.055) {
          drops.push({
            lane: i,
            y: h * 0.16,
            speed: 0.9 + Math.random() * 1.5,
            size: 1.4 + Math.random() * 2.2,
            hue: i,
            pooled: false,
          });
        }
      }
    };

    // Ripples on the pool line, left behind where a drop landed.
    const rings: Array<{ x: number; r: number; a: number }> = [];

    const frame = (t: number) => {
      if (!running) return;

      ctx.clearRect(0, 0, w, h);

      const py = poolY();

      // Spouts: a short bright stub per lane, brightness following openness.
      for (let i = 0; i < LANES; i++) {
        const x = laneX(i);
        ctx.globalAlpha = 0.22 + open[i] * 0.55;
        ctx.strokeStyle = TRACK[i];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.08);
        ctx.lineTo(x, h * 0.15);
        ctx.stroke();

        // The dry column still shows its path, faintly, so a lane that stops
        // reads as "not paying" rather than "gone".
        ctx.globalAlpha = 0.06 + open[i] * 0.06;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.15);
        ctx.lineTo(x, py);
        ctx.stroke();
      }

      if (!still) spawn(t);

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.speed;

        if (d.y >= py) {
          rings.push({ x: laneX(d.lane), r: 1, a: 0.5 });
          drops.splice(i, 1);
          continue;
        }

        const x = laneX(d.lane);
        // A falling drop stretches. Drawing it as an ellipse rather than a
        // circle is the difference between rain and confetti.
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = TRACK[d.hue];
        ctx.beginPath();
        ctx.ellipse(x, d.y, d.size, d.size * 1.9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.ellipse(x, d.y, d.size * 3.2, d.size * 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += 0.9;
        r.a *= 0.94;
        if (r.a < 0.02) {
          rings.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = r.a;
        ctx.strokeStyle = "#5eead4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, py, r.r * 2.4, r.r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // The pool: one line, the shared account everything lands in.
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "rgba(94,234,212,0)");
      g.addColorStop(0.2, "rgba(94,234,212,0.55)");
      g.addColorStop(0.55, "rgba(56,189,248,0.55)");
      g.addColorStop(0.85, "rgba(99,102,241,0.45)");
      g.addColorStop(1, "rgba(99,102,241,0)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    // A canvas painting to a tab nobody is looking at is a battery bill with no
    // reader. Stop on hide, pick up on show.
    const visibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", visibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
