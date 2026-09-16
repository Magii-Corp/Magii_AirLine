import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        card: {
          DEFAULT: "#1A1A1C",
          secondary: "#242426",
        },
        border: "#2C2C2E",
        text: {
          primary: "#FFFFFF",
          secondary: "#8E8E93",
        },
        accent: {
          DEFAULT: "#FFB020",
          green: "#32D74B",
        },
        error: "#FF453A",
      },
    },
  },
  plugins: [],
};

export default config;
