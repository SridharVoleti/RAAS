import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#1a0f00',
          card: '#120a00',
          gold: '#f0b429',
          'gold-secondary': '#c8973a',
          'gold-muted': '#a07030',
          border: '#3a2800',
          success: '#5dca85',
          error: '#c0392b',
          body: '#f5e6c8',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #1a0f00 0%, #2d1500 50%, #1a0f00 100%)',
      },
    },
  },
  plugins: [],
}

export default config
