module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
  },
  env: {},
  extends: ['plugin:mocha/recommended'],
  plugins: ['mocha'],
  globals: {},
  settings: {},
  rules: {
    'mocha/no-hooks-for-single-case': 'off',
  }
};
