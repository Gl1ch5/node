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

export function addMod(name, code, api) {
    const newMod = {
        id: 'mod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name,
        code,
        enabled: true
    };
    installedMods.push(newMod);
    saveModsToStorage();
    executeMod(newMod, api);
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

        // Note: we let JSON pass through to persistence.js, but if it's a zip or js we handle it here.
        if (file.name.endsWith('.zip') || file.name.endsWith('.js')) {
            e.preventDefault();
            e.stopPropagation();
            handleModFile(file, api);
        }
    });
}

export function handleModFile(file, api) {
    if (file.name.endsWith('.zip')) {
        if (!window.JSZip) {
            alert('JSZip library not loaded');
            return;
        }
        window.JSZip.loadAsync(file).then(zip => {
            // Check for mod.json or fallback to main.js
            let mainFile = zip.file('main.js');
            let modName = file.name.replace('.zip', '');

            if (zip.file('mod.json')) {
                zip.file('mod.json').async('string').then(jsonStr => {
                    try {
                        const meta = JSON.parse(jsonStr);
                        modName = meta.name || modName;
                        if (meta.main && zip.file(meta.main)) {
                            mainFile = zip.file(meta.main);
                        }
                    } catch (e) {
                        console.warn('Failed to parse mod.json:', e);
                    }
                    readMainAndInstall(mainFile, modName, api);
                });
            } else {
                readMainAndInstall(mainFile, modName, api);
            }
        }).catch(e => alert(`ZIP error: ${e.message}`));
    } else if (file.name.endsWith('.js')) {
        const reader = new FileReader();
        reader.onload = (e) => addMod(file.name.replace('.js', ''), e.target.result, api);
        reader.readAsText(file);
    }
}

function readMainAndInstall(mainFile, modName, api) {
    if (!mainFile) {
        alert('ZIP архив должен содержать главный JS файл (например, main.js)');
        return;
    }
    mainFile.async('string').then(code => {
        addMod(modName, code, api);
        alert(`Мод "${modName}" установлен! Обновите страницу, чтобы применить все изменения.`);
    });
}