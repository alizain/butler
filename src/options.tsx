import "@/src/shared"
import { render } from "solid-js/web"

function Options() {
	return (
		<div class="py-4 px-1">
		</div>
	)
}

const root = document.getElementById("root")

if (root) {
	render(() => <Options />, root)
}
