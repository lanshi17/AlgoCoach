import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f6f2e9',
          soft:    '#fbf9f3',
          muted:   '#ece5d9',
          dark:    '#211f1a',
          'dark-soft': '#2a2721',
          'dark-muted': '#3a352d',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover:   'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          soft:    'rgb(var(--accent-soft-rgb) / <alpha-value>)',
          'dark-soft': 'rgb(var(--accent-dark-soft-rgb) / 0.14)',
        },
        border: {
          DEFAULT: '#ddd5c8',
          dark:    '#443d33',
        },
        text: {
          primary:   '#302b25',
          secondary: '#6c645a',
          muted:     '#8a8176',
          'dark-primary':   '#eee7db',
          'dark-secondary': '#b7ac9d',
          'dark-muted':     '#8d8377',
        },
        // Status colors
        success: '#627658',
        warning: '#98713d',
        danger:  '#a34f43',
        focus:   'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'system-ui', 'sans-serif'],
        editorial: ['Noto Serif SC', 'Songti SC', 'STSong', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
      },
      boxShadow: {
        card:   '0 1px 2px rgba(45,36,27,0.05)',
        modal:  '0 16px 40px rgba(34,29,22,0.16)',
        glow:   '0 0 0 3px rgb(var(--accent-rgb) / 0.18)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn:     { from: { opacity: '0' },              to: { opacity: '1' } },
        slideUp:    { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pulseSoft:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
    },
  },
  plugins: [],
} satisfies Config
