import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../i18n';
import { WELCOME_SLOT_MS, welcomeFrame, welcomeSequence } from './welcome-cloud';

const SATELLITES = [
  { x: 145, y: 45, width: 200, size: 18 },
  { x: 432, y: 42, width: 190, size: 17 },
  { x: 64, y: 83, width: 100, size: 14 },
  { x: 544, y: 84, width: 90, size: 14 },
  { x: 145, y: 186, width: 205, size: 18 },
  { x: 442, y: 187, width: 205, size: 17 },
  { x: 300, y: 211, width: 180, size: 14 },
];

/** Whole text runs retain Arabic/Indic shaping as the cloud resolves. */
export function WelcomeCloud({ language = 'it' }: { language?: Language }) {
  const sequence = useMemo(() => welcomeSequence(language), [language]);
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<SVGSVGElement>(null);
  const words = useRef<SVGGElement>(null);
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const turbulence = useRef<SVGFETurbulenceElement>(null);
  const mist = useRef<SVGGElement>(null);
  const id = useId();
  const greeting = sequence[index % sequence.length];
  const diffusionId = `${id}-diffusion`, glowId = `${id}-glow`, inkId = `${id}-ink`, cloudId = `${id}-cloud`;

  useLayoutEffect(() => {
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      scene.current?.querySelectorAll<SVGTextElement>('[data-fit-width]').forEach((text) => {
        const size = Number(text.dataset.fontSize);
        text.setAttribute('font-size', String(size));
        const factor = Math.min(1, Number(text.dataset.fitWidth) / Math.max(1, text.getComputedTextLength()));
        text.setAttribute('font-size', String(size * factor));
      });
    };
    fit();
    void document.fonts.ready.then(fit);
    return () => { disposed = true; };
  }, [index, sequence]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches;
    let disposed = false;
    let elapsed = 0;
    let previous: number | null = null;
    let frame = 0;
    let timer = 0;
    let active = -1;
    let lastPaint = -Infinity;

    const cancel = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = timer = 0;
    };
    const advance = (now: number) => {
      if (previous !== null) elapsed = (elapsed + Math.max(0, now - previous)) % (sequence.length * WELCOME_SLOT_MS);
      previous = now;
    };
    const paint = () => {
      const state = welcomeFrame(elapsed, sequence.length);
      if (active !== state.index) {
        active = state.index;
        setIndex(active);
      }
      const diffusion = reduced ? 0 : state.diffusion;
      words.current?.setAttribute('opacity', String(reduced ? 1 : state.opacity));
      blur.current?.setAttribute('stdDeviation', String(diffusion * 14));
      displacement.current?.setAttribute('scale', String(diffusion * 115));
      turbulence.current?.setAttribute('baseFrequency', `${0.008 + Math.sin(elapsed / 2100) * 0.0015} 0.025`);
      mist.current?.setAttribute('opacity', String(reduced ? 0.12 : 0.12 + diffusion * 0.35));
      if (root.current) {
        root.current.dataset.paused = String(document.hidden || reduced);
        root.current.dataset.reducedMotion = String(reduced);
      }
    };
    const schedule = () => {
      if (disposed || document.hidden) return;
      if (reduced) timer = window.setTimeout(() => tick(performance.now()), WELCOME_SLOT_MS - elapsed % WELCOME_SLOT_MS);
      else frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      frame = timer = 0;
      if (disposed || document.hidden) return;
      advance(now);
      // Filters repaint at at most 30 fps; the clock still follows actual time.
      if (reduced || now - lastPaint >= 1000 / 30) {
        paint();
        lastPaint = now;
      }
      schedule();
    };
    const resume = () => {
      previous = document.hidden ? null : performance.now();
      paint();
      schedule();
    };
    const visibility = () => {
      if (document.hidden) advance(performance.now());
      cancel();
      previous = null;
      if (document.hidden) {
        if (root.current) root.current.dataset.paused = 'true';
      } else resume();
    };
    const changeMotion = () => {
      if (!document.hidden) advance(performance.now());
      reduced = motion.matches;
      cancel();
      resume();
    };

    motion.addEventListener('change', changeMotion);
    document.addEventListener('visibilitychange', visibility);
    resume();
    return () => {
      disposed = true;
      cancel();
      motion.removeEventListener('change', changeMotion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [sequence]);

  const mainText = (
    <text x="300" y="123" lang={greeting.language} direction={greeting.language === 'ar' ? 'rtl' : 'ltr'}
      data-fit-width="510" data-font-size="74" fontSize="74" fontWeight="650" fill={`url(#${inkId})`}>
      {greeting.text}
    </text>
  );

  return (
    <div className="welcome-cloud" ref={root} aria-hidden="true">
      <div className="welcome-cloud-haze" />
      <svg className="welcome-cloud-scene" ref={scene} viewBox="0 0 600 240" direction="ltr" focusable="false">
        <defs>
          <linearGradient id={inkId} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#e1e8ff" />
            <stop offset="1" stopColor="#b8a6f6" />
          </linearGradient>
          <filter id={diffusionId} filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="440" colorInterpolationFilters="sRGB">
            <feTurbulence ref={turbulence} type="fractalNoise" baseFrequency="0.008 0.025" numOctaves="2" seed="17" result="noise" />
            <feDisplacementMap ref={displacement} in="SourceGraphic" in2="noise" scale="115" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur ref={blur} stdDeviation="14" />
          </filter>
          <filter id={glowId} x="-40%" y="-100%" width="180%" height="300%">
            <feGaussianBlur stdDeviation="17" />
          </filter>
          <filter id={cloudId} x="-20%" y="-60%" width="140%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="5" result="cloud" />
            <feDisplacementMap in="SourceGraphic" in2="cloud" scale="65" />
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <g className="welcome-cloud-flow" filter={`url(#${cloudId})`} fill="none" strokeLinecap="round">
          <path d="M-80 165 C100 220 150 46 300 112 S480 208 660 59" stroke="#578fea" strokeWidth="45" opacity="0.25" />
          <path d="M-50 72 C120 -4 215 192 356 124 S484 10 669 132" stroke="#aa78e0" strokeWidth="52" opacity="0.26" />
        </g>
        <g ref={words} opacity="0" className="welcome-cloud-words" textAnchor="middle" dominantBaseline="middle">
          <g ref={mist} filter={`url(#${glowId})`} opacity="0.2">{mainText}</g>
          <g filter={`url(#${diffusionId})`}>
            {mainText}
            {SATELLITES.map((position, offset) => {
              const word = sequence[(index + offset + 1) % sequence.length];
              return <text key={offset} x={position.x} y={position.y} lang={word.language}
                direction={word.language === 'ar' ? 'rtl' : 'ltr'} data-fit-width={position.width} data-font-size={position.size}
                fontSize={position.size} fontWeight="500" fill={offset % 2 ? '#c9b6f2' : '#a9c9ed'} opacity="0.65">{word.text}</text>;
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
