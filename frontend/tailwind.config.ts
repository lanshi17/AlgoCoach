import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Qwen-inspired palette — clean blue-indigo spectrum
        surface: {
          DEFAULT: '#ffffff',
          soft:    '#f7f7f8',
          muted:   '#efefef',
          dark:    '#1a1a2e',
          'dark-soft': '#16213e',
          'dark-muted': '#0f3460',
        },
        accent: {
          DEFAULT: '#5b6af5',
          hover:   '#4a57e8',
          soft:    '#eef0ff',
          'dark-soft': 'rgba(91,106,245,0.15)',
        },
        border: {
          DEFAULT: '#e5e7eb',
          dark:    '#2a2a3e',
        },
        text: {
          primary:   '#1a1a2e',
          secondary: '#6b7280',
          muted:     '#9ca3af',
          'dark-primary':   '#e8eaf6',
          'dark-secondary': '#9fa8c0',
          'dark-muted':     '#5c6480',
        },
        // Status colors
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
        focus:   '#ef4444',   // Focus mode lock color
      },
      fontFamily: {
        sans: ['PingFang SC', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
      },
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        modal:  '0 20px 60px rgba(0,0,0,0.12)',
        glow:   '0 0 0 3px rgba(91,106,245,0.2)',
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
