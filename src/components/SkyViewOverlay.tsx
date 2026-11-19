import React, { useEffect, useRef } from 'react';
import { NPC_ORDER, PRINCESSES } from '../game/quests.js';
import { PrincessId } from '../types';

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface SkyViewProjection {
  alpha: number;
  zoe: ProjectedPoint;
  lands: Record<string, ProjectedPoint>;
}

const LAND_ICONS: Record<string, string> = {
  belle: '📚',
  elsa: '❄️',
  rapunzel: '🌻',
  cinderella: '👠',
  ariel: '🐚',
  moana: '⛵',
  jasmine: '🌙',
  anna: '⚓',
  tiana: '🪷',
  aurora: '🌹',
};

interface SkyViewOverlayProps {
  mode: 'entering' | 'active' | 'exiting';
  doneLands: string[];
  nextNPC: PrincessId | null;
  projectHandlerRef: React.MutableRefObject<((proj: SkyViewProjection) => void) | null>;
  onPanScreen: (dx: number, dy: number) => void;
  onZoomFactor: (factor: number) => void;
  onZoomStep: (dir: 1 | -1) => void;
  onClose: () => void;
}

export const SkyViewOverlay: React.FC<SkyViewOverlayProps> = ({
  mode,
  doneLands,
  nextNPC,
  projectHandlerRef,
  onPanScreen,
  onZoomFactor,
  onZoomStep,
  onClose,
}) => {
  const landRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const zoeRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPanCenterRef = useRef<{ x: number; y: number } | null>(null);
  const isInteractive = mode === 'active';

  // Register direct DOM transform updater so 60fps label projection causes zero React re-renders
  useEffect(() => {
    projectHandlerRef.current = (proj: SkyViewProjection) => {
      const baseAlpha = Math.max(0, Math.min(1, proj.alpha));
      const zoeEl = zoeRef.current;
      if (zoeEl) {
        if (proj.zoe.visible && baseAlpha > 0.02) {
          zoeEl.style.opacity = String(baseAlpha);
          zoeEl.style.transform = `translate3d(${proj.zoe.x.toFixed(1)}px, ${proj.zoe.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        } else {
          zoeEl.style.opacity = '0';
        }
      }

      for (const id of NPC_ORDER) {
        const el = landRefs.current[id];
        const p = proj.lands[id];
        if (!el) continue;
        if (p && p.visible && baseAlpha > 0.02) {
          el.style.opacity = String(baseAlpha);
          el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        } else {
          el.style.opacity = '0';
        }
      }
    };

    return () => {
      projectHandlerRef.current = null;
    };
  }, [projectHandlerRef]);

  // Keyboard +/- zoom shortcuts while in Sky View
  useEffect(() => {
    if (!isInteractive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        onZoomStep(1);
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        onZoomStep(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInteractive, onZoomStep]);

  const computeCenterAndDist = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 0) return { center: null, dist: null };
    if (pts.length === 1) return { center: { x: pts[0].x, y: pts[0].y }, dist: null };
    const a = pts[0];
    const b = pts[1];
    return {
      center: { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 },
      dist: Math.hypot(b.x - a.x, b.y - a.y),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { center, dist } = computeCenterAndDist();
    lastPanCenterRef.current = center;
    lastPinchDistRef.current = dist;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteractive || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { center, dist } = computeCenterAndDist();

    if (center && lastPanCenterRef.current) {
      const dx = center.x - lastPanCenterRef.current.x;
      const dy = center.y - lastPanCenterRef.current.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        onPanScreen(dx, dy);
      }
    }
    if (dist != null && lastPinchDistRef.current != null && lastPinchDistRef.current > 10) {
      const ratio = lastPinchDistRef.current / Math.max(10, dist);
      if (Math.abs(ratio - 1) > 0.004) {
        onZoomFactor(ratio);
      }
    }

    lastPanCenterRef.current = center;
    lastPinchDistRef.current = dist;
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId);
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer already released
    }
    const { center, dist } = computeCenterAndDist();
    lastPanCenterRef.current = center;
    lastPinchDistRef.current = dist;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    onZoomFactor(factor);
  };

  const nextPrincess = nextNPC ? PRINCESSES[nextNPC] : null;

  return (
    <div
      className="fixed inset-0 z-30 select-none overflow-hidden"
      role="dialog"
      aria-label="Sky View Kingdom Map"
    >
      {/* Full-viewport pan & pinch surface */}
      <div
        className={`absolute inset-0 touch-none ${
          isInteractive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onWheel={handleWheel}
      />

      {/* Projected 3D Map Labels Layer (pointer-events-none so dragging works everywhere) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 10 Princess Land Labels */}
        {NPC_ORDER.map((id) => {
          const def = PRINCESSES[id];
          if (!def) return null;
          const isDone = doneLands.includes(id);
          const isNext = nextNPC === id;
          const icon = LAND_ICONS[id] || '✨';

          return (
            <div
              key={id}
              ref={(el) => {
                landRefs.current[id] = el;
              }}
              style={{ opacity: 0, willChange: 'transform, opacity' }}
              className={`absolute top-0 left-0 flex flex-col items-center ${
                isNext ? 'z-20' : 'z-10'
              }`}
            >
              <div
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 whitespace-nowrap font-extrabold text-sm sm:text-base transition-shadow ${
                  isNext
                    ? 'bg-amber-50 border-amber-400 text-purple-950 shadow-[0_0_24px_rgba(251,191,36,0.92),0_4px_12px_rgba(88,28,135,0.22)] ring-4 ring-amber-300/70'
                    : isDone
                      ? 'bg-emerald-50/95 border-emerald-400 text-emerald-950 shadow-md'
                      : 'bg-white/95 border-[#ebd373] text-purple-950 shadow-md'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {icon}
                </span>
                <span className="leading-tight">{def.name}</span>
                {isDone && (
                  <span
                    className="text-base leading-none ml-0.5"
                    aria-label="Complete"
                    title="Complete"
                  >
                    ✅
                  </span>
                )}
                {isNext && !isDone && (
                  <span className="text-xs font-black text-amber-900 bg-amber-300/90 px-1.5 py-0.5 rounded-md ml-0.5">
                    Next
                  </span>
                )}
              </div>
              <div
                className={`w-2.5 h-2.5 rotate-45 -mt-1.5 border-r-2 border-b-2 ${
                  isNext
                    ? 'bg-amber-50 border-amber-400'
                    : isDone
                      ? 'bg-emerald-50 border-emerald-400'
                      : 'bg-white border-[#ebd373]'
                }`}
                aria-hidden="true"
              />
            </div>
          );
        })}

        {/* Zoe's Pulsing Pink "You are here" Marker */}
        <div
          ref={zoeRef}
          style={{ opacity: 0, willChange: 'transform, opacity' }}
          className="absolute top-0 left-0 z-30 flex flex-col items-center"
        >
          <div className="bg-pink-600 text-white font-black text-xs sm:text-sm px-3 py-1 rounded-full border-2 border-white shadow-lg whitespace-nowrap mb-1.5">
            You are here
          </div>
          <div className="relative flex items-center justify-center w-8 h-8">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-pink-400/75 motion-safe:animate-ping"
              aria-hidden="true"
            />
            <span
              className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-500 border-[3px] border-white shadow-[0_0_16px_rgba(236,72,153,0.9)] text-[11px] leading-none"
              aria-hidden="true"
            >
              👑
            </span>
          </div>
        </div>
      </div>

      {/* Top Header Banner (lightweight, non-obtrusive) */}
      <div className="fixed top-3 left-3 right-3 z-40 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 border-2 border-[#ebd373] shadow-lg rounded-2xl px-4 py-2 flex items-center gap-2 text-purple-950">
          <span className="text-2xl leading-none" aria-hidden="true">
            🗺️
          </span>
          <div className="leading-tight">
            <div className="font-black text-base sm:text-lg">Sky View</div>
            <div className="text-xs sm:text-sm font-bold text-purple-800/80">
              Drag or use arrows to look around
            </div>
          </div>
        </div>

        {nextPrincess && (
          <div className="bg-amber-50/95 border-2 border-amber-300 shadow-md rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-extrabold text-purple-950 flex items-center gap-1.5">
            <span aria-hidden="true">✨</span>
            <span>
              Next: <strong className="text-amber-900">{nextPrincess.name}</strong> ({nextPrincess.landName})
            </span>
          </div>
        )}
      </div>

      {/* Bottom Controls: Big "Back to Zoe" button + Kid-Friendly +/- Zoom Buttons */}
      <div className="fixed bottom-4 sm:bottom-6 inset-x-3 sm:inset-x-6 z-40 flex items-end justify-between gap-3 pointer-events-none">
        <div className="w-[60px] hidden sm:block" aria-hidden="true" />

        <button
          type="button"
          onClick={onClose}
          disabled={mode === 'exiting'}
          className="pointer-events-auto mx-auto min-h-[64px] min-w-[210px] px-7 py-3.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 hover:brightness-105 text-white font-black text-xl sm:text-2xl border-4 border-white shadow-2xl ring-4 ring-purple-900/20 flex items-center justify-center gap-2.5 active:scale-95 transition-transform cursor-pointer disabled:opacity-75 whitespace-nowrap shrink-0"
          aria-label="Back to Zoe"
          title="Back to Zoe (M or Esc)"
        >
          <span aria-hidden="true">👑</span>
          <span>Back to Zoe</span>
        </button>

        {/* Big +/- Zoom Buttons */}
        <div className="pointer-events-auto flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onZoomStep(1)}
            disabled={!isInteractive}
            className="min-w-[60px] min-h-[60px] w-[60px] h-[60px] rounded-full bg-white/95 hover:bg-amber-50 border-3 border-[#ebd373] shadow-lg text-3xl font-black text-purple-950 flex items-center justify-center active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
            aria-label="Zoom In"
            title="Zoom In (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onZoomStep(-1)}
            disabled={!isInteractive}
            className="min-w-[60px] min-h-[60px] w-[60px] h-[60px] rounded-full bg-white/95 hover:bg-amber-50 border-3 border-[#ebd373] shadow-lg text-3xl font-black text-purple-950 flex items-center justify-center active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
            aria-label="Zoom Out"
            title="Zoom Out (-)"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};
