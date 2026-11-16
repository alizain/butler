const KEY = "workflowyApiKey"

// Empty until saved in the popup, and Workflowy rejects an empty key with a 401.
export async function readApiKey(): Promise<string> {
	const stored = await chrome.storage.local.get<{ [KEY]?: string }>(KEY)
	return stored[KEY] ?? ""
}

export async function writeApiKey(apiKey: string) {
	await chrome.storage.local.set({ [KEY]: apiKey })
}
