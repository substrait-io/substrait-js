module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: ["node_modules/", "dist/"],
  extends: [
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any':'off',
    '@typescript-eslint/no-non-null-assertion':'off'
  },
  
};
