const {createRequire} = require('node:module');
const path = require('node:path');
const tooling = process.env.LABORATORY_TOOLING ? createRequire(path.join(process.env.LABORATORY_TOOLING,'package.json')) : require;
const expo = tooling('eslint-config-expo/flat');
module.exports = [...expo, {ignores:['reference/**','public/**','dist/**','target/**','.cache/**']},
  {files:['src/**/*.{ts,tsx}'],rules:{'import/no-unresolved':['error',{ignore:['^three$']}]}}];
