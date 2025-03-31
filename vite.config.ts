import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	plugins: [solid(), tailwindcss()],
	build: {
		rollupOptions: {
			input: {
				newtab: resolve(__dirname, "entrypoints/newtab.html"),
			},
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./", import.meta.url)),
		},
	},
})
