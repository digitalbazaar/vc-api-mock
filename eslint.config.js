import eslintConfig from '@digitalbazaar/eslint-config';

export default [
  ...eslintConfig,
  {
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        crypto: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      '@stylistic/max-len': ['error', {code: 80, ignoreComments: true}]
    }
  },
  {
    // Test files — add mocha globals
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    }
  }
];
