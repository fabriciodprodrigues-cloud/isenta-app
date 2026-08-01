import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B1622',
          800: '#122238',
          700: '#1A3050',
        },
        paper: {
          DEFAULT: '#EDF1F3',
          dim: '#B9C6D1',
        },
        slate: {
          DEFAULT: '#7C8FA6',
        },
        green: {
          DEFAULT: '#21C58A',
          dim: '#173B30',
        },
        amber: {
          DEFAULT: '#FFB238',
          dim: '#4A3311',
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', ...defaultTheme.fontFamily.sans],
        body: ['var(--font-ibm-plex-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-ibm-plex-mono)', ...defaultTheme.fontFamily.mono],
      },
      animation: {
        'lift': 'lift 3.2s cubic-bezier(.65,0,.35,1) infinite',
        'blink': 'blink 3.2s ease-in-out infinite',
      },
      keyframes: {
        lift: {
          '0%': { transform: 'rotate(0deg)' },
          '18%': { transform: 'rotate(-72deg)' },
          '75%': { transform: 'rotate(-72deg)' },
          '93%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        blink: {
          '0%, 15%': { fill: '#FFB238' },
          '20%, 74%': { fill: '#21C58A' },
          '80%, 100%': { fill: '#FFB238' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
