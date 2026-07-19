/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        accent: {
          50: '#FFF6EC',
          100: '#FFEAD3',
          200: '#FFD1A1',
          300: '#FDB56C',
          400: '#F19A44',
          500: '#E67E22',
          600: '#CC6B1A',
          700: '#A85614',
          800: '#7A3F0F',
          900: '#552B0A',
        },
        ink: {
          50: '#F7F7F5',
          100: '#EEEEEA',
          200: '#E1E1DC',
          300: '#CBCBC4',
          400: '#9A9A92',
          500: '#6B6B63',
          600: '#4B4B45',
          700: '#34342F',
          800: '#212120',
          900: '#131311',
        },
      },
      borderRadius: {
        xl2: '16px',
        card: '14px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(20, 20, 20, 0.04)',
        soft: '0 1px 2px rgba(20, 20, 20, 0.03), 0 4px 12px rgba(20, 20, 20, 0.04)',
        softLg: '0 4px 12px rgba(20, 20, 20, 0.05), 0 16px 40px rgba(20, 20, 20, 0.08)',
        glowAccent: 'none',
        glossy: '0 1px 1px rgba(255,255,255,0.5) inset',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(180deg, #F0954A 0%, #E67E22 60%, #CC6B1A 100%)',
        'accent-gradient-soft': 'linear-gradient(135deg, #FFEAD3 0%, #FFD1A1 100%)',
        'accent-glossy': 'radial-gradient(120% 140% at 15% -10%, #FFD9AE 0%, #F7A253 35%, #E67E22 65%, #C25E12 100%)',
      },
    },
  },
  plugins: [],
}
