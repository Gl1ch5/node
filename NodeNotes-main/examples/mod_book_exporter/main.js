// Пример мода: Продвинутый экспортер книг (Book Exporter)
// Принимает входы от разных нод и формирует полноценный HTML-документ книги
// (с оглавлением, названием, авторами и красивым форматированием).

const { createLabNode, state } = api;

const id = createLabNode(
    "📚 Book Exporter", 
    "Соберите книгу из входящих нод", 
    -100, 200, 
    (node, nodeId, ta) => {
        node.el.style.border = '2px solid #eab308'; // Желтый/золотой
        ta.style.display = 'none';
        node.el.style.minWidth = '300px';

        const body = node.el.querySelector('.node-body');

        // Рисуем UI настроек (до 20 настроек можно добавить)
        const ui = document.createElement('div');
        ui.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:4px; width:100%;';

        const inputStyle = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:6px;font-size:12px;width:100%;box-sizing:border-box;outline:none;user-select:text;-webkit-user-select:text;`;

        // UI инпуты
        const titleInput = document.createElement('input');
        titleInput.id = `book-title-${nodeId}`;
        titleInput.type = "text";
        titleInput.placeholder = "Название книги";
        titleInput.value = "Моя великая книга";
        titleInput.style.cssText = inputStyle;

        const authorInput = document.createElement('input');
        authorInput.id = `book-author-${nodeId}`;
        authorInput.type = "text";
        authorInput.placeholder = "Автор";
        authorInput.value = "Автор";
        authorInput.style.cssText = inputStyle;

        const tocSelect = document.createElement('select');
        tocSelect.id = `book-toc-${nodeId}`;
        tocSelect.style.cssText = inputStyle;
        const optYes = document.createElement('option'); optYes.value = "yes"; optYes.textContent = "Включить оглавление";
        const optNo = document.createElement('option'); optNo.value = "no"; optNo.textContent = "Без оглавления";
        tocSelect.appendChild(optYes); tocSelect.appendChild(optNo);

        const exportBtn = document.createElement('button');
        exportBtn.id = `book-export-btn-${nodeId}`;
        exportBtn.textContent = "💾 Скачать Книгу (HTML/Печать в PDF)";
        exportBtn.style.cssText = "margin-top:12px; background:#eab308; color:black; border:none; border-radius:8px; padding:10px; font-weight:600; cursor:pointer;";

        ui.appendChild(titleInput);
        ui.appendChild(authorInput);
        ui.appendChild(tocSelect);
        ui.appendChild(exportBtn);

        body.appendChild(ui);

        // Чтобы предотвратить панорамирование при клике на селекты и инпуты
        ui.querySelectorAll('input, select, button').forEach(el => {
            el.addEventListener('pointerdown', e => e.stopPropagation());
        });

        // Логика экспорта
        exportBtn.addEventListener('click', () => {
            // Ищем все входящие связи (вход "in")
            const incomingEdges = state.edges.filter(e => e.toNode === nodeId && e.toType === 'in');
            if (incomingEdges.length === 0) {
                alert("Подключите хотя бы одну ноду с текстом к Book Exporter!");
                return;
            }

            const title = titleInput.value || "Untitled";
            const author = authorInput.value || "Unknown";
            const includeToc = tocSelect.value === 'yes';

            // Собираем главы
            const chapters = [];
            incomingEdges.forEach(edge => {
                const targetNode = state.nodes[edge.fromNode];
                if (targetNode) {
                    const chapterTitle = targetNode.el.querySelector('.node-title').value;
                    const chapterText = targetNode.el.querySelector('.node-textarea').value;
                    chapters.push({ title: chapterTitle, text: chapterText });
                }
            });

            // Формируем HTML
            let htmlContent = `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body {
                        font-family: 'Georgia', serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px 20px;
                        background: #fdfdfd;
                    }
                    h1.book-title { text-align: center; font-size: 3em; margin-bottom: 0.2em; }
                    h2.book-author { text-align: center; font-style: italic; font-weight: normal; color: #666; margin-bottom: 3em; }
                    .toc { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 3em; page-break-after: always; }
                    .toc h3 { margin-top: 0; }
                    .toc ul { list-style: none; padding-left: 0; }
                    .toc li { margin-bottom: 8px; border-bottom: 1px dotted #ccc; }
                    .toc a { text-decoration: none; color: #0056b3; }
                    .chapter { margin-bottom: 4em; page-break-before: always; }
                    .chapter-title { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 30px; }
                    p { text-indent: 1.5em; text-align: justify; margin-bottom: 10px; }
                    @media print {
                        body { background: white; padding: 0; }
                        .toc { page-break-after: always; border: none; background: transparent; }
                        .chapter { page-break-before: always; }
                    }
                </style>
            </head>
            <body>
                <h1 class="book-title">${title}</h1>
                <h2 class="book-author">${author}</h2>
            `;

            // Оглавление
            if (includeToc) {
                htmlContent += `<div class="toc"><h3>Оглавление</h3><ul>`;
                chapters.forEach((ch, idx) => {
                    htmlContent += `<li><a href="#chapter-${idx}">${idx + 1}. ${ch.title}</a></li>`;
                });
                htmlContent += `</ul></div>`;
            }

            // Главы
            chapters.forEach((ch, idx) => {
                const paragraphs = ch.text.split('\\n').filter(p => p.trim() !== '');
                const formattedText = paragraphs.map(p => `<p>${p}</p>`).join('');
                htmlContent += `
                    <div class="chapter" id="chapter-${idx}">
                        <h2 class="chapter-title">${idx + 1}. ${ch.title}</h2>
                        ${formattedText}
                    </div>
                `;
            });

            htmlContent += `</body></html>`;

            // Скачивание
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${title.replace(/\\s+/g, '_')}.html`;
            a.click();
        });
    }
);
