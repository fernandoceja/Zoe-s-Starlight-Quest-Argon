import React, { useRef, useState, useEffect } from 'react';
import { Input } from '../game/input.js';

const HINT_STORAGE_KEY = 'zsq_joystick_hint_seen_v1';

export const VirtualJoystick: React.FC = () => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const radius = 48; // Max radius in px

  // Show a short "Drag to walk" hint for the first 10 seconds of the first play
  useEffect(() => {
    let seen = false;
    try {
      seen = !!window.localStorage.getItem(HINT_STORAGE_KEY);
    } catch {
      seen = false;
    }
    if (!seen) {
      setShowHint(true);
      const timer = window.setTimeout(() => {
        setShowHint(false);
        try {
          window.localStorage.setItem(HINT_STORAGE_KEY, '1');
        } catch {
          // Ignore storage errors
        }
      }, 10000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const resetJoystick = () => {
    pointerIdRef.current = null;
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    Input.setJoystick(0, 0);
  };

  useEffect(() => {
    return () => {
      Input.setJoystick(0, 0);
    };
  }, []);

  const updateKnob = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let kx = dx;
    let ky = dy;

    if (dist > radius) {
      kx = (dx / dist) * radius;
      ky = (dy / dist) * radius;
    }

    setKnobPos({ x: kx, y: ky });

    // Normalize -1 to 1 for 3D world (screen up = -Z)
    const normX = kx / radius;
    const normZ = ky / radius;
    Input.setJoystick(normX, normZ);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dismissHint();
    pointerIdRef.current = e.pointerId;
    setActive(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    resetJoystick();
  };

  return (
    <div className="fixed bottom-5 left-5 z-20 pointer-events-auto touch-none select-none flex flex-col items-center gap-1.5">
      {showHint && (
        <div className="px-3 py-1 rounded-full bg-white/95 border-2 border-[#ebd373] shadow-md text-sm font-black text-amber-950 whitespace-nowrap pointer-events-none">
          Drag to walk 👆
        </div>
      )}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        aria-label="Walk joystick — drag to move Princess Zoe"
        className={`w-32 h-32 rounded-full bg-white/85 border-4 border-[#ebd373] shadow-lg flex items-center justify-center relative transition-transform touch-none select-none ${
          active ? 'scale-95 cursor-grabbing ring-4 ring-amber-300/60' : 'cursor-grab'
        }`}
      >
        {/* Subtle Directional Arrow Marks around the Ring */}
        <span
          aria-hidden="true"
          className="absolute top-1.5 left-1/2 -translate-x-1/2 text-xs font-black text-amber-700/80 pointer-events-none leading-none"
        >
          ▲
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xs font-black text-amber-700/80 pointer-events-none leading-none"
        >
          ▼
        </span>
        <span
          aria-hidden="true"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-amber-700/80 pointer-events-none leading-none"
        >
          ◀
        </span>
        <span
          aria-hidden="true"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-amber-700/80 pointer-events-none leading-none"
        >
          ▶
        </span>

        {/* Joystick Center Indicator */}
        <div className="w-4 h-4 rounded-full bg-amber-200 pointer-events-none" />

        {/* Larger Movable Knob */}
        <div
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
          className="absolute w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-3 border-white shadow-md pointer-events-none flex items-center justify-center text-xl font-black text-amber-950"
        >
          👑
        </div>
      </div>
    </div>
  );
};
