import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import { colors, durations, easings, fonts, fontSizes, radii, shadows, spacing } from './tokens';

const preset = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      colors: {
        // Semantic aliases
        accent: colors.iris,
        neutral: colors.zinc,
        success: { DEFAULT: colors.success },
        warning: { DEFAULT: colors.warning },
        danger: { DEFAULT: colors.danger },
        info: { DEFAULT: colors.info },
        // CSS-variable surfaces (set in app stylesheet for light/dark)
        surface: 'rgb(var(--sk-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--sk-surface-muted) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--sk-surface-elevated) / <alpha-value>)',
        border: 'rgb(var(--sk-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--sk-border-strong) / <alpha-value>)',
        'fg-default': 'rgb(var(--sk-fg-default) / <alpha-value>)',
        'fg-muted': 'rgb(var(--sk-fg-muted) / <alpha-value>)',
        'fg-subtle': 'rgb(var(--sk-fg-subtle) / <alpha-value>)',
        'fg-on-accent': 'rgb(var(--sk-fg-on-accent) / <alpha-value>)',
      },
      borderRadius: radii as unknown as Record<string, string>,
      spacing: spacing as unknown as Record<string, string>,
      fontFamily: {
        sans: fonts.sans.split(', '),
        mono: fonts.mono.split(', '),
      },
      fontSize: fontSizes as unknown as Config['theme'],
      boxShadow: shadows as unknown as Record<string, string>,
      transitionDuration: durations as unknown as Record<string, string>,
      transitionTimingFunction: easings as unknown as Record<string, string>,
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-up': 'fade-in-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Partial<Config>;

export default preset;
