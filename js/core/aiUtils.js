/**
 * aiUtils.js — Shared AI utilities
 * Provider management, streaming SSE, one-shot completions, tool calling.
 */

// ── Provider / Credentials ────────────────────────────────────────────────────

export function getProvider() {
    const el = document.getElementById('lab-provider-select');
    if (el) return el.value;
    return localStorage.getItem('nn_provider') || 'groq';
}

export function getApiKey(provider = getProvider()) {
    if (provider === 'custom') {
        return localStorage.getItem('nn_custom_key') || '';
    }
    if (provider === 'deepseek') {
        return localStorage.getItem('nn_deepseek_key') || '';
    }
    return localStorage.getItem('nn_groq_key') || '';
}

export function getBaseUrl(provider = getProvider()) {
    const custom = localStorage.getItem('nn_custom_base_url');
    if (provider === 'custom') return custom || '';
    if (custom) return custom; // still allow override for other providers if set
    return provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : 'https://api.groq.com/openai/v1';
}

export function getHeaders(provider = getProvider()) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey(provider)}`
    };
}

export function getModel(provider = getProvider()) {
    const el = document.getElementById('lab-model-select');
    if (el && el.value) return el.value;
    return provider === 'deepseek' ? 'deepseek-chat' : 'llama3-8b-8192';
}

// ── Streaming Completion (SSE) ────────────────────────────────────────────────

/**
 * Stream a chat completion using server-sent events.
 * 
 * @param {Object}   body         - Full request body (model, messages, tools, etc.)
 * @param {Function} onChunk      - Called with each text delta: (textDelta: string) => void
 * @param {Function} [onToolCall] - Called when all tool_calls assembled: (name, args, id) => void
 * @returns {Promise<string>}     - Full assembled text
 */
export async function streamCompletion(body, onChunk, onToolCall = null) {
    const provider = getProvider();
    const model = getModel(provider);

    // Inject model if not provided
    const payload = { ...body, model, stream: true };

    const response = await fetch(`${getBaseUrl(provider)}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(provider),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    const assembledToolCalls = {};  // index → { id, name, arguments }

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            let json;
            try { json = JSON.parse(data); } catch { continue; }

            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            // Text content delta
            if (delta.content) {
                fullText += delta.content;
                onChunk(delta.content);
            }

            // Tool calls delta — assemble incrementally
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (!assembledToolCalls[tc.index]) {
                        assembledToolCalls[tc.index] = { id: '', name: '', arguments: '' };
                    }
                    const t = assembledToolCalls[tc.index];
                    if (tc.id) t.id = tc.id;
                    if (tc.function?.name) t.name = tc.function.name;
                    if (tc.function?.arguments) t.arguments += tc.function.arguments;
                }
            }
        }
    }

    // Fire assembled tool calls
    if (onToolCall) {
        for (const t of Object.values(assembledToolCalls)) {
            try {
                const args = JSON.parse(t.arguments || '{}');
                onToolCall(t.name, args, t.id);
            } catch { /* skip malformed */ }
        }
    }

    return fullText;
}

// ── One-shot Completion (no streaming) ───────────────────────────────────────

/**
 * Non-streaming completion.
 * @param {Object} body
 * @returns {Promise<{content: string, tool_calls?: Array}>}
 */
export async function complete(body) {
    const provider = getProvider();
    const model = getModel(provider);

    const payload = { ...body, model };

    const response = await fetch(`${getBaseUrl(provider)}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(provider),
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.choices[0].message;
}

// ── Tool Call Helper ──────────────────────────────────────────────────────────

/**
 * Build a tool definition for function calling.
 * @param {string} name
 * @param {string} description
 * @param {Object} parameters - JSON Schema object for parameters
 */
export function defineTool(name, description, parameters) {
    return {
        type: 'function',
        function: { name, description, parameters }
    };
}
