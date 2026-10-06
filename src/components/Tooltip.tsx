import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { keys } from '../os';

interface Tip {
  text: string;
  keys?: string;
  x: number;
  y: number;
  above: boolean;
}

const DELAY = 450;
/** Dopo un tooltip, quelli vicini compaiono subito (come nelle barre degli strumenti di macOS). */
const WARM_MS = 600;

/**
 * Tooltip unico per tutta l'interfaccia: qualsiasi elemento con `data-tip`
 * (e facoltativamente `data-keys` per la scorciatoia) lo mostra al passaggio del mouse.
 */
export function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    let warmUntil = 0;
    const show = (el: HTMLElement) => {
      if (!el.isConnected || !el.dataset.tip) return;
      const r = el.getBoundingClientRect();
      const above = r.bottom + 44 > window.innerHeight || el.dataset.tipPlace === 'above';
      setTip({ text: keys(el.dataset.tip), keys: el.dataset.keys && keys(el.dataset.keys), x: r.left + r.width / 2, y: above ? r.top - 6 : r.bottom + 6, above });
    };
    const hide = () => {
      clearTimeout(timer);
      if (current) warmUntil = Date.now() + WARM_MS;
      current = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-tip]') ?? null;
      if (el === current) return;
      hide();
      if (!el) return;
      current = el;
      timer = setTimeout(() => show(el), Date.now() < warmUntil ? 60 : DELAY);
    };
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };
    const down = () => {
      hide();
      warmUntil = 0;
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', down, true);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    document.addEventListener('dragstart', down, true);
    window.addEventListener('blur', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', down, true);
      document.removeEventListener('wheel', hide, true);
      document.removeEventListener('dragstart', down, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // resta dentro la finestra anche per i pulsanti vicino ai bordi
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const half = el.offsetWidth / 2;
    const margin = 8;
    setShift(Math.min(0, window.innerWidth - margin - (tip.x + half)) + Math.max(0, margin - (tip.x - half)));
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={ref}
      className={tip.above ? 'tooltip above' : 'tooltip'}
      role="tooltip"
      style={{ left: tip.x + shift, top: tip.y }}
    >
      <span>{tip.text}</span>
      {tip.keys && <kbd>{tip.keys}</kbd>}
    </div>
  );
}
