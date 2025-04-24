/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        level1: "#19171B",
        level2: "#262329",
        level3: "#3F3A44",
        main: "#FE365E",
        sub: "#F78888",
        openness: "#A97EFF",
        conscientiousness: "#EF8AFF",
        extraversion: "#FF7E81",
        agreeableness: "#FFB683",
        neuroticism: "#FFD883",
        dark: "#000000",
        gray: "#7B7B7B",
        "light-gray": "#BEBEBE",
      },
    },
  },
  plugins: [],
};
