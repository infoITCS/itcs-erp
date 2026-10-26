export default {
  "frontend/**/*.{ts,tsx}": () => [
    "npm run lint --prefix frontend",
    "npm run build --prefix frontend",
  ],
  "backend/**/*.ts": () => ["npm run lint --prefix backend"],
};
