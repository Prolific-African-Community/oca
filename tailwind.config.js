/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        oca: {
          DEFAULT: '#0A2A6B',
          blue: '#0A2A6B',
          600: '#123A8C',
          500: '#2A4FA8',
          400: '#3B5BB5',
          tint: '#EAF0FB',
        },
        apple: {
          DEFAULT: '#0071E3',
          600: '#0064CC',
        },
        ink: '#1D1D1F',
        page: '#FBFBFD',
        cloud: '#F0F0F3',
        hairline: '#E8E8ED',
      },
      borderRadius: {
        card: '12px',
        hero: '20px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.10)',
        lift: '0 2px 4px rgba(16,24,40,.05), 0 24px 48px -20px rgba(16,24,40,.18)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-x': {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(8px,-10px)' },
        },
        drift: {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-9px) rotate(1.2deg)' },
        },
        spinslow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        aurora: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.9' },
          '50%': { transform: 'translate3d(3%,-4%,0) scale(1.12)', opacity: '1' },
        },
        'aurora-2': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)', opacity: '0.8' },
          '50%': { transform: 'translate3d(-4%,3%,0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.9s ease both',
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float 10s ease-in-out infinite',
        'float-x': 'float-x 9s ease-in-out infinite',
        drift: 'drift 8s ease-in-out infinite',
        'spin-slow': 'spinslow 38s linear infinite',
        'spin-slower': 'spinslow 60s linear infinite',
        aurora: 'aurora 16s ease-in-out infinite',
        'aurora-2': 'aurora-2 20s ease-in-out infinite',
        shimmer: 'shimmer 5.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 3.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
