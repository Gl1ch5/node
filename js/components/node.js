import { state, screenToWorld, genId } from '../core/state.js';
import { nodesContainer, svgLayer, resizeObserver } from '../core/workspace.js';
import { renderEdges, createEdge, getSocketCoords, drawBezier } from './edge.js';

export function selectNode(id, multi = false) {
    if (!multi) {
        state.selectedNodeIds.forEach(nodeId => {
            if (state.nodes[nodeId]) state.nodes[nodeId].el.classList.remove('selected');
        });
        state.selectedNodeIds.clear();
    }

    if (id) {
        if (state.selectedNodeIds.has(id)) {
            state.selectedNodeIds.delete(id);
            if (state.nodes[id]) state.nodes[id].el.classList.remove('selected');
        } else {
            state.selectedNodeIds.add(id);
            if (state.nodes[id]) {
                const node = state.nodes[id];
                node.el.classList.add('selected');
                state.zIndexCounter++;
                node.el.style.zIndex = state.zIndexCounter;
            }
        }
    }
}

export let clipboard = null;

export function copySelectedNodes() {
    if (state.selectedNodeIds.size === 0) return;
    const nodesInfo = [];
    let minX = Infinity, minY = Infinity;
    
    state.selectedNodeIds.forEach(id => {
        const n = state.nodes[id];
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        
        nodesInfo.push({
            title: n.el.querySelector('.node-title').value,
            text: n.el.querySelector('.node-textarea').value,
            offsetX: n.x,
            offsetY: n.y,
            width: n.el.style.minWidth || '',
            height: n.el.querySelector('.node-textarea').style.minHeight || '',
            isLabSource: n.el.classList.contains('lab-node'),
            borderColor: n.el.style.border || ''
        });
    });

    // Normalize offsets
    nodesInfo.forEach(n => {
        n.offsetX -= minX;
        n.offsetY -= minY;
    });

    clipboard = nodesInfo;
}

export function pasteNodes(worldX, worldY) {
    if (!clipboard || clipboard.length === 0) return;
    
    selectNode(null); // clear current selection
    
    clipboard.forEach(data => {
        const id = createNode(worldX + data.offsetX, worldY + data.offsetY);
        const node = state.nodes[id];
        node.el.querySelector('.node-title').value = data.title;
        node.el.querySelector('.node-textarea').value = data.text;
        
        if (data.width) node.el.style.minWidth = data.width;
        if (data.height) node.el.querySelector('.node-textarea').style.minHeight = data.height;
        if (data.isLabSource) node.el.classList.add('lab-node');
        if (data.borderColor) node.el.style.border = data.borderColor;
        
        state.selectedNodeIds.add(id);
        node.el.classList.add('selected');
    });
}

