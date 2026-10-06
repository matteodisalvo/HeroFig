import type { ReactNode } from 'react';

/** Icone a tratto 16×16 disegnate qui, per non dipendere da librerie esterne. */
const ICONS = {
  user: <path d="M8 2a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5z M2.5 14v-1a5.5 4 0 0 1 11 0v1" />,
  new: <path d="M4 1.5h5.5L13 5v9.5H4z M9.5 1.5V5H13" />,
  open: <path d="M1.5 4.5h4l1.5 1.5h7.5v7.5h-13z M1.5 6.5h13" />,
  save: <path d="M2.5 2.5h9l2 2v9h-11z M5 2.5v3.5h5V2.5 M5 13.5V9h6v4.5" />,
  example: <path d="M2 3.5h4v3H2z M10 3.5h4v3h-4z M6 5h4 M8 9.5h4v3H8z M12 6.5v3" />,
  undo: <path d="M5.5 3 2.5 6l3 3 M2.5 6h7a4 4 0 0 1 0 8h-3" />,
  redo: <path d="M10.5 3l3 3-3 3 M13.5 6h-7a4 4 0 0 0 0 8h3" />,
  minus: <path d="M3.5 8h9" />,
  plus: <path d="M8 3.5v9 M3.5 8h9" />,
  fit: <path d="M2 5.5V2h3.5 M10.5 2H14v3.5 M14 10.5V14h-3.5 M5.5 14H2v-3.5" />,
  focus: <path d="M2 5V2h3 M11 2h3v3 M14 11v3h-3 M5 14H2v-3 M5.5 5.5h5v5h-5z" />,
  group: <path d="M1.5 1.5h13v13h-13z M4.5 5h3v3h-3z M9 8.5h2.5v3H9z" strokeDasharray="2 1.5" />,
  copy: <path d="M5.5 5.5h8v8h-8z M10.5 5.5v-3h-8v8h3" />,
  image: <path d="M2 3h12v10H2z M2 11l3.5-3.5 3 3 2-2L14 12 M10.5 6.2a.7.7 0 1 0 0 .1" />,
  help: <path d="M6 6a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6 M8 11.5v.5 M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z" />,
  comment: <path d="M2 2.5h12v9H6l-4 3z M5 5.5h6 M5 8h4" />,
  search: <path d="M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9z M10.3 10.3l3.7 3.7" />,
  close: <path d="M4 4l8 8 M12 4l-8 8" />,
  chevron: <path d="M6 4l4 4-4 4" />,
  chevronDown: <path d="M4 6l4 4 4-4" />,
  star: <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  clock: <path d="M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M8 4.5V8l2.5 1.5" />,
  blocks: <path d="M2 2h5v5H2z M9 2h5v5H9z M2 9h5v5H2z M9 9h5v5H9z" />,
  template: <path d="M1.5 2.5h13v11h-13z M4 6h3v4H4z M9 6h3v4H9z M7 8h2" />,
  trash: <path d="M2.5 4h11 M6 4V2.5h4V4 M4 4l.7 9.5h6.6L12 4 M6.7 6.5v4.5 M9.3 6.5v4.5" />,
  duplicate: <path d="M5.5 5.5h8v8h-8z M10.5 5.5v-3h-8v8h3 M9.5 7.5v4 M7.5 9.5h4" />,
  doc: <path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3 M5.5 8h5 M5.5 10.5h5" />,
  edge: <path d="M2 12.5C6 12.5 6 3.5 11 3.5 M9 1.5l2.5 2-2 2.4" />,
  text: <path d="M3 3.5h10 M8 3.5v9.5 M6 13h4" />,
  front: <path d="M5.5 5.5h8v8h-8z M2.5 10.5v-8h8" fill="currentColor" fillOpacity={0.15} />,
  back: <path d="M2.5 2.5h8v8h-8z M13.5 5.5v8h-8" fill="currentColor" fillOpacity={0.15} />,
  sun: <path d="M8 5a3 3 0 1 1 0 6a3 3 0 0 1 0-6z M8 1v1.5 M8 13.5V15 M1 8h1.5 M13.5 8H15 M3 3l1 1 M12 12l1 1 M3 13l1-1 M12 4l1-1" />,
  moon: <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />,
  monitor: <path d="M1.5 2.5h13v9h-13z M5.5 14h5 M8 11.5V14" />,
  check: <path d="M3 8.5l3 3 7-7" />,
  info: <path d="M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M8 7v4.5 M8 4.5v.5" />,
  alignLeft: <path d="M2.5 1.5v13 M5 4h8v3H5z M5 9.5h5v3H5z" />,
  alignHCenter: <path d="M8 1.5v13 M3.5 4h9v3h-9z M5 9.5h6v3H5z" />,
  alignRight: <path d="M13.5 1.5v13 M3 4h8v3H3z M6 9.5h5v3H6z" />,
  alignTop: <path d="M1.5 2.5h13 M4 5h3v8H4z M9.5 5h3v5h-3z" />,
  alignVCenter: <path d="M1.5 8h13 M4 3.5h3v9H4z M9.5 5h3v6h-3z" />,
  alignBottom: <path d="M1.5 13.5h13 M4 3h3v8H4z M9.5 6h3v5h-3z" />,
  distH: <path d="M1.5 2v12 M14.5 2v12 M4.5 5h2.5v6H4.5z M9 5h2.5v6H9z" />,
  distV: <path d="M2 1.5h12 M2 14.5h12 M5 4.5h6V7H5z M5 9h6v2.5H5z" />,
  matchW: <path d="M3 2.5h10v3.5H3z M3 10h10v3.5H3z M1.5 8h13 M3.5 6.8 1.5 8l2 1.2 M12.5 6.8l2 1.2-2 1.2" />,
  matchH: <path d="M2.5 3h3.5v10H2.5z M10 3h3.5v10H10z M8 1.5v13 M6.8 3.5 8 1.5l1.2 2 M6.8 12.5 8 14.5l1.2-2" />,
  textLeft: <path d="M2.5 4h11 M2.5 7h7 M2.5 10h11 M2.5 13h7" />,
  textCenter: <path d="M2.5 4h11 M4.5 7h7 M2.5 10h11 M4.5 13h7" />,
  textRight: <path d="M2.5 4h11 M6.5 7h7 M2.5 10h11 M6.5 13h7" />,
  ortho: <path d="M2 13h5V3h7 M11.5 1l2.5 2-2.5 2" />,
  straight: <path d="M2.5 13.5 13 3 M9 2.5h4.5V7" />,
  curve: <path d="M2 13c0-7 5-10 11-10 M10.5 1l2.5 2-2.5 2" />,
  arrowEnd: <path d="M1.5 8h11 M9.5 5l3 3-3 3" />,
  arrowStart: <path d="M3.5 8h11 M6.5 5l-3 3 3 3" />,
  dashed: <path d="M1.5 8h2.5 M6.5 8h3 M12 8h2.5" />,
  none: <path d="M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M3.5 12.5l9-9" />,
  reset: <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9 M2.5 2.5v3h3" />,
  sidebarLeft: <path d="M1.5 2.5h13v11h-13z M6 2.5v11 M3 5h1.5 M3 7.5h1.5" />,
  sidebarRight: <path d="M1.5 2.5h13v11h-13z M10 2.5v11 M11.5 5H13 M11.5 7.5H13" />,
  swap: <path d="M2.5 5h10 M10 2.5 12.5 5 10 7.5 M13.5 11h-10 M6 8.5 3.5 11 6 13.5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === 'star' && className?.includes('filled');
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
