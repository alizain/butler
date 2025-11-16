import "@/src/shared"
import { Dynamic, render } from "solid-js/web"
import { DoingTheThing } from "@/src/content/doing-the-thing"
import { NavalOnTinkering } from "@/src/content/naval-on-tinkering"
import { YCAdvice } from "@/src/content/yc-advice"

const CONTENT = [YCAdvice, NavalOnTinkering, DoingTheThing]

function NewTab() {
	const Content = CONTENT[Math.floor(Math.random() * CONTENT.length)]

	return (
		<div class="h-screen flex justify-center items-center bg-gray-950 text-gray-100">
			<div class="max-w-4xl mx-auto">
				<Dynamic component={Content} />
			</div>
		</div>
	)
}

const root = document.getElementById("root")

if (root) {
	render(() => <NewTab />, root)
}
