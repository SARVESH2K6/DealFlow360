/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF7F2',
        surface: '#FFFFFF',
        surfaceAlt: '#F3EEE6',
        border: '#E4DDD0',
        borderDark: '#D3C9B6',
        ink: '#1C1A17',
        inkMuted: '#6B6459',
        inkFaint: '#A69C8C',
        accent: '#1C1A17',
        accentSoft: '#3A362F',
        cream: '#EFE7D8',
        ok: '#4A6B4F',
        okBg: '#E7EDE4',
        warn: '#9C7A3C',
        warnBg: '#F3EAD4',
        danger: '#9C4A3C',
        dangerBg: '#F3E0DB',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 3px rgba(28,26,23,0.06)',
      },
      borderRadius: {
        md: '6px',
      },
    },
  },
  plugins: [],
}
