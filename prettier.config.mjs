/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cn", "clsx", "twMerge"],
  overrides: [
    {
      files: "*.json",
      options: {
        printWidth: 80,
      },
    },
    {
      files: "*.md",
      options: {
        proseWrap: "always",
        printWidth: 80,
      },
    },
  ],
};

export default config;
