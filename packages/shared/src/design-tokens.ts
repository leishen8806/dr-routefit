export const designTokens = {
  color: {
    navy: '#0B2545',
    navyRaised: '#173A61',
    teal: '#13C29B',
    amber: '#F5A623',
    ink: '#10243E',
    muted: '#59697A',
    background: '#F3F5F7',
    surface: '#FFFFFF',
    line: '#D9E1E8',
  },
  type: {
    latin: 'IBM Plex Sans',
    cjk: 'Noto Sans SC',
    khmer: 'Noto Sans Khmer',
    size: { caption: 12, small: 14, body: 16, lead: 20, title: 32, display: 48 },
    weight: { regular: 400, medium: 500, semibold: 600 },
  },
  space: { x1: 4, x2: 8, x3: 12, x4: 16, x6: 24, x8: 32, x12: 48, x18: 72, x24: 96 },
  radius: { small: 6, medium: 10, large: 16 },
  motion: { quick: 120, standard: 180 },
  platform: {
    web: {
      fontFamily: 'IBM Plex Sans, Noto Sans SC, Noto Sans Khmer, sans-serif',
    },
    native: {
      fontFamily: ['IBM Plex Sans', 'Noto Sans SC', 'Noto Sans Khmer'],
    },
  },
} as const;
