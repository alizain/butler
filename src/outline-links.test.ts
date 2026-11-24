import { expect, test } from "vitest"
import { createOutlineSearch, indexOutline } from "@/src/outline"
import type { ExportedNode } from "@/src/workflowy"

function node(
	id: string,
	parent_id: string | null,
	priority: number,
	name: string,
): ExportedNode {
	return { completed: false, id, name, note: null, parent_id, priority }
}

test("indexes own links and direct children's links in reading order", () => {
	const outline = indexOutline([
		node("late", "root", 8, '<a href="https://late.test">https://late.test</a>'),
		node("appendix", "paper", 0, "Appendix https://appendix.test"),
		{
			...node(
				"root",
				null,
				0,
				'Research <a href="https://root.test/?a=1&amp;b=2">read this</a>',
			),
			note: "See https://note.test.",
		},
		node("paper", "root", 3, "Paper https://paper.test"),
		{ ...node("done", "root", 4, "https://done.test"), completed: true },
		node("hidden", "done", 0, "https://hidden.test"),
		node("empty", "root", 5, '<a href="javascript:void(0)">Skip</a>'),
	])
	const search = createOutlineSearch(outline, true)
	expect(search("Research")[0].openUrls).toEqual([
		"https://root.test/?a=1&b=2",
		"https://note.test",
		"https://paper.test",
		"https://late.test",
	])
	expect(search("Paper")[0]).toMatchObject({
		openUrls: ["https://paper.test", "https://appendix.test"],
		path: ["Research read this"],
	})
	expect(search("Appendix")[0].openUrls).toEqual(["https://appendix.test"])
	expect(outline.some((entry) => entry.id === "hidden")).toBe(false)
	expect(outline.find((entry) => entry.id === "empty")?.openUrls).toEqual([])
})

test("filters linkless matches before the result limit and keeps plain parent nodes with linked children", () => {
	const nodes = Array.from({ length: 12 }, (_, i) =>
		node(String(i), null, i, "Research"),
	)
	nodes.push(node("url", "11", 0, "https://paper.test"))
	const outline = indexOutline(nodes)
	expect(createOutlineSearch(outline)("Research")).toHaveLength(10)
	expect(
		createOutlineSearch(outline, true)("Research").map((match) => match.id),
	).toEqual(["11"])
})
