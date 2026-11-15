import type { ReactNode } from 'react'

interface Props {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
}

// Lucide-inspired local icon set. Existing <Icon name="..." /> calls stay unchanged.
const paths: Record<string, ReactNode> = {
  doc: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.6 9.6 0 0 1-4-.9L3 21l1.9-4A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  alert: <><path d="m10.3 3.9-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  flag: <path d="M5 21V4h10l-2 4 2 4H5" />,
  tag: <><path d="M12.6 2.8 21 11.2a2 2 0 0 1 0 2.8l-7 7a2 2 0 0 1-2.8 0l-8.4-8.4A2 2 0 0 1 2.2 11V4a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.8Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
  archive: <><path d="M4 7h16v13H4z" /><path d="M3 4h18v3H3zM9 11h6" /></>,
  restore: <><path d="M4 7h16v13H4z" /><path d="M3 4h18v3H3zM8 14a4 4 0 1 0 1-3" /><path d="M8 9v3h3" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" /></>,
  panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M14 9l-3 3 3 3" /></>,
  panelRight: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18M10 9l3 3-3 3" /></>,
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  collapse: <path d="m9 14 3-3 3 3M9 10l3 3 3-3" />,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-4M15 21h4a2 2 0 0 0 2-2" /></>,
  arrowLeft: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m9 7 1-3h4l1 3M6 7l1 14h10l1-14" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  eye: <><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 19v-5h-5" /></>,
  warning: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.5h.01" /></>,
  bold: <path d="M7 5h5a4 4 0 0 1 0 8H7zm0 8h6a4 4 0 0 1 0 8H7z" />,
  italic: <path d="M10 5h8M6 19h8M14 5 10 19" />,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l1.5-1.5a5 5 0 0 0-7-7L11 6" /><path d="M14 11a5 5 0 0 0-7.5-.5L5 12a5 5 0 0 0 7 7l1-1" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  listOrdered: <><path d="M10 6h11M10 12h11M10 18h11" /><path d="M4 5h1v4M4 9h2M6 15H4l2 2-2 2h2M4 12h2" /></>,
  summary: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  code: <><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" /></>,
  grip: <><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" /></>,
}

export default function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.7 }: Props) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">{paths[name] || paths.doc}</svg>
}
