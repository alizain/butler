import { basename } from "node:path"
import sharp from "sharp"
import type { Plugin } from "vite"

export function extensionIcons(svgPath: string, sizes = [16, 32, 48, 128]): Plugin {
	const name = basename(svgPath, ".svg")

	return {
		apply: "build",
		async generateBundle() {
			for (const size of sizes) {
				const pngBuffer = await sharp(svgPath).resize(size, size).png().toBuffer()

				this.emitFile({
					fileName: `icons/${name}-${size}.png`,
					source: pngBuffer,
					type: "asset",
				})
			}
		},
		name: "extension-icons",
	}
}
