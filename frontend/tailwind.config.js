/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        notion: {
          white: '#ffffff',
          bg: '#f7f6f3',
          hover: '#efefef',
          text: '#37352f',
          gray: '#6b6b6b',
          border: '#e9e9e7',
          accent: '#2eaadc',
          red: '#eb5757',
          orange: '#fa8c16',
          yellow: '#f5a623',
          green: '#00c53c',
          blue: '#2196f3',
          purple: '#9c27b0',
          pink: '#eb1d8c',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
