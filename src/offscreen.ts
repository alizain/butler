// Offscreen document for clipboard operations
// Uses execCommand because navigator.clipboard requires user activation

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "copy") {
		try {
			const textarea = document.createElement("textarea")
			textarea.value = message.text
			document.body.appendChild(textarea)
			textarea.select()
			const success = document.execCommand("copy")
			document.body.removeChild(textarea)
			sendResponse({ success })
		} catch (err) {
			sendResponse({ error: String(err), success: false })
		}
		return true
	}
})
