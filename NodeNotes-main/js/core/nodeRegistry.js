export const nodeRegistry = new Map();

/**
 * Registers a new node type.
 * @param {string} typeName - The unique identifier for the node type.
 * @param {object} definition - The node definition object.
 * @param {string} definition.title - The default title of the node.
 * @param {string} definition.category - Category for the search menu (e.g., "Basic", "AI", "Export").
 * @param {Function} definition.setup - Callback to setup the node's DOM and logic: `(node, id) => void`.
 * @param {object} [definition.style] - Optional CSS styles for the node element.
 */
export function registerNodeType(typeName, definition) {
    if (nodeRegistry.has(typeName)) {
        console.warn(`Node type "${typeName}" is already registered. Overwriting.`);
    }
    nodeRegistry.set(typeName, definition);
}

export function getNodeDefinition(typeName) {
    return nodeRegistry.get(typeName);
}

export function getAllNodeTypes() {
    return Array.from(nodeRegistry.entries()).map(([typeName, definition]) => ({
        typeName,
        ...definition
    }));
}
