import { registerNodeType } from './nodeRegistry.js';
import { state } from './state.js';
// We'll pass some utility functions to the mod context. We can't import createNode directly if we want to avoid circular dependencies, so we'll construct an api object on init.

const STORAGE_KEY = 'nn_mods';
export let installedMods = [];

export function initModManager(api) {
    loadModsFromStorage();

    // Execute all enabled mods
    installedMods.forEach(mod => {
        if (mod.enabled !== false) {
            executeMod(mod, api);
        }
    });

    setupModDragAndDrop(api);
    setupModsPanelUI(api);
}

function setupModsPanelUI(api) {
    const btnMods = document.getElementById('btn-mods');
    const modsPanel = document.getElementById('mods-panel');
    const btnCloseMods = document.getElementById('btn-close-mods');
    const modsGrid = document.getElementById('mods-grid');
    const uploadInput = document.getElementById('mods-panel-upload');

    if (!btnMods || !modsPanel || !modsGrid) return;

    // Toggle panel
    btnMods.addEventListener('click', () => {
        const isVisible = modsPanel.style.display === 'flex';
        modsPanel.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) renderModsGrid();
    });

    btnCloseMods.addEventListener('click', () => {
        modsPanel.style.display = 'none';
    });

    // Close on click outside
    document.addEventListener('pointerdown', (e) => {
        if (modsPanel.style.display === 'flex' &&
            !modsPanel.contains(e.target) &&
            !btnMods.contains(e.target)) {
            modsPanel.style.display = 'none';
        }
    });

    // Handle manual upload
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleModFile(file, api);
            }
            e.target.value = ''; // reset
        });
    }

    // Expose render function globally so handleModFile can refresh the UI
    window.renderModsPanel = renderModsGrid;

    function renderModsGrid() {
        modsGrid.innerHTML = '';

        if (installedMods.length === 0) {
            modsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Моды пока не установлены.</div>';
            return;
        }

        installedMods.forEach(mod => {
            const tile = document.createElement('div');
            tile.style.cssText = `
                background: var(--input-bg);
                border: 1px solid var(--node-border);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: transform 0.1s, box-shadow 0.1s;
                position: relative;
            `;
            if (mod.enabled !== false) {
                tile.style.border = '1px solid var(--text-main)';
            }

            // Header row with Icon and Name
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; align-items: center; gap: 8px;';

            const iconDiv = document.createElement('div');
            iconDiv.style.cssText = 'width: 32px; height: 32px; border-radius: 6px; background: var(--panel-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;';

            if (mod.icon) {
                if (mod.icon.startsWith('data:image') || mod.icon.startsWith('http')) {
                    iconDiv.innerHTML = `<img src="${mod.icon}" style="width:100%; height:100%; object-fit:cover;">`;
                } else if (mod.icon.startsWith('<svg')) {
                    iconDiv.innerHTML = mod.icon;
                    const svg = iconDiv.querySelector('svg');
                    if (svg) { svg.style.width='100%'; svg.style.height='100%'; svg.style.fill='var(--text-main)'; }
                } else {
                    iconDiv.textContent = mod.icon; // emoji fallback
                    iconDiv.style.fontSize = '20px';
                }
            } else {
                iconDiv.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:var(--text-muted);"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`;
            }

            const title = document.createElement('div');
            title.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
            title.textContent = mod.name || 'Unnamed Mod';

            header.appendChild(iconDiv);
            header.appendChild(title);
            tile.appendChild(header);

            // Description
            const desc = document.createElement('div');
            desc.style.cssText = 'font-size: 11px; color: var(--text-muted); line-height: 1.4; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;';
            desc.textContent = mod.description || 'Нет описания.';
            tile.appendChild(desc);

            // Controls row
            const controls = document.createElement('div');
            controls.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 4px;';

            // Toggle switch logic via a simple button
            const toggleBtn = document.createElement('button');
            const isEnabled = mod.enabled !== false;
            toggleBtn.textContent = isEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН';
            toggleBtn.style.cssText = `
                background: ${isEnabled ? 'var(--text-main)' : 'transparent'};
                color: ${isEnabled ? 'var(--bg-color)' : 'var(--text-muted)'};
                border: 1px solid ${isEnabled ? 'var(--text-main)' : 'var(--node-border)'};
                border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: 600; cursor: pointer; transition: 0.2s;
            `;

            toggleBtn.addEventListener('click', () => {
                toggleMod(mod.id, !isEnabled);
                renderModsGrid();
                // We prompt user to refresh for clean state application
                if (!isEnabled) {
                    alert(`Мод "${mod.name}" включен. Пожалуйста, перезагрузите страницу для применения.`);
                } else {
                    alert(`Мод "${mod.name}" выключен. Пожалуйста, перезагрузите страницу для полного удаления его эффектов.`);
                }
            });

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
            delBtn.style.cssText = 'background: transparent; color: #ff4a4a; border: none; cursor: pointer; padding: 4px; border-radius:4px; display:flex; align-items:center; justify-content:center;';
            delBtn.title = "Удалить мод";
            delBtn.addEventListener('click', () => {
                if (confirm(`Удалить мод "${mod.name}" навсегда?`)) {
                    removeMod(mod.id);
                    renderModsGrid();
                    alert('Мод удален. Перезагрузите страницу для очистки кэша.');
                }
            });

            controls.appendChild(toggleBtn);
            controls.appendChild(delBtn);
            tile.appendChild(controls);

            modsGrid.appendChild(tile);
        });
    }
}

