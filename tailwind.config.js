/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'site-known': '#22c55e',
				'site-potential': '#f59e0b',
				'site-unverified': '#6b7280'
			}
		}
	},
	plugins: []
};
