import { builtinModules } from 'module';
import { dependencies } from './package.json';
import json from '@rollup/plugin-json';
import { terser } from "rollup-plugin-terser";

export default {
	input: 'src/index.js',
	output: {
		file: 'dist/index.cjs',
		format: 'cjs',
		esModule: false,
		interop: false,
		sourcemap: true,
		preferConst: true,
		exports: 'named',
	},
	plugins: [json(), terser()],
	external: [...builtinModules, ...Object.keys(dependencies)]
};
