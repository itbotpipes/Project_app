"use client";

import { useEffect, useState } from "react";

const CONFETTI_EMOJI = ["🎉", "✨", "⭐", "🎊", "🚀"];

export default function Celebration({ name }: { name: string }) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; emoji: string }[]>([]);

  useEffect(() => {
    setConfetti(
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
      })),
    );
    const t = setTimeout(() => setShowOverlay(false), 3600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {showOverlay && (
        <div
          className="animate-overlayFade fixed inset-0 z-[100] grid place-items-center bg-slate-900/70"
          onClick={() => setShowOverlay(false)}
        >
          {confetti.map((c) => (
            <span
              key={c.id}
              className="animate-confetti pointer-events-none absolute top-0 text-2xl"
              style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: "2.4s" }}
            >
              {c.emoji}
            </span>
          ))}
          <div className="flex flex-col items-center gap-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo2.jpeg"
              alt="Northern Star"
              className="animate-logoSpinIn h-20 w-auto object-contain drop-shadow-2xl"
            />
            <div>
              <div className="text-2xl font-bold text-white">Voilà, {name}! 🎉</div>
              <div className="mt-1 text-white/90">
                You&apos;ve completed all your tasks today. Good job — take a well-earned rest!
              </div>
            </div>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="animate-pop relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-pink-500 to-violet-600 p-5 text-white shadow">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-3 top-2 text-white/80 hover:text-white"
            aria-label="dismiss"
          >
            ×
          </button>
          <div className="flex items-center gap-3">
            <span className="animate-floatUp text-3xl">🎉</span>
            <div>
              <div className="text-lg font-bold">You&apos;re a star, {name}! ✨</div>
              <div className="text-sm text-white/90">
                All of today&apos;s tasks are done. Shakalaka boom boom — go enjoy your day!
              </div>
            </div>
            <span className="animate-floatUp ml-auto text-3xl">🚀</span>
          </div>
        </div>
      )}
    </>
  );
}
