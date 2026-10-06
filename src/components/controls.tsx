import { t as tr } from '../i18n';
// Controlli del pannello proprietà. Con più elementi selezionati i valori diversi
// sono mostrati come "misto" (undefined) invece di quelli del primo elemento.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export const MIXED = 'Misto';

/** Seleziona tutto al focus, anche quando il focus arriva da un clic (il mouseup altrimenti deseleziona). */
function useSelectOnFocus() {
  const fresh = useRef(false);
  return {
    onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => {
      fresh.current = document.activeElement !== e.currentTarget;
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (fresh.current) {
        e.preventDefault();
        e.currentTarget.select();
      }
      fresh.current = false;
    },
  };
}

// ---------- sezioni richiudibili, ricordate fra le sessioni ----------

const PANELS_KEY = 'mlsketch:inspector-collapsed';
let closedPanels: Set<string> = (() => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(PANELS_KEY) ?? '[]'));
  } catch {
    return new Set<string>();
  }
})();

export function Panel(p: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(!closedPanels.has(p.id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    closedPanels = new Set(closedPanels);
    if (next) closedPanels.delete(p.id);
    else closedPanels.add(p.id);
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify([...closedPanels]));
    } catch {
      // comodità: senza storage le sezioni si riaprono al riavvio
    }
  };
  return (
    <section className={open ? 'panel' : 'panel closed'}>
      <header className="panel-head">
        <button className="panel-toggle" onClick={toggle} aria-expanded={open}>
          <Icon name="chevron" size={12} className={open ? 'chevron open' : 'chevron'} />
          {tr(p.title)}
        </button>
      </header>
      {open && <div className="panel-body">{p.children}</div>}
    </section>
  );
}

export function Row({ label, children, tip }: { label: string; children: ReactNode; tip?: string }) {
  return (
    <label className="row">
      <span className="row-label" data-tip={tip ? tr(tip) : undefined}>
        {tr(label)}
      </span>
      <span className="row-control">{children}</span>
    </label>
  );
}

// ---------- numeri ----------

const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
const parse = (s: string) => parseFloat(s.replace(',', '.'));

/**
 * Campo numerico con bozza locale: si può cancellare e riscrivere senza che il
 * valore "rimbalzi"; ↑/↓ cambiano di un passo (con ⇧ di dieci passi).
 */
export function NumInput(p: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}) {
  const [draft, setDraft] = useState(p.value === undefined ? '' : fmt(p.value));
  const focused = useRef(false);
  const selectOnFocus = useSelectOnFocus();
  useEffect(() => {
    if (!focused.current) setDraft(p.value === undefined ? '' : fmt(p.value));
  }, [p.value]);
  const clamp = (v: number) => Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, v));
  const commit = (v: number) => {
    const c = clamp(Math.round(v * 1000) / 1000);
    setDraft(fmt(c));
    p.onChange(c);
  };
  return (
    <span className="num">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={p.value === undefined ? tr(MIXED) : undefined}
        aria-label={p.label ? tr(p.label) : undefined}
        {...selectOnFocus}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(p.value === undefined ? '' : fmt(p.value));
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parse(e.target.value);
          if (Number.isFinite(v) && v >= (p.min ?? -Infinity) && v <= (p.max ?? Infinity)) p.onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const base = Number.isFinite(parse(draft)) ? parse(draft) : (p.value ?? 0);
            commit(base + (e.key === 'ArrowUp' ? 1 : -1) * (p.step ?? 1) * (e.shiftKey ? 10 : 1));
          } else if (e.key === 'Enter') {
            const v = parse(draft);
            if (Number.isFinite(v)) commit(v);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
      />
      {p.unit && <span className="unit">{p.unit}</span>}
    </span>
  );
}

export function Num(p: { label: string; value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string; tip?: string }) {
  return (
    <Row label={p.label} tip={p.tip}>
      <NumInput {...p} />
    </Row>
  );
}

// ---------- scelte ----------

export function Check(p: { label: string; checked: boolean | undefined; onChange: (v: boolean) => void; tip?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = p.checked === undefined;
  }, [p.checked]);
  return (
    <label className="check" data-tip={p.tip ? tr(p.tip) : undefined}>
      <input ref={ref} type="checkbox" checked={!!p.checked} onChange={(e) => p.onChange(e.target.checked)} />
      <span>{tr(p.label)}</span>
    </label>
  );
}

export function Select<T extends string>(p: { label: string; value: T | undefined; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <Row label={p.label}>
      <select value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value as T)}>
        {p.value === undefined && (
          <option value="" disabled>
            {tr(MIXED)}
          </option>
        )}
        {p.options.map(([v, name]) => (
          <option key={v} value={v}>
            {tr(name)}
          </option>
        ))}
      </select>
    </Row>
  );
}

