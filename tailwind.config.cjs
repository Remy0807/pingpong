const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", ...defaultTheme.fontFamily.sans]
      },
      colors: {
        axoft: {
          50: "#f2fbfd",
          100: "#def6f9",
          200: "#b8ecf1",
          300: "#83dce5",
          400: "#3cc1d1",
          500: "#17a9bc",
          600: "#1089a0",
          700: "#106d82",
          800: "#12576a",
          900: "#13495a",
          950: "#082f3d"
        }
      },
      boxShadow: {
        card: "0 20px 45px -20px rgba(23,169,188,0.45)"
      }
    }
  },
  plugins: []
};
