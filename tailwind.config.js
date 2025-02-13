/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",  // Aplica Tailwind aos arquivos na pasta src
    "./app/**/*.{js,ts,jsx,tsx}",  // Caso esteja usando a estrutura app do Next.js
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
