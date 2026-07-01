/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          deep: "#E66B85",
          primary: "#FF8FA3",
          medium: "#FFB3C6",
          pastel: "#FFE5EC",
          whisper: "#FFF0F4",
        },
        cream: "#FFF7F9",
        ink: {
          primary: "#3D2A33",
          secondary: "#5C4853",
          soft: "#8E7A82",
        },
        success: "#A8D5A8",
        warning: "#F4B4A0",
        error: "#E08585",
      },
      fontFamily: {
        display: ["Montserrat", "system-ui", "sans-serif"],
        sans: ["Montserrat", "system-ui", "sans-serif"],
        accent: ["'Cormorant Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 4px 16px rgba(180, 130, 145, 0.08)",
        lift: "0 8px 24px rgba(255, 143, 163, 0.18)",
        glow: "0 0 32px rgba(255, 143, 163, 0.35)",
      },
      animation: {
        "soft-pulse": "soft-pulse 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out forwards",
      },
      keyframes: {
        "soft-pulse": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.85, transform: "scale(1.02)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
