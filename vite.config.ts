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
				newtab: resolve(__dirname, "entrypoints/newtab.html"),
				options: resolve(__dirname, "entrypoints/options.html"),
				popup: resolve(__dirname, "entrypoints/popup.html"),
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
