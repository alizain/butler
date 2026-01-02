import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import { extensionIcons } from "./vite-plugin-extension-icons"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	base: "./",
	build: {
		rollupOptions: {
			input: {
				background: resolve(__dirname, "src/background.ts"),
				newtab: resolve(__dirname, "entrypoints/newtab.html"),
				offscreen: resolve(__dirname, "entrypoints/offscreen.html"),
				options: resolve(__dirname, "entrypoints/options.html"),
			},
			output: {
				entryFileNames: (chunkInfo) => {
					// Background script needs to be at root level for manifest
					if (chunkInfo.name === "background") {
						return "background.js"
					}
					return "assets/[name]-[hash].js"
				},
			},
		},
	},
	plugins: [
		solid(),
		tailwindcss(),
		extensionIcons(resolve(__dirname, "public/copy.svg")),
		extensionIcons(resolve(__dirname, "public/logo.svg")),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./", import.meta.url)),
		},
	},
})