export interface SegOption<T> {
  value: T;
  label?: string;
  icon?: IconName;
  tip?: string;
}

/** Gruppo di pulsanti mutuamente esclusivi (es. allineamento del testo). */
export function Segmented<T extends string>(p: { value: T | undefined; options: SegOption<T>[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={p.label ? tr(p.label) : undefined}>
      {p.options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={p.value === o.value}
          className={p.value === o.value ? 'on' : ''}
          data-tip={o.tip ? tr(o.tip) : undefined}
          aria-label={o.label || !o.tip ? undefined : tr(o.tip)}
          onClick={() => p.onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label && <span>{tr(o.label)}</span>}
        </button>
      ))}
    </div>
  );
}

export function SegRow<T extends string>(p: { label: string; value: T | undefined; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="row">
      <span className="row-label">{tr(p.label)}</span>
      <span className="row-control">
        <Segmented value={p.value} options={p.options} onChange={p.onChange} label={p.label} />
      </span>
    </div>
  );
}

/** Pulsante attivo/disattivo con icona o testo (grassetto, corsivo, tratteggio, punte). */
export function Toggle(p: { on: boolean | undefined; onChange: (v: boolean) => void; icon?: IconName; label?: ReactNode; tip: string }) {
  return (
    <button
      className={`toggle ${p.on ? 'on' : ''} ${p.on === undefined ? 'mixed' : ''}`}
      aria-pressed={!!p.on}
      data-tip={p.tip ? tr(p.tip) : undefined}
      aria-label={tr(p.tip)}
      onClick={() => p.onChange(!p.on)}
    >
      {p.icon && <Icon name={p.icon} size={14} />}
      {typeof p.label === 'string' ? tr(p.label) : p.label}
    </button>
  );
}

// ---------- colori ----------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normHex(s: string): string | null {
  const m = HEX.exec(s.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return '#' + h.toUpperCase();
}

/** Colore: campione cliccabile (selettore di sistema) + codice esadecimale + "nessuno". */
export function ColorField(p: { label: string; value: string | undefined; onChange: (v: string) => void; allowNone?: boolean; quick?: readonly string[] }) {
  const none = p.value === 'none';
  const [draft, setDraft] = useState(p.value && !none ? p.value.toUpperCase() : '');
  const focused = useRef(false);
  const selectOnFocus = useSelectOnFocus();
  useEffect(() => {
    if (!focused.current) setDraft(p.value && p.value !== 'none' ? p.value.toUpperCase() : '');
  }, [p.value]);
  const chip = none || p.value === undefined ? undefined : p.value;
  return (
    <div className="row color-row">
      <span className="row-label">{tr(p.label)}</span>
      <span className="row-control color-field">
        <label className={`color-chip ${none ? 'none' : ''} ${p.value === undefined ? 'mixed' : ''}`} data-tip={tr("Scegli un colore")}>
          <span style={{ background: chip }} />
          <input
            type="color"
            value={chip && /^#[0-9a-f]{6}$/i.test(chip) ? chip : '#ffffff'}
            onChange={(e) => p.onChange(e.target.value.toUpperCase())}
            aria-label={tr("{label}: scegli un colore", { label: tr(p.label) })}
          />
        </label>
        <input
          className="hex"
          type="text"
          value={draft}
          spellCheck={false}
          placeholder={none ? tr('Nessuno') : p.value === undefined ? tr(MIXED) : '#RRGGBB'}
          aria-label={tr("{label}: codice esadecimale", { label: tr(p.label) })}
          {...selectOnFocus}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            setDraft(p.value && p.value !== 'none' ? p.value.toUpperCase() : '');
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const h = normHex(e.target.value);
            if (h && e.target.value.replace('#', '').length === 6) p.onChange(h);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const h = normHex(draft);
              if (h) p.onChange(h);
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              e.currentTarget.blur();
            }
          }}
        />
        {p.allowNone && (
          <button
            className={none ? 'toggle on none-btn' : 'toggle none-btn'}
            aria-pressed={none}
            data-tip={tr(none ? 'Ripristina il colore' : 'Nessun colore')}
            aria-label={tr("Nessun colore")}
            onClick={() => p.onChange(none ? '#FFFFFF' : 'none')}
          >
            <Icon name="none" size={14} />
          </button>
        )}
      </span>
      {p.quick && (
        <span className="quick-colors">
          {p.quick.map((c) => (
            <button
              key={c}
              className={p.value?.toUpperCase() === c.toUpperCase() ? 'on' : ''}
              style={{ background: c }}
              data-tip={c}
              aria-label={c}
              onClick={() => p.onChange(c)}
            />
          ))}
        </span>
      )}
    </div>
  );
}