export function groupSelectedNodes() {
    if (state.selectedNodeIds.size < 2) return; // Need at least 2 nodes to group

    const groupId = genId();
    const groupNodesList = Array.from(state.selectedNodeIds);

    // Calculate bounding box center
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupNodesList.forEach(id => {
        const n = state.nodes[id];
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + 280 > maxX) maxX = n.x + 280; // approximate width
        if (n.y + 150 > maxY) maxY = n.y + 150; // approximate height
    });
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    // Save actual DOM elements and their logic into the state.groups
    state.groups[groupId] = {
        nodes: groupNodesList.map(id => {
            const n = state.nodes[id];
            n.el.style.display = 'none'; // hide original nodes
            return n;
        })
    };

    // Clear selection
    selectNode(null);

    // Create the Group Node
    const newGroupNodeId = createNode(centerX - 140, centerY - 75);
    const groupNode = state.nodes[newGroupNodeId];
    groupNode.el.classList.add('group-node');
    groupNode.el.querySelector('.node-title').value = "Новая Группа";
    groupNode.el.querySelector('.node-textarea').value = `Содержит ${groupNodesList.length} нод(ы). Нажмите 'Разгруппировать' чтобы извлечь их.`;
    groupNode.el.querySelector('.node-textarea').readOnly = true;

    // Replace the delete button logic to just ungroup for this specific group node, or add an ungroup button
    const header = groupNode.el.querySelector('.node-header');

    const ungroupBtn = document.createElement('button');
    ungroupBtn.className = 'node-delete-btn';
    ungroupBtn.title = 'Разгруппировать';
    ungroupBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>`;

    ungroupBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();

        // Restore original nodes
        state.groups[groupId].nodes.forEach(n => {
            n.el.style.display = '';
            // Offset them slightly from the group node's current position
            n.x = groupNode.x + (Math.random() * 40 - 20);
            n.y = groupNode.y + (Math.random() * 40 - 20);
            n.el.style.left = `${n.x}px`;
            n.el.style.top = `${n.y}px`;
        });

        delete state.groups[groupId];
        deleteNode(newGroupNodeId);
        renderEdges();
    });

    header.insertBefore(ungroupBtn, header.lastElementChild);
    renderEdges();
}

import { getNodeDefinition } from '../core/nodeRegistry.js';

export function createNode(worldX, worldY, typeName = 'text') {
    const id = genId();
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.id = id;
    nodeEl.dataset.type = typeName;
    nodeEl.style.left = `${worldX}px`;
    nodeEl.style.top = `${worldY}px`;
    state.zIndexCounter++;
    nodeEl.style.zIndex = state.zIndexCounter;

    const gripIcon = `<svg viewBox="0 0 24 24"><circle cx="8" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></svg>`;
    const trashIcon = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    const micIcon = `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

    const def = getNodeDefinition(typeName) || getNodeDefinition('text');
    const title = def?.title || 'Заметка';

    nodeEl.innerHTML = `
        <div class="node-header">
            <div class="drag-icon">${gripIcon}</div>
            <input type="text" class="node-title" value="${title}">
            <button class="node-mic-btn" title="Голосовой ввод (Whisper)" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:2px; display:flex; align-items:center;">${micIcon}</button>
            <button class="node-delete-btn" title="Удалить ноду">${trashIcon}</button>
        </div>
        <div class="node-body">
            <div class="socket-hitbox top" data-node="${id}" data-type="top" title="Свойство / Ветка"><div class="socket"></div></div>
            <div class="socket-hitbox in" data-node="${id}" data-type="in" title="Вход"><div class="socket"></div></div>
            <textarea class="node-textarea" placeholder="Дважды тапните по фону..."></textarea>
            <div class="socket-hitbox out" data-node="${id}" data-type="out" title="Выход"><div class="socket"></div></div>
            <div class="socket-hitbox bottom" data-node="${id}" data-type="bottom" title="Детали / Свойства"><div class="socket"></div></div>
        </div>
    `;

    nodesContainer.appendChild(nodeEl);
    resizeObserver.observe(nodeEl);
    state.nodes[id] = { el: nodeEl, x: worldX, y: worldY, type: typeName };

    // Apply custom styles from definition
    if (def?.style) {
        Object.assign(nodeEl.style, def.style);
    }

    // Call custom setup from definition
    if (def?.setup) {
        def.setup(state.nodes[id], id);
    }

    // Логика кнопки удаления
    const deleteBtn = nodeEl.querySelector('.node-delete-btn');
    deleteBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // Не перехватываем выделение и таскание
        deleteNode(id);
    });

    // Voice Input Logic (Whisper)
    const micBtn = nodeEl.querySelector('.node-mic-btn');
    let mediaRecorder = null;
    let audioChunks = [];

    micBtn.addEventListener('pointerdown', async (e) => {
        e.stopPropagation();

        // Find the active text target (either the default textarea or first text input if hidden)
        const textarea = nodeEl.querySelector('.node-textarea');
        const customTarget = textarea.style.display !== 'none'
            ? textarea
            : nodeEl.querySelector('textarea:not([readonly]), input[type="text"]:not(.node-title)');

        if (!customTarget) {
            alert('В этой ноде нет подходящего поля для ввода текста.');
            return;
        }

        if (mediaRecorder && mediaRecorder.state === 'recording') {
            // Stop recording
            mediaRecorder.stop();
            micBtn.classList.remove('recording');
            micBtn.title = "Голосовой ввод (Whisper)";
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    // Stop tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());

                    // Prepare UI for transcription
                    const originalPlaceholder = customTarget.placeholder;
                    customTarget.placeholder = "⏳ Распознавание голоса (Whisper)...";

                    try {
                        // Dynamically import AI utils to get keys and proxy logic
                        const aiUtils = await import('../core/aiUtils.js');
                        const provider = aiUtils.getProvider();

                        if (provider !== 'groq') {
                            alert("Whisper (Голосовой ввод) в данный момент поддерживается только через провайдера Groq.");
                            customTarget.placeholder = originalPlaceholder;
                            return;
                        }

                        const apiKey = aiUtils.getApiKey('groq');
                        if (!apiKey) {
                            alert("Пожалуйста, укажите Groq API ключ в настройках (⚙ -> Глобальный ИИ).");
                            customTarget.placeholder = originalPlaceholder;
                            return;
                        }

                        const formData = new FormData();
                        // For Groq Whisper, we provide the file, model, and optionally language
                        formData.append('file', audioBlob, 'audio.webm');
                        formData.append('model', 'whisper-large-v3');

                        // Use aiUtils.getBaseUrl() which handles the proxy wrapper
                        let baseUrl = aiUtils.getBaseUrl('groq');
                        // Ensure we hit the audio transcription endpoint correctly.
                        // getBaseUrl returns something like `https://api.groq.com/openai/v1` or `https://corsproxy.io/?url=...openai/v1`
                        // We need to append `/audio/transcriptions`.
                        // If it uses corsproxy.io, appending directly might break the query parameter format,
                        // so we need to construct it carefully.
                        let transcriptionUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
                        if (aiUtils.useProxy()) {
                            transcriptionUrl = `https://corsproxy.io/?url=${encodeURIComponent(transcriptionUrl)}`;
                        }

                        const response = await fetch(transcriptionUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`
                                // Do NOT set Content-Type, browser will automatically set it to multipart/form-data with boundary
                            },
                            body: formData
                        });

                        if (!response.ok) {
                            const err = await response.json().catch(()=>({}));
                            throw new Error(err.error?.message || `Ошибка сервера: ${response.status}`);
                        }

                        const data = await response.json();
                        if (data.text) {
                            const currentVal = customTarget.value;
                            customTarget.value = currentVal ? currentVal + ' ' + data.text : data.text;
                        }

                    } catch (err) {
                        console.error('Whisper Error:', err);
                        alert(`Ошибка распознавания: ${err.message}`);
                    } finally {
                        customTarget.placeholder = originalPlaceholder;
                    }
                });

                mediaRecorder.start();
                micBtn.classList.add('recording');
                micBtn.title = "Остановить запись...";

            } catch (err) {
                console.error("Mic Access Error:", err);
                alert("Ошибка доступа к микрофону. Убедитесь, что разрешили его использование в браузере.");
            }
        }
    });

    // ИЗОЛИРОВАННАЯ ЛОГИКА ПЕРЕТАСКИВАНИЯ НОДЫ
    const header = nodeEl.querySelector('.node-header');
    header.addEventListener('pointerdown', (e) => {
        if (e.button === 1) return; // Allow middle click to bubble up for workspace panning
        // Если кликнули в текстовое поле или кнопку удаления - не тащим
        if (e.target.tagName === 'INPUT' || e.target.closest('.node-delete-btn')) return;

        // Только для левой кнопки мыши или тача
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        e.preventDefault(); // Останавливаем скролл телефона
        e.stopPropagation(); // Останавливаем панорамирование фона

        selectNode(id, e.shiftKey || e.ctrlKey || e.metaKey);

        // Захват указателя для надежного перетаскивания на мобилках
        header.setPointerCapture(e.pointerId);

        // Фиксируем смещение для всех выделенных нод
        const startWorld = screenToWorld(e.clientX, e.clientY);

        // Сохраняем начальные позиции всех выделенных нод, чтобы тащить их вместе
        const selectedNodesOffsets = [];
        state.selectedNodeIds.forEach(nodeId => {
            const n = state.nodes[nodeId];
            if (n) {
                selectedNodesOffsets.push({
                    node: n,
                    offsetX: startWorld.x - n.x,
                    offsetY: startWorld.y - n.y
                });
            }
        });

        const onMove = (moveEvent) => {
            const currentWorld = screenToWorld(moveEvent.clientX, moveEvent.clientY);

            selectedNodesOffsets.forEach(({node, offsetX, offsetY}) => {
                node.x = currentWorld.x - offsetX;
                node.y = currentWorld.y - offsetY;
                node.el.style.left = `${node.x}px`;
                node.el.style.top = `${node.y}px`;
            });
            renderEdges();
        };

        const onUp = (upEvent) => {
            header.releasePointerCapture(upEvent.pointerId);
            header.removeEventListener('pointermove', onMove);
            header.removeEventListener('pointerup', onUp);
            header.removeEventListener('pointercancel', onUp);
        };

        header.addEventListener('pointermove', onMove);
        header.addEventListener('pointerup', onUp);
        header.addEventListener('pointercancel', onUp);
    });

    // ИЗОЛИРОВАННАЯ ЛОГИКА РИСОВАНИЯ СВЯЗЕЙ
    nodeEl.querySelectorAll('.socket-hitbox').forEach(sock => {
        sock.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startNodeId = sock.dataset.node;
            const startType = sock.dataset.type;

            let tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPath.setAttribute('class', 'noodle-temp');
            svgLayer.appendChild(tempPath);

            const updateLine = (clientX, clientY) => {
                const start = getSocketCoords(startNodeId, startType);
                const end = screenToWorld(clientX, clientY);
                let pathD = "";

                if (startType === 'out' || startType === 'in') {
                    pathD = startType === 'out'
                        ? drawBezier(start.x, start.y, end.x, end.y)
                        : drawBezier(end.x, end.y, start.x, start.y);
                } else {
                    // Вертикальные кривые для top/bottom
                    pathD = startType === 'bottom'
                        ? drawBezier(start.x, start.y, end.x, end.y, true)
                        : drawBezier(end.x, end.y, start.x, start.y, true);
                }

                tempPath.setAttribute('d', pathD);
            };

            updateLine(e.clientX, e.clientY);

            const onMove = (moveEvt) => updateLine(moveEvt.clientX, moveEvt.clientY);

            const onUp = (upEvt) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onUp);

                tempPath.style.display = 'none';
                const dropEl = document.elementFromPoint(upEvt.clientX, upEvt.clientY);
                tempPath.style.display = '';

                const targetHitbox = dropEl ? dropEl.closest('.socket-hitbox') : null;

                if (targetHitbox) {
                    const targetNode = targetHitbox.dataset.node;
                    const targetType = targetHitbox.dataset.type;

                    if (targetNode !== startNodeId) {
                        createEdge(startNodeId, startType, targetNode, targetType);
                    }
                } else if (dropEl && (dropEl.tagName === 'BODY' || dropEl.tagName === 'CANVAS' || dropEl.id === 'workspace')) {
                    // Open search menu to create node and connect
                    let tType = 'in';
                    if (startType === 'out') { tType = 'in'; }
                    else if (startType === 'in') { tType = 'out'; }
                    else if (startType === 'bottom') { tType = 'top'; }
                    else if (startType === 'top') { tType = 'bottom'; }

                    import('../core/workspace.js').then(m => {
                        if (m.searchMenuInstance) {
                            m.searchMenuInstance.getSearchMenu().open(upEvt.clientX, upEvt.clientY, {
                                startNodeId, startType, targetType: tType
                            });
                        }
                    });
                }

                tempPath.remove();
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            document.addEventListener('pointercancel', onUp);
        });
    });

    // Выделение по клику (если кликнули в тело ноды)
    nodeEl.addEventListener('pointerdown', (e) => {
        if (e.button === 1) return; // Allow middle click to bubble up for workspace panning
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            selectNode(id, e.shiftKey || e.ctrlKey || e.metaKey);
            e.stopPropagation();
        }
    });

    return id;
}

export function deleteNode(id) {
    if (!state.nodes[id]) return;
    resizeObserver.unobserve(state.nodes[id].el);
    state.nodes[id].el.remove();
    delete state.nodes[id];
    state.edges = state.edges.filter(edge => edge.fromNode !== id && edge.toNode !== id);
    renderEdges();
}