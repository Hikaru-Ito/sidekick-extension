import type { Config } from 'tailwindcss';
import preset from '@sidekick/config/tailwind';

export default {
  presets: [preset as Config],
  content: ['./src/**/*.{astro,html,ts,tsx,mdx}', '../../packages/ui-kit/src/**/*.{ts,tsx}'],
} satisfies Config;
