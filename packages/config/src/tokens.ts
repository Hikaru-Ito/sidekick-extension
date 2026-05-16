/**
 * Sidekick Design Tokens
 *
 * 設計思想: ニュートラルなzincベース + 単一アクセント (Iris / 紫青系)。
 * MobbinリサーチでFireflies/Whop/Origin/Xに共通する「シンプル × 柔らかい階層」を踏襲。
 */

export const colors = {
  // Brand accent — Iris (青紫): productivity tool らしい知性 + 中立性
  iris: {
    50: '#eef1ff',
    100: '#e0e6ff',
    200: '#c7d0fe',
    300: '#a4b1fc',
    400: '#8089f8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Neutral palette — zinc を基調 (Tailwind zincと同等)
  zinc: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },
  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
} as const;

export const radii = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
} as const;

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const fonts = {
  sans: [
    'Inter Variable',
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'sans-serif',
  ].join(', '),
  mono: [
    '"JetBrains Mono"',
    '"Fira Code"',
    'Menlo',
    'Monaco',
    'Consolas',
    'monospace',
  ].join(', '),
} as const;

export const fontSizes = {
  xs: ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
  sm: ['13px', { lineHeight: '18px' }],
  base: ['14px', { lineHeight: '20px' }],
  md: ['15px', { lineHeight: '22px' }],
  lg: ['16px', { lineHeight: '24px' }],
  xl: ['18px', { lineHeight: '26px' }],
  '2xl': ['22px', { lineHeight: '30px', letterSpacing: '-0.01em' }],
  '3xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
  '4xl': ['36px', { lineHeight: '42px', letterSpacing: '-0.025em' }],
  '5xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.03em' }],
  '6xl': ['60px', { lineHeight: '68px', letterSpacing: '-0.035em' }],
} as const;

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.06)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.18)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  glow: '0 0 0 4px rgb(99 102 241 / 0.12)',
} as const;

export const durations = {
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
} as const;

export const easings = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const popup = {
  width: '380px',
  maxHeight: '600px',
} as const;
