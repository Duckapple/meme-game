const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      spacing: {
        sm: "24rem",
        md: "28rem",
        lg: "32rem",
        xl: "36rem",
        "2xl": "40rem",
        "3xl": "44rem",
        "4xl": "48rem",
        "5xl": "52rem",
        "6xl": "56rem",
      },
    },
    screens: {
      xs: "475px",
      ...defaultTheme.screens,
      "4xl": "2400px",
    },
  },
  plugins: [],
};
