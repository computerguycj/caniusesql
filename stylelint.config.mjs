// Color rules only: every color value lives in templates/tokens.css.
// Everything else must use var(--…). See CLAUDE.md and DECISIONS.md.
const colorFunctions = ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'];

export default {
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': colorFunctions,
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['templates/tokens.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
      },
    },
  ],
};
