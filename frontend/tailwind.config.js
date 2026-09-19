/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy / charcoal canvas
        canvas: {
          DEFAULT: '#070C17',
          raised: '#0C1424',
          card: '#111A2E',
          hover: '#16213A',
          line: '#1E2C47',
        },
        // Warm off-white ink
        ink: {
          DEFAULT: '#F4F1EC',
          soft: '#C3C7D1',
          muted: '#8A93A6',
          faint: '#5C6579',
        },
        brand: {
          50: '#E8F1FD',
          100: '#CDE2FB',
          200: '#9EC5F4',
          300: '#6DA7EC',
          400: '#3987E5',
          500: '#2A78D6',
          600: '#256ABF',
          700: '#1C5CAB',
          800: '#184F95',
          900: '#104281',
        },
        // Status — always shipped with an icon + label, never colour alone
        good: { DEFAULT: '#199E70', soft: '#0F3A2C', ink: '#4FD1A0' },
        warn: { DEFAULT: '#C98500', soft: '#3A2E0D', ink: '#F5C451' },
        serious: { DEFAULT: '#D95926', soft: '#3A1F12', ink: '#F0885C' },
        critical: { DEFAULT: '#D03B3B', soft: '#3B1616', ink: '#F07272' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontWeight: { 400: '400', 500: '500', 600: '600', 700: '700' },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -12px rgba(0,0,0,0.65)',
        lift: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 56px -20px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(57,135,229,0.30), 0 18px 48px -18px rgba(57,135,229,0.45)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #3987E5 0%, #5B6FE8 100%)',
        'hero-glow':
          'radial-gradient(1000px 520px at 15% -10%, rgba(57,135,229,0.22), transparent 62%), radial-gradient(760px 420px at 88% 4%, rgba(91,111,232,0.16), transparent 58%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.7)', opacity: '0' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
