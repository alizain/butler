/// <reference types="vitest/config" />
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import { extensionIcons } from "./vite-plugin-extension-icons"

const __dirname = dirname(fileURLToPath(import.meta.url))

// The manifest references these by path, so they need stable, unhashed names at
// the bundle root.
const MANIFEST_ENTRIES = new Set(["background", "copy-on-select"])

export default defineConfig({
	base: "./",
	build: {
		rolldownOptions: {
			input: {
				background: resolve(__dirname, "src/background.ts"),
				"copy-on-select": resolve(__dirname, "src/copy-on-select.ts"),
				newtab: resolve(__dirname, "entrypoints/newtab.html"),
				popup: resolve(__dirname, "entrypoints/popup.html"),
			},
			output: {
				entryFileNames: (chunkInfo) =>
					MANIFEST_ENTRIES.has(chunkInfo.name)
						? `${chunkInfo.name}.js`
						: "assets/[name]-[hash].js",
			},
		},
	},
	plugins: [
		solid(),
		tailwindcss(),
		extensionIcons(resolve(__dirname, "public/logo.svg")),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./", import.meta.url)),
		},
	},
	// The tests render nothing, so they run in Node. Left unset, the Solid plugin makes
	// vitest require a DOM environment.
	test: {
		environment: "node",
	},
})
