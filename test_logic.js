let storyEdges = [
    { fromNode: 'Step1', fromType: 'out', toNode: 'Step2', toType: 'in' },
    { fromNode: 'Step2', fromType: 'out', toNode: 'Step3', toType: 'in' },
    { fromNode: 'Step3', fromType: 'out', toNode: 'EndNode', toType: 'in' }
];
let endNodeId = 'EndNode';

let currentNodeId = endNodeId;
let storyline = [];
let visited = new Set();

while (currentNodeId) {
    if (visited.has(currentNodeId)) break;
    visited.add(currentNodeId);

    if (currentNodeId !== endNodeId) {
        storyline.unshift(currentNodeId);
    }

    const prevEdge = storyEdges.find(e => e.toNode === currentNodeId && e.toType === 'in');
    if (prevEdge) {
        currentNodeId = prevEdge.fromNode;
    } else {
        break;
    }
}
console.log(storyline);
