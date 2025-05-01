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

export function YCAdvice() {
	return (
		<div class="space-y-8">
			<h1 class="text-lg font-300 text-gray-200 underline">YC Advice</h1>
			<ul class="space-y-4 list-disc list-outside">
				<For each={ADVICE}>
					{(advice) => <li class="text-lg font-300 text-gray-400">{advice}</li>}
				</For>
			</ul>
		</div>
	)
}
