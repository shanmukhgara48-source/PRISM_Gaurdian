/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        prism: {
          bg: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          accent: '#3b82f6',
          muted: '#8b949e',
        },
      },
    },
  },
  plugins: [],
}
