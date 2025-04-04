browser.action.onClicked.addListener(async (tab) => {
	const tabs = await browser.tabs.query({ currentWindow: true })
	const content = tabs.map((t) => `${t.url}\n\t${t.title}\n`).join("\n")
	navigator.clipboard.writeText(content)
})