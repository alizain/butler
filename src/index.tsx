import App from "@/src/App"
/* @refresh reload */
import { render } from "solid-js/web"
import "@/src/global.css"

const root = document.getElementById("root")

if (root) {
	render(() => <App />, root)
}
