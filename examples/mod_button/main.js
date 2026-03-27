// Это пример мода, который добавляет кнопку на верхнюю панель
const panel = document.getElementById('top-panel');

if (!document.getElementById('my-custom-mod-btn')) {
    const btn = document.createElement('button');
    btn.className = 'panel-btn';
    btn.id = 'my-custom-mod-btn';
    btn.title = 'Привет из Мода!';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg><span>Custom Button</span>`;
    
    btn.addEventListener('click', () => {
        alert("Вы нажали на кнопку, добавленную модом из .zip архива!");
    });
    
    panel.appendChild(btn);
}
