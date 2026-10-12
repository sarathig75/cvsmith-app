/** Design tokens from docs/CVSmith_UI_Design_System.md.
 *  Note: text-on-white variants (placeholder, error, success) are darkened to meet WCAG AA 4.5:1. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { md: '768px', lg: '1024px' },
    extend: {
      colors: {
        brand: { DEFAULT: '#2563EB', dark: '#1E40AF', light: '#DBEAFE' },
        success: { DEFAULT: '#10B981', text: '#047857', bg: '#ECFDF5' },
        warning: { DEFAULT: '#F59E0B', text: '#B45309', bg: '#FFFBEB' },
        error: { DEFAULT: '#EF4444', text: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '12px', lg: '16px' },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.1)',
        md: '0 4px 6px rgba(0,0,0,0.1)',
        lg: '0 10px 25px rgba(0,0,0,0.1)',
      },
      maxWidth: { page: '1280px' },
    },
  },
  plugins: [],
};
