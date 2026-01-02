// Background service worker for butler extension

const OFFSCREEN_PATH = "entrypoints/offscreen.html"
let creatingOffscreen: Promise<void> | null = null

type TabSummary = {
	title: string
	url: string
}

async function ensureOffscreenDocument() {
	const hasDocument = (await chrome.offscreen.hasDocument?.()) ?? false
	if (hasDocument) return

	if (!creatingOffscreen) {
		creatingOffscreen = chrome.offscreen
			.createDocument({
				justification: "Copy tab list to clipboard",
				reasons: [chrome.offscreen.Reason.CLIPBOARD],
				url: OFFSCREEN_PATH,
			})
			.finally(() => {
				creatingOffscreen = null
			})
	}

	await creatingOffscreen
}

async function closeOffscreenDocument() {
	const hasDocument = (await chrome.offscreen.hasDocument?.()) ?? false
	if (!hasDocument) return
	await chrome.offscreen.closeDocument()
}

async function copyToClipboard(text: string): Promise<boolean> {
	await ensureOffscreenDocument()
	try {
		const response = await chrome.runtime.sendMessage({ text, type: "copy" })
		return response?.success === true
	} finally {
		try {
			await closeOffscreenDocument()
		} catch (error) {
			console.warn("[butler bg] offscreen close failed:", error)
		}
	}
}

function summarizeTabs(tabs: chrome.tabs.Tab[]): TabSummary[] {
	return tabs.map((tab) => ({
		title: tab.title ?? "",
		url: tab.url ?? tab.pendingUrl ?? "",
	}))
}

function formatTabSummaries(tabs: TabSummary[]): string {
	return tabs.map((tab) => `${tab.url}\n\t${tab.title}\n`).join("\n")
}

async function copyTabsFromWindow(windowId: number): Promise<number> {
	const tabs = await chrome.tabs.query({ windowId })
	const summaries = summarizeTabs(tabs)
	const content = formatTabSummaries(summaries)
	const success = await copyToClipboard(content)
	if (!success) {
		throw new Error("Clipboard copy failed")
	}
	return tabs.length
}

// Copy all tabs in the current window when the action icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
	try {
		const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT
		const count = await copyTabsFromWindow(windowId)

		chrome.action.setBadgeText({ text: String(count) })
		chrome.action.setBadgeBackgroundColor({ color: "#009966" })
		chrome.action.setBadgeTextColor({ color: "#ffffff" })
		setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
	} catch (error) {
		console.error("[butler bg] copy tabs error:", error)
		chrome.action.setBadgeText({ text: "✗" })
		chrome.action.setBadgeBackgroundColor({ color: "#c70036" })
		chrome.action.setBadgeTextColor({ color: "#ffffff" })
		setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
	}
})

// Register context menus on install
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		contexts: ["page"],
		documentUrlPatterns: ["https://chatgpt.com/c/*"],
		id: "export-chatgpt-parent",
		title: "Export ChatGPT convo",
	})

	chrome.contextMenus.create({
		contexts: ["page"],
		documentUrlPatterns: ["https://chatgpt.com/c/*"],
		id: "export-chatgpt-json",
		parentId: "export-chatgpt-parent",
		title: "as JSON",
	})

	chrome.contextMenus.create({
		contexts: ["page"],
		documentUrlPatterns: ["https://chatgpt.com/c/*"],
		id: "export-chatgpt-markdown",
		parentId: "export-chatgpt-parent",
		title: "as Markdown",
	})
})

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	console.log("[butler bg] clicked:", info.menuItemId)
	if (!tab?.id) return

	const isJson = info.menuItemId === "export-chatgpt-json"
	const isMarkdown = info.menuItemId === "export-chatgpt-markdown"
	if (!isJson && !isMarkdown) return

	try {
		console.log("[butler bg] executing script...")
		const results = await chrome.scripting.executeScript({
			func: isJson ? exportAsJson : exportAsMarkdown,
			target: { tabId: tab.id },
			world: "MAIN",
		})
		const result = results[0]?.result as { success?: boolean; error?: string }
		console.log("[butler bg] result:", result)

		if (result?.success) {
			chrome.action.setBadgeText({ tabId: tab.id, text: "✓" })
			chrome.action.setBadgeBackgroundColor({ color: "#009966", tabId: tab.id })
			chrome.action.setBadgeTextColor({ color: "#ffffff", tabId: tab.id })
			setTimeout(
				() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }),
				5000,
			)
		} else {
			chrome.action.setBadgeText({ tabId: tab.id, text: "✗" })
			chrome.action.setBadgeBackgroundColor({ color: "#c70036", tabId: tab.id })
			chrome.action.setBadgeTextColor({ color: "#ffffff", tabId: tab.id })
			setTimeout(
				() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }),
				5000,
			)
		}
	} catch (error) {
		console.error("[butler bg] error:", error)
		chrome.action.setBadgeText({ tabId: tab.id, text: "✗" })
		chrome.action.setBadgeBackgroundColor({ color: "#c70036", tabId: tab.id })
		chrome.action.setBadgeTextColor({ color: "#ffffff", tabId: tab.id })
		setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 5000)
	}
})