function loadModsFromStorage() {
    try {
        installedMods = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        installedMods = [];
    }
}

export function saveModsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(installedMods));
}

function executeMod(mod, api) {
    try {
        const modFunc = new Function('api', mod.code);
        modFunc(api);
        console.log(`Mod loaded: ${mod.name}`);
    } catch (err) {
        console.error(`Failed to execute mod "${mod.name}":`, err);
    }
}

export function addMod(name, code, api, meta = {}) {
    const newMod = {
        id: 'mod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: meta.name || name,
        description: meta.description || '',
        icon: meta.icon || '', // base64 or inline SVG string
        code,
        enabled: true
    };
    installedMods.push(newMod);
    saveModsToStorage();
    executeMod(newMod, api);
    if (window.renderModsPanel) window.renderModsPanel();
    return newMod;
}

export function removeMod(id) {
    installedMods = installedMods.filter(m => m.id !== id);
    saveModsToStorage();
    // Requires reload to fully remove mod effects if they modify DOM globally,
    // but for now we just remove it from storage.
}

export function toggleMod(id, enabled) {
    const mod = installedMods.find(m => m.id === id);
    if (mod) {
        mod.enabled = enabled;
        saveModsToStorage();
    }
}

function setupModDragAndDrop(api) {
    document.body.addEventListener('dragover', e => {
        // Prevent default only if it's a file
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    document.body.addEventListener('drop', e => {
        if (!e.dataTransfer.types.includes('Files')) return;

        const file = e.dataTransfer.files[0];
        if (!file) return;

        // Note: we let JSON pass through to persistence.js, but if it's a zip we handle it here.
        if (file.name.endsWith('.zip')) {
            e.preventDefault();
            e.stopPropagation();
            handleModFile(file, api);
        } else if (file.name.endsWith('.js')) {
            e.preventDefault();
            e.stopPropagation();
            alert('Скрипты .js больше не поддерживаются напрямую. Пожалуйста, упакуйте ваш мод в .zip архив с файлом mod.json внутри, как описано в документации.');
        }
    });
}

export function handleModFile(file, api) {
    if (!file.name.endsWith('.zip')) {
        alert('Поддерживаются только .zip архивы для модов.');
        return;
    }
    if (!window.JSZip) {
        alert('JSZip library not loaded');
        return;
    }
    window.JSZip.loadAsync(file).then(async zip => {
        // Require mod.json
        const modJsonFile = zip.file('mod.json');
        if (!modJsonFile) {
            alert('Ошибка: Архив не содержит обязательный файл mod.json. Пожалуйста, ознакомьтесь с документацией.');
            return;
        }

        try {
            const jsonStr = await modJsonFile.async('string');
            const meta = JSON.parse(jsonStr);

            if (!meta.name || !meta.main) {
                alert('Ошибка: mod.json должен содержать как минимум поля "name" и "main".');
                return;
            }

            const mainFile = zip.file(meta.main);
            if (!mainFile) {
                alert(`Ошибка: Главный файл "${meta.main}" не найден в архиве.`);
                return;
            }

            const code = await mainFile.async('string');

            // Handle optional icon (load as base64 data URI if it's an image file, or keep as string if it's SVG code)
            let iconData = '';
            if (meta.icon && zip.file(meta.icon)) {
                const ext = meta.icon.split('.').pop().toLowerCase();
                if (ext === 'svg') {
                    // Extract SVG as string to allow inline embedding or data URI
                    const svgStr = await zip.file(meta.icon).async('string');
                    iconData = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
                } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                    const base64 = await zip.file(meta.icon).async('base64');
                    iconData = `data:image/${ext};base64,${base64}`;
                } else {
                    // Assume it might be an emoji or direct URL string provided in json if not found in zip
                    iconData = meta.icon;
                }
            } else if (meta.icon) {
                // If it's just an emoji or external URL
                iconData = meta.icon;
            }

            meta.icon = iconData; // override with loaded data

            addMod(meta.name, code, api, meta);
            alert(`Мод "${meta.name}" успешно установлен! Обратите внимание: для полного применения некоторых модов может потребоваться перезагрузка страницы.`);

        } catch (e) {
            console.error(e);
            alert(`Ошибка при чтении мода: ${e.message}`);
        }
    }).catch(e => alert(`Ошибка ZIP архива: ${e.message}`));
}