import { registerNodeType } from '../../core/nodeRegistry.js';

export function initTextNode() {
    registerNodeType('text', {
        title: 'Заметка',
        category: 'Basic',
        setup: (node, id) => {
            // Text node uses the default HTML structure created by node.js. No extra setup needed.
        }
    });
}
