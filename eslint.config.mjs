import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
                project: './tsconfig.json',
            },
        },
    },
    {
        ignores: [
            'src-admin/**/*',
            'admin/**/*',
            'node_modules/**/*',
            'test/**/*',
            'build/**/*',
            'tasks.js',
            'tmp/**/*',
            '.**/*',
        ],
    },
    {
        // disable temporary the rule 'jsdoc/require-param' and enable 'jsdoc/require-jsdoc'
        rules: {
  

            '@typescript-eslint/no-require-imports': 'off',

            'prettier/prettier': 'off',
            'no-else-return': 'off',
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-returns-description': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-param': 'off',
            'no-constant-binary-expression': 'off',
            'valid-typeof': 'off',
        },
    },
];
