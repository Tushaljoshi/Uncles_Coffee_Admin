/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EE",
        espresso: "#3D2314",
        caramel: "#A35D38",
        caramelHover: "#8F4F30",
        latte: "#EAD8C0",
        terracotta: "#C86D46",
        success: "#5F7654",
        warning: "#B7793E",
        error: "#A64B3C",
        white: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
