import { state } from './state.js';

/**
 * storyLogic.js - Traces the "Main Storyline" through nodes and attaches side-context.
 *
 * Rules:
 * 1. A "Main Storyline" is defined by traversing backwards from the End Node (e.g. AI Generator)
 *    along the 'left'/'in' socket explicitly.
 * 2. Any other nodes attached to the 'top'/'bottom' sockets of a Story Node are considered
 *    "Side Context" (Lore, Characters, Items) for that specific point in the story.
 * 3. The final assembled prompt explicitly lists the chronological story steps, and
 *    the associated context for each step.
 */

export function gatherStoryContext(endNodeId) {
    let storyline = []; // Array of chronological steps
    let visited = new Set();

    // 1. Trace the main spine backwards
    let currentNodeId = endNodeId;

    while (currentNodeId) {
        if (visited.has(currentNodeId)) break;
        visited.add(currentNodeId);

        const node = state.nodes[currentNodeId];
        if (!node) break;

        // Don't add the generator node itself to the story text
        if (currentNodeId !== endNodeId) {
            // Find side connections to this specific node (Top / Bottom)
            let sideNotes = [];
            const sideEdges = state.edges.filter(e =>
                (e.toNode === currentNodeId && (e.toType === 'top' || e.toType === 'bottom')) ||
                (e.fromNode === currentNodeId && (e.fromType === 'top' || e.fromType === 'bottom'))
            );

            sideEdges.forEach(e => {
                const otherId = e.fromNode === currentNodeId ? e.toNode : e.fromNode;
                if (!visited.has(otherId) && state.nodes[otherId]) {
                    visited.add(otherId);
                    sideNotes.push(extractNodeText(state.nodes[otherId]));
                }
            });

            storyline.unshift({
                stepText: extractNodeText(node),
                context: sideNotes
            });
        }

        // Find the previous node in the main spine (connected to the 'in' / left socket of current node)
        // Usually, the previous node's 'out' connects to the current node's 'in'.
        const prevEdge = state.edges.find(e => e.toNode === currentNodeId && e.toType === 'in');

        if (prevEdge) {
            currentNodeId = prevEdge.fromNode;
        } else {
            // No more explicit 'in' connections, stop tracing the spine
            break;
        }
    }

    return formatStoryPrompt(storyline);
}

function extractNodeText(node) {
    if (!node || !node.el) return { title: 'Unknown', content: '' };

    const titleEl = node.el.querySelector('.node-title');
    const title = titleEl ? titleEl.value : 'Заметка';

    let content = '';

    // Get text from standard textarea if it exists and is visible
    const defaultTextarea = node.el.querySelector('.node-textarea');
    if (defaultTextarea && defaultTextarea.style.display !== 'none') {
        content = defaultTextarea.value;
    } else {
        // Otherwise, gather all visible input/textarea values in the body
        const inputs = node.el.querySelectorAll('.node-body input:not([type="checkbox"]):not(.node-title), .node-body textarea:not([readonly])');
        let parts = [];
        inputs.forEach(inp => {
            if (inp.value && inp.value.trim()) {
                // If it has a placeholder, use it as a label
                const label = inp.placeholder ? `${inp.placeholder}: ` : '';
                parts.push(`${label}${inp.value}`);
            }
        });
        content = parts.join('\n');
    }

    return { title, content: content.trim() };
}

function formatStoryPrompt(storyline) {
    if (storyline.length === 0) return "";

    let prompt = "--- ХРОНОЛОГИЯ СЮЖЕТА И КОНТЕКСТ ---\n\n";

    storyline.forEach((step, index) => {
        prompt += `[ШАГ ${index + 1}: ${step.stepText.title}]\n${step.stepText.content}\n`;

        if (step.context.length > 0) {
            prompt += `  (Связанные данные и лор для этого шага):\n`;
            step.context.forEach(ctx => {
                prompt += `  - [${ctx.title}]: ${ctx.content}\n`;
            });
        }
        prompt += `\n`;
    });

    prompt += "------------------------------------\n";
    return prompt;
}
