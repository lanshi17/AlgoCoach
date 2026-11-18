import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#F9FAFD',
        surface: {
          DEFAULT: '#FFFFFF',
          soft:    '#F9FAFD',
          muted:   '#F2F4F8',
          dark:    '#111317',
          'dark-soft': '#171A21',
          'dark-muted': '#232832',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover:   'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          soft:    'rgb(var(--accent-soft-rgb) / <alpha-value>)',
          'dark-soft': 'rgb(var(--accent-dark-soft-rgb) / 0.14)',
        },
        border: {
          DEFAULT: '#E6E9EF',
          dark:    '#2A2E38',
        },
        text: {
          primary:   '#111317',
          secondary: '#535B6B',
          muted:     '#8E96A7',
          'dark-primary':   '#F8F9FC',
          'dark-secondary': '#B7BFCE',
          'dark-muted':     '#8E96A7',
        },
        // Status colors
        success: '#0DA740',
        warning: '#A66B00',
        danger:  '#C23B3B',
        focus:   'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'system-ui', 'sans-serif'],
        editorial: ['Inter', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '999px',
        sm:      '6px',
        md:      '999px',
        lg:      '18px',
        xl:      '24px',
        '2xl':   '24px',
        card:    '18px',
        panel:   '24px',
        pill:    '999px',
        tip:     '6px',
      },
      boxShadow: {
        card:   'none',
        modal:  '0 12px 28px rgb(11 12 15 / 0.042)',
        light:  '0 12px 28px rgb(11 12 15 / 0.042)',
        glow:   '0 0 0 3px rgb(var(--accent-rgb) / 0.12)',
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
      letterSpacing: {
        cn: '0.4px',
        title: '0.5px',
        num: '-0.24px',
      },
    },
  },
  plugins: [],
} satisfies Config
