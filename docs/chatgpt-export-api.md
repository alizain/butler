# ChatGPT Conversation Export API

How to export a ChatGPT conversation with full fidelity from the logged-in web interface.

## Authentication

ChatGPT uses a JWT access token for API requests. The token is NOT automatically included in fetch calls - you must retrieve it and add it manually.

### Get Access Token

```
GET https://chatgpt.com/api/auth/session
Cookies: (browser cookies, use credentials: 'include')
```

**Response:**
```json
{
  "user": {
    "id": "user-xxx",
    "name": "...",
    "email": "...",
    "image": "...",
    "picture": "...",
    "idp": "google-oauth2",
    "iat": 1767378612,
    "mfa": false,
    "groups": [],
    "intercom_hash": "..."
  },
  "expires": "2026-02-01T18:30:12.185Z",
  "accessToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS...",
  "authProvider": "google-oauth2",
  "rumViewTags": {...}
}
```

The `accessToken` is a JWT signed by OpenAI. It expires (check the JWT payload for `exp`).

## Fetch Conversation

```
GET https://chatgpt.com/backend-api/conversation/{conversationId}
Authorization: Bearer {accessToken}
Cookies: (browser cookies)
```

**Response:**
```json
{
  "title": "Conversation Title",
  "conversation_id": "69568da1-ca50-8326-8cfe-fe34c3a4c106",
  "create_time": 1767280034.42796,
  "update_time": 1767280123.456789,
  "default_model_slug": "gpt-5-2-pro",
  "current_node": "aaa-bbb-ccc",
  "is_archived": false,
  "is_starred": false,
  "mapping": {
    "message-id-1": {
      "id": "message-id-1",
      "message": {
        "id": "message-id-1",
        "author": {
          "role": "user",
          "name": null,
          "metadata": {}
        },
        "create_time": 1767280034.42796,
        "update_time": null,
        "content": {
          "content_type": "text",
          "parts": ["The actual message text goes here..."]
        },
        "status": "finished_successfully",
        "metadata": {
          "is_visually_hidden_from_conversation": false
        }
      },
      "parent": "parent-message-id",
      "children": ["child-message-id"]
    }
  },
  "moderation_results": [],
  "safe_urls": [],
  "blocked_urls": [],
  "plugin_ids": null,
  "conversation_template_id": null,
  "gizmo_id": null,
  "gizmo_type": null,
  "owner": "user-xxx",
  "voice": null,
  "async_status": null,
  "disabled_tool_ids": [],
  "is_do_not_remember": false,
  "memory_scope": null,
  "context_scopes": []
}
```

## Message Structure

The `mapping` object is a tree of messages, not a flat list.

Each message node has:
- `id`: Unique message ID
- `message`: The actual message content (can be null for root/system nodes)
- `parent`: ID of parent message
- `children`: Array of child message IDs

To get messages in order, start from `current_node` and walk up via `parent`, or start from the root and walk down via `children`.

### Author Roles
- `"system"`: System prompt / hidden context
- `"user"`: User message
- `"assistant"`: ChatGPT response
- `"tool"`: Tool/plugin output

### Content Types
- `"text"`: Regular text, content in `parts` array
- `"code"`: Code blocks
- `"execution_output"`: Code interpreter results
- `"multimodal_text"`: Messages with images

## JavaScript Implementation

```javascript
async function exportConversation(conversationId) {
  // Step 1: Get access token
  const sessionRes = await fetch('/api/auth/session', {
    credentials: 'include'
  });
  const session = await sessionRes.json();
  const accessToken = session.accessToken;

  if (!accessToken) {
    throw new Error('Not logged in or session expired');
  }

  // Step 2: Fetch conversation
  const convoRes = await fetch(`/backend-api/conversation/${conversationId}`, {
    credentials: 'include',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!convoRes.ok) {
    throw new Error(`Failed to fetch conversation: ${convoRes.status}`);
  }

  return await convoRes.json();
}

// Get conversation ID from current URL
function getConversationIdFromUrl() {
  const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// Usage
const conversationId = getConversationIdFromUrl();
const conversation = await exportConversation(conversationId);
console.log(JSON.stringify(conversation, null, 2));
```

## Common Errors

| Status | Cause |
|--------|-------|
| 401 | Missing or invalid Authorization header |
| 403 | Token expired or insufficient permissions |
| 404 | Missing Authorization header (confusingly returns 404, not 401) |
| 404 | Conversation doesn't exist or you don't own it |

## Chrome Extension Implementation (Context Menu)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Background Service Worker                                    │
│                                                              │
│  1. Register context menu on install                         │
│  2. Listen for menu click                                    │
│  3. Execute script in page context via chrome.scripting      │
│  4. Script fetches conversation + copies to clipboard        │
└─────────────────────────────────────────────────────────────┘
```

### Manifest Changes

```json
{
  "manifest_version": 3,
  "permissions": [
    "contextMenus",
    "scripting",
    "clipboardWrite"
  ],
  "host_permissions": [
    "https://chatgpt.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

### Background Service Worker

```javascript
// background.js

// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'export-chatgpt',
    title: 'Export Conversation JSON',
    contexts: ['page'],
    documentUrlPatterns: ['https://chatgpt.com/c/*']
  });
});

// Handle click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'export-chatgpt') return;

  // Execute the export script in the page context
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: exportConversationToClipboard,
    world: 'MAIN'  // Run in page context to access cookies
  });

  // results[0].result contains the return value
});

// This function runs in the PAGE context (not extension context)
async function exportConversationToClipboard() {
  // Get conversation ID from URL
  const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  if (!match) {
    return { error: 'Not on a conversation page' };
  }
  const conversationId = match[1];

  // Get access token
  const sessionRes = await fetch('/api/auth/session', {
    credentials: 'include'
  });
  const session = await sessionRes.json();

  if (!session.accessToken) {
    return { error: 'Not logged in' };
  }

  // Fetch conversation
  const convoRes = await fetch(`/backend-api/conversation/${conversationId}`, {
    credentials: 'include',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`
    }
  });

  if (!convoRes.ok) {
    return { error: `Fetch failed: ${convoRes.status}` };
  }

  const conversation = await convoRes.json();

  // Copy to clipboard
  const json = JSON.stringify(conversation, null, 2);
  await navigator.clipboard.writeText(json);

  return {
    success: true,
    title: conversation.title,
    messageCount: Object.keys(conversation.mapping).length
  };
}
```

### Key Details

1. **`world: 'MAIN'`** - Critical! Runs the script in the page's JavaScript context, not the isolated extension context. This gives access to the page's cookies and fetch credentials.

2. **`documentUrlPatterns`** - Menu only appears on chatgpt.com/c/* URLs

3. **`clipboardWrite`** - May be needed for clipboard access (though `navigator.clipboard` often works without it in MAIN world)

4. **Return value** - The function can return data back to the service worker via `results[0].result`

## Notes

- The `/backend-api/` endpoints require authentication
- The `/backend-anon/` endpoints are for shared conversations (public links)
- Token is valid for ~1 week (check JWT `exp` claim)
- Always include `credentials: 'include'` to send cookies
