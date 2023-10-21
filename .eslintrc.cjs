module.exports = {
  root: true,
  env: { node: true, commonjs: true },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  rules: {
    "@typescript-eslint/no-unused-vars": 1,
  },
};