// Self-contained JSON export
async function exportAsJson() {
	console.log("[butler] JSON export starting")
	try {
		const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/)
		if (!match) return { error: "Not on conversation page" }

		const session = await (
			await fetch("/api/auth/session", { credentials: "include" })
		).json()
		if (!session.accessToken) return { error: "No token" }

		const convo = await (
			await fetch(`/backend-api/conversation/${match[1]}`, {
				credentials: "include",
				headers: { Authorization: `Bearer ${session.accessToken}` },
			})
		).json()

		const json = JSON.stringify(convo, null, 2)
		await navigator.clipboard.writeText(json)
		console.log("[butler] JSON copied!", convo.title)
		return {
			messageCount: Object.keys(convo.mapping || {}).length,
			success: true,
			title: convo.title,
		}
	} catch (e) {
		console.error("[butler] error:", e)
		return { error: String(e) }
	}
}

// Self-contained Markdown export
async function exportAsMarkdown() {
	console.log("[butler] Markdown export starting")
	try {
		const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/)
		if (!match) return { error: "Not on conversation page" }

		const session = await (
			await fetch("/api/auth/session", { credentials: "include" })
		).json()
		if (!session.accessToken) return { error: "No token" }

		const convo = await (
			await fetch(`/backend-api/conversation/${match[1]}`, {
				credentials: "include",
				headers: { Authorization: `Bearer ${session.accessToken}` },
			})
		).json()

		const mapping = convo.mapping

		// Build active path: walk UP from current_node to root, then reverse
		// This handles nested branches correctly - we only follow the exact path
		const activePath: string[] = []
		let nodeId: string | null = convo.current_node
		while (nodeId) {
			activePath.unshift(nodeId)
			nodeId = mapping[nodeId]?.parent || null
		}

		if (activePath.length === 0) return { error: "No messages found" }

		const lines: string[] = []
		let messageCount = 0

		lines.push(`# ${convo.title || "Untitled"}`)
		lines.push("")

		// Walk the active path in order (root → current)
		for (const id of activePath) {
			const node = mapping[id]
			if (!node) continue

			const msg = node.message as
				| {
						author?: { role: string }
						content?: {
							content_type: string
							parts?: string[]
							text?: string
							thoughts?: Array<{ summary?: string; content?: string }>
							content?: string
						}
						metadata?: {
							search_result_groups?: Array<{
								entries: Array<{ title: string; url: string }>
							}>
						}
				  }
				| undefined

			if (msg?.author) {
				messageCount++
				const role = msg.author.role
				const label =
					role === "user"
						? "👤 User"
						: role === "assistant"
							? "🤖 Assistant"
							: role === "system"
								? "⚙️ System"
								: role === "tool"
									? "🔧 Tool"
									: role

				lines.push(`## ${label}`)
				lines.push("")

				const content = msg.content
				if (content) {
					switch (content.content_type) {
						case "text":
							if (content.parts) lines.push(content.parts.join("\n"))
							break
						case "thoughts":
							if (content.thoughts?.length) {
								lines.push("> **Thinking**")
								for (const t of content.thoughts) {
									if (t.summary) lines.push(`> **${t.summary}**`)
									if (t.content) {
										for (const l of t.content.split("\n")) {
											lines.push(`> ${l}`)
										}
									}
								}
							}
							break
						case "reasoning_recap":
							if (content.content) lines.push(`*${content.content}*`)
							break
						case "code":
							if (content.text) {
								try {
									const p = JSON.parse(content.text)
									if (p.search_query) {
										lines.push("**🔍 Searching:**")
										for (const q of p.search_query as {
											q: string
										}[]) {
											lines.push(`- ${q.q}`)
										}
									}
								} catch {
									lines.push(`\`\`\`\n${content.text}\n\`\`\``)
								}
							}
							break
					}
				}

				// Sources
				if (msg.metadata?.search_result_groups?.length) {
					lines.push("")
					lines.push("**📚 Sources:**")
					for (const g of msg.metadata.search_result_groups) {
						for (const e of g.entries) lines.push(`- [${e.title}](${e.url})`)
					}
				}

				lines.push("")
				lines.push("---")
				lines.push("")
			}
		}

		const md = lines.join("\n")
		await navigator.clipboard.writeText(md)
		console.log("[butler] Markdown copied!", convo.title, messageCount, "messages")
		return { messageCount, success: true, title: convo.title }
	} catch (e) {
		console.error("[butler] error:", e)
		return { error: String(e) }
	}
}
