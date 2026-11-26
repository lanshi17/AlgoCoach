import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-driven surfaces resolve through CSS variables, so a component
        // never has to pair `bg-surface` with `dark:bg-surface-dark`. The
        // legacy dark aliases below stay for components that still spell both.
        canvas: {
          DEFAULT: 'rgb(var(--canvas-rgb) / <alpha-value>)',
          dark: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          soft: 'rgb(var(--surface-soft-rgb) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted-rgb) / <alpha-value>)',
          dark: 'rgb(var(--surface-rgb) / <alpha-value>)',
          'dark-soft': 'rgb(var(--surface-soft-rgb) / <alpha-value>)',
          'dark-muted': 'rgb(var(--surface-muted-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft-rgb) / <alpha-value>)',
          'dark-soft': 'rgb(var(--accent-soft-rgb) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-rgb) / <alpha-value>)',
          dark: 'rgb(var(--border-rgb) / <alpha-value>)',
        },
        line: {
          100: 'rgb(var(--border-rgb) / <alpha-value>)',
          200: 'rgb(var(--line-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--line-300-rgb) / <alpha-value>)',
        },
        ink: {
          950: 'rgb(var(--ink-950-rgb) / <alpha-value>)',
          900: 'rgb(var(--ink-900-rgb) / <alpha-value>)',
          700: 'rgb(var(--ink-700-rgb) / <alpha-value>)',
          550: 'rgb(var(--ink-550-rgb) / <alpha-value>)',
          450: 'rgb(var(--ink-450-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          'dark-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          'dark-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          'dark-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        focus: 'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        editorial: ['Inter', 'PingFang SC', 'Hiragino Sans GB', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Editorial console scale: one display step, one page step, then UI.
        display: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        page: ['22px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        section: ['13px', { lineHeight: '20px', letterSpacing: '0' }],
        body: ['13.5px', { lineHeight: '22px', letterSpacing: '0' }],
        meta: ['12px', { lineHeight: '18px', letterSpacing: '0' }],
        label: ['10.5px', { lineHeight: '14px', letterSpacing: '0.09em' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        card: '12px',
        panel: '16px',
        pill: '999px',
        tip: '6px',
        full: '999px',
      },
      boxShadow: {
        card: 'none',
        light: '0 1px 2px rgb(9 11 14 / 0.05)',
        modal: '0 18px 44px rgb(9 11 14 / 0.16), 0 2px 6px rgb(9 11 14 / 0.06)',
        glow: '0 0 0 3px rgb(var(--accent-rgb) / 0.14)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      letterSpacing: {
        cn: '0.02em',
        title: '-0.015em',
        num: '-0.02em',
      },
    },
  },
  plugins: [],
} satisfies Config
