/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#E6DCCB',
        sheet: '#FBF6EC',
        surface: '#FBF6EC',
        surfaceAlt: '#F1E8D6',
        border: 'rgba(26, 26, 24, 0.14)',
        borderDark: 'rgba(26, 26, 24, 0.28)',
        bronze: '#B08948',
        gold: '#C9A66B',
        ink: '#1A1A18',
        inkMuted: '#5E584E',
        inkFaint: '#8E877A',
        accent: '#0F3D2E',
        accentSoft: '#0C3326',
        commit: '#0F3D2E',
        commitHover: '#14523D',
        cream: '#EDE3CF',
        ok: '#1F7A45',
        okBg: '#CDEAD6',
        warn: '#C48A1A',
        warnBg: '#F6E3B8',
        danger: '#C23028',
        dangerBg: '#F5D0CC',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 18px 50px rgba(26, 26, 24, 0.08), 0 1px 0 rgba(255, 248, 235, 0.7) inset',
      },
      borderRadius: {
        md: '2px',
      },
    },
  },
  plugins: [],
}
