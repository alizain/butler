import { For } from "solid-js"

const ADVICE = [
	"Launch now",
	"Build something people want",
	"Write code. Talk to users. Repeat.",
	"Do things that don't scale (remain small/nimble)",
	"Find the 90 / 10 solution",
	"Find 10-100 customers who love your product",
	"All startups are badly broken at some point",
	"Startups can only solve one problem well at any given time",
	"Ignore your competitors, you will more likely die of suicide than murder",
	"Avoid conferences and long negotiated deals",
	"Be nice! Or at least don't be a jerk",
	"Get sleep and exercise - take care of yourself",
]

export function NavalOnTinkering() {
	return (
		<div class="space-y-8">
			<h1 class="text-lg font-300 text-gray-200 underline">Naval on Tinkering</h1>
			<div class="space-y-4">
				<p class="text-lg font-300 text-gray-400">The great ones don't do it for money or fame or power.</p>
				<p class="text-lg font-300 text-gray-400">Or to build an institution, or to help others, or to save the world.</p>
				<p class="text-lg font-300 text-gray-400">Like a child tinkering, they create it for its own sake.</p>
				<p class="text-lg font-300 text-gray-400">Free from the burden of ambition.</p>
				<p class="text-lg font-300 text-gray-400">Deaf to the demands of the world.</p>
			</div>
		</div>
	)
}
