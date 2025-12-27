import { For } from "solid-js"

const ADVICE = [
	"Preparing to do the thing isn't doing the thing.",
	"Scheduling time to do the thing isn't doing the thing.",
	"Making a to-do list for the thing isn't doing the thing.",
	"Telling people you're going to do the thing isn't doing the thing.",
	"Messaging friends who may or may not be doing the thing isn't doing the thing.",
	"Writing a banger tweet about how you're going to do the thing isn't doing the thing.",
	"Hating on yourself for not doing the thing isn't doing the thing. Hating on other people who have done the thing isn't doing the thing. Hating on the obstacles in the way of doing the thing isn't doing the thing.",
	"Fantasizing about all of the adoration you'll receive once you do the thing isn't doing the thing.",
	"Reading about how to do the thing isn't doing the thing. Reading about how other people did the thing isn't doing the thing. Reading this essay isn't doing the thing.",
]

function getRandomItems<T>(array: T[], count: number): T[] {
	const shuffled = [...array]
		.filter((item) => item !== undefined)
		.sort(() => Math.random() - 0.5)
	return shuffled.slice(0, count)
}

export function DoingTheThing() {
	const randomCount = Math.floor(Math.random() * 2) + 2
	const randomAdvice = getRandomItems(ADVICE, randomCount)

	return (
		<div class="space-y-8">
			<h1 class="text-lg font-300 text-gray-200 underline">Doing the Thing</h1>
			<div class="space-y-4">
				<For each={randomAdvice}>
					{(advice) => <p class="text-lg font-300 text-gray-400">{advice}</p>}
				</For>
				<p class="text-lg font-bold text-gray-400">
					The only thing that is doing the thing is doing the thing.
				</p>
			</div>
		</div>
	)
}
