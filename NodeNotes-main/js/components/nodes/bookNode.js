import { registerNodeType } from '../../core/nodeRegistry.js';
import { streamCompletion } from '../../core/aiUtils.js';
import { state } from '../../core/state.js';

export function initBookNode() {
    registerNodeType('book_generator', {
        title: '📖 Book Generator',
        category: 'AI',
        style: { border: '2px solid var(--text-main)', minWidth: '480px' },
        setup: (node, id) => {
            const el = node.el;
            const body = el.querySelector('.node-body');
            const defaultTextarea = body.querySelector('.node-textarea');
            defaultTextarea.style.display = 'none';

            // ── Settings field helper ────────────────────────────────────────────
            const style = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:6px 8px;font-size:12px;font-family:'Inter',sans-serif;width:100%;box-sizing:border-box;outline:none;pointer-events:auto;touch-action:auto;user-select:text;-webkit-user-select:text;`;

            const mkSel = (opts, def) => {
                const s = document.createElement('select');
                s.style.cssText = style;
                opts.forEach(([v, l]) => {
                    const o = document.createElement('option');
                    o.value = v; o.textContent = l;
                    if (v === def) o.selected = true;
                    s.appendChild(o);
                });
                s.addEventListener('pointerdown', e => e.stopPropagation());
                return s;
            };
            const mkNum = (min, max, def, step = 1) => {
                const i = document.createElement('input');
                i.type = 'number'; i.min = min; i.max = max; i.value = def; i.step = step;
                i.style.cssText = style;
                i.addEventListener('pointerdown', e => e.stopPropagation());
                return i;
            };
            const mkCheck = (label, def = false) => {
                const wrap = document.createElement('label');
                wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text-main);pointer-events:auto;';
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = def;
                cb.style.cssText = 'pointer-events:auto;cursor:pointer;width:14px;height:14px;accent-color:var(--text-main);';
                cb.addEventListener('pointerdown', e => e.stopPropagation());
                wrap.appendChild(cb);
                wrap.appendChild(document.createTextNode(label));
                wrap._cb = cb;
                return wrap;
            };
            const mkTextarea = (ph, rows = 2) => {
                const t = document.createElement('textarea');
                t.placeholder = ph; t.rows = rows;
                t.style.cssText = style + 'resize:vertical;line-height:1.4;';
                t.addEventListener('pointerdown', e => e.stopPropagation());
                return t;
            };
            const section = (label) => {
                const d = document.createElement('div');
                d.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
                const l = document.createElement('label');
                l.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500;';
                l.textContent = label;
                d.appendChild(l);
                return d;
            };
            const row2 = (...els) => {
                const d = document.createElement('div');
                d.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
                els.forEach(e => d.appendChild(e));
                return d;
            };
            const divider = () => {
                const d = document.createElement('div');
                d.style.cssText = 'height:1px;background:var(--node-border);margin:2px 0;';
                return d;
            };

            // ── Build UI ─────────────────────────────────────────────────────────
            const ui = document.createElement('div');
            ui.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

            // 1. Genre
            const genreWrap = section('📚 Жанр'); const genre = mkSel([
                ['fantasy','Фэнтези'],['scifi','Научная фантастика'],['detective','Детектив'],
                ['thriller','Триллер'],['romance','Романтика'],['horror','Ужасы'],
                ['historical','Исторический'],['adventure','Приключения'],['drama','Драма'],
                ['literary','Литературная проза'],['mystery','Мистика'],['dystopia','Антиутопия']
            ], 'fantasy'); genreWrap.appendChild(genre); ui.appendChild(genreWrap);

            // 2. Writing style
            const styleWrap = section('✍️ Стиль написания'); const writingStyle = mkSel([
                ['classic','Классический'],['modern','Современный'],['poetic','Поэтический'],
                ['minimalist','Минималистичный'],['expressive','Экспрессивный'],
                ['journalistic','Журналистский'],['noir','Нуар'],['epic','Эпический']
            ], 'classic'); styleWrap.appendChild(writingStyle); ui.appendChild(styleWrap);

            // 3+4. Length
            ui.appendChild(divider());
            const lenLabel = document.createElement('div');
            lenLabel.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500;';
            lenLabel.textContent = '📏 Объём'; ui.appendChild(lenLabel);

            const wordsWrap = section('Слов (прибл.)'); const wordCount = mkNum(500, 500000, 5000, 500);
            wordsWrap.appendChild(wordCount);
            const pagesWrap = section('Страниц (прибл.)'); const pageCount = mkNum(1, 2000, 20);
            pagesWrap.appendChild(pageCount);
            ui.appendChild(row2(wordsWrap, pagesWrap));

            const chapWrap = section('Глав'); const chapterCount = mkNum(1, 200, 5);
            chapWrap.appendChild(chapterCount);
            const langWrap = section('🌐 Язык текста'); const outputLang = mkSel([
                ['russian','Русский'],['english','English'],['ukrainian','Українська'],
                ['german','Deutsch'],['french','Français'],['spanish','Español']
            ], 'russian'); langWrap.appendChild(outputLang);
            ui.appendChild(row2(chapWrap, langWrap));

            // 5+6. POV + Tone
            ui.appendChild(divider());
            const povWrap = section('👁 Точка зрения'); const pov = mkSel([
                ['first','От первого лица (Я)'],['third_limited','Третье лицо ограниченное'],
                ['third_omni','Третье лицо всеведущее'],['second','Второе лицо (Ты)']
            ], 'third_limited'); povWrap.appendChild(pov);

            const toneWrap = section('🎭 Тон'); const tone = mkSel([
                ['serious','Серьёзный'],['humorous','Юмористический'],['dark','Тёмный'],
                ['lyrical','Лирический'],['dramatic','Драматический'],['satirical','Сатирический'],
                ['melancholic','Меланхоличный'],['optimistic','Оптимистичный']
            ], 'serious'); toneWrap.appendChild(tone);
            ui.appendChild(row2(povWrap, toneWrap));

            // 7+8. Pacing + Audience
            const paceWrap = section('⚡ Темп'); const pacing = mkSel([
                ['slow','Медленный'],['medium','Умеренный'],['fast','Стремительный'],['varied','Переменный']
            ], 'medium'); paceWrap.appendChild(pacing);

            const audWrap = section('👥 Аудитория'); const audience = mkSel([
                ['children','Дети (6–12)'],['ya','Подростки (12–18)'],['adult','Взрослые (18+)'],['all','Все возрасты']
            ], 'adult'); audWrap.appendChild(audience);
            ui.appendChild(row2(paceWrap, audWrap));

            // 9+10. Era + Protagonist
            ui.appendChild(divider());
            const eraWrap = section('🕰 Эпоха / Сеттинг'); const era = mkSel([
                ['modern','Современность'],['past_century','XX век'],['medieval','Средневековье'],
                ['ancient','Античность'],['future','Будущее'],['fantasy_world','Фэнтезийный мир'],
                ['post_apocalyptic','Постапокалипсис'],['alternate','Альтернативная история']
            ], 'modern'); eraWrap.appendChild(era); ui.appendChild(eraWrap);

            const protWrap = section('🦸 Главный герой (описание)');
            const protagonist = mkTextarea('Например: молодой учёный с тёмным прошлым...', 2);
            protWrap.appendChild(protagonist); ui.appendChild(protWrap);

            // 11+12. Conflict + Ending
            const conflWrap = section('⚔️ Тип конфликта'); const conflict = mkSel([
                ['person_vs_person','Человек vs Человек'],['person_vs_nature','Человек vs Природа'],
                ['person_vs_society','Человек vs Общество'],['person_vs_self','Человек vs Себя'],
                ['person_vs_fate','Человек vs Судьба'],['person_vs_tech','Человек vs Технологии']
            ], 'person_vs_person'); conflWrap.appendChild(conflict);

            const endingWrap = section('🏁 Концовка'); const ending = mkSel([
                ['happy','Счастливая'],['tragic','Трагическая'],['open','Открытая'],
                ['unexpected','Неожиданная'],['bittersweet','Горько-сладкая'],['cyclical','Циклическая']
            ], 'open'); endingWrap.appendChild(ending);
            ui.appendChild(row2(conflWrap, endingWrap));

            // 13+14. Dialogue + Descriptions
            ui.appendChild(divider());
            const dialWrap = section('💬 Диалоги'); const dialogueLevel = mkSel([
                ['minimal','Минимальные'],['moderate','Умеренные'],['heavy','Интенсивные']
            ], 'moderate'); dialWrap.appendChild(dialogueLevel);

            const descWrap = section('🖼 Описания'); const descLevel = mkSel([
                ['brief','Краткие'],['detailed','Подробные'],['very_detailed','Очень детальные']
            ], 'detailed'); descWrap.appendChild(descLevel);
            ui.appendChild(row2(dialWrap, descWrap));

            // 15. Narrative structure
            const narrWrap = section('🔀 Нарративная структура'); const narrative = mkSel([
                ['linear','Линейная'],['nonlinear','Нелинейная'],['flashbacks','С флэшбэками'],
                ['frame','Обрамляющая (рассказ в рассказе)'],['parallel','Параллельная (несколько линий)']
            ], 'linear'); narrWrap.appendChild(narrative); ui.appendChild(narrWrap);

            // 16+17+18. Prologue, Epilogue, Creativity
            ui.appendChild(divider());
            const prologueCheck = mkCheck('📜 Добавить пролог');
            const epilogueCheck = mkCheck('📜 Добавить эпилог');
            const checksRow = document.createElement('div');
            checksRow.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;';
            checksRow.appendChild(prologueCheck); checksRow.appendChild(epilogueCheck);
            ui.appendChild(checksRow);

            const creativityWrap = section('🎲 Креативность (температура)'); const creativity = mkSel([
                ['low','🧊 Низкая — точно и предсказуемо'],
                ['medium','⚖️ Средняя — баланс'],
                ['high','🔥 Высокая — нестандартно и неожиданно']
            ], 'medium'); creativityWrap.appendChild(creativity); ui.appendChild(creativityWrap);

            // 19. Themes keywords
            const themesWrap = section('🏷 Темы / Ключевые слова');
            const themes = mkTextarea('Например: одиночество, предательство, надежда...', 2);
            themesWrap.appendChild(themes); ui.appendChild(themesWrap);

            // 20. Additional notes / style reference
            const extraWrap = section('📝 Доп. инструкции для автора');
            const extraInstructions = mkTextarea('Любые пожелания: ссылки на авторов, особенности стиля...', 3);
            extraWrap.appendChild(extraInstructions); ui.appendChild(extraWrap);

            // ── Output area ───────────────────────────────────────────────────────
            ui.appendChild(divider());
            const outputArea = document.createElement('textarea');
            outputArea.readOnly = true;
            outputArea.placeholder = 'Нажмите «Написать книгу» чтобы начать генерацию...';
            outputArea.style.cssText = style + `min-height:200px;resize:vertical;line-height:1.5;font-size:13px;`;
            outputArea.addEventListener('pointerdown', e => e.stopPropagation());
            ui.appendChild(outputArea);

            // Progress / status line
            const statusEl = document.createElement('div');
            statusEl.style.cssText = 'font-size:11px;color:var(--text-muted);min-height:16px;text-align:center;';
            ui.appendChild(statusEl);

            // ── Run button ─────────────────────────────────────────────────────────
            const runBtn = document.createElement('button');
            runBtn.textContent = '📖 Написать книгу';
            runBtn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:8px;padding:10px;width:100%;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;pointer-events:auto;transition:opacity 0.2s;`;
            runBtn.addEventListener('pointerdown', e => e.stopPropagation());
            runBtn.addEventListener('click', async () => {

                // Gather input notes from connected ancestors
                let inputNotes = '';
                const incomingEdges = state.edges.filter(e => e.toNode === id && e.toType === 'in');
                let visited = new Set();
                let chain = [];

                const traverse = (nodeId) => {
                    if (visited.has(nodeId)) return;
                    visited.add(nodeId);
                    const parentEdges = state.edges.filter(e => e.toNode === nodeId && e.toType === 'in');
                    parentEdges.forEach(pe => traverse(pe.fromNode));
                    const target = state.nodes[nodeId];
                    if (target) {
                        const title = target.el.querySelector('.node-title').value;
                        const text = target.el.querySelector('.node-textarea')?.value || target.el.querySelector('textarea:not([readonly])')?.value || '';
                        if (text.trim() || title !== 'Заметка') {
                            chain.push({ title, text });
                        }
                    }
                };
                incomingEdges.forEach(edge => traverse(edge.fromNode));
                chain.forEach(ch => { inputNotes += `[${ch.title}]:\n${ch.text}\n\n`; });

                const tempMap = { low: 0.3, medium: 0.8, high: 1.4 };
                const genreMap = {fantasy:'фэнтези',scifi:'научной фантастике',detective:'детективе',thriller:'триллере',romance:'романтике',horror:'ужасах',historical:'историческом романе',adventure:'приключенческом романе',drama:'драме',literary:'литературной прозе',mystery:'мистике',dystopia:'антиутопии'};
                const styleMap = {classic:'классическом литературном',modern:'современном разговорном',poetic:'поэтическом, образном',minimalist:'минималистичном, лаконичном',expressive:'экспрессивном, ярком',journalistic:'журналистском, репортажном',noir:'нуар, мрачном',epic:'эпическом, масштабном'};
                const povMap = {first:'от первого лица (я)',third_limited:'от третьего лица ограниченного',third_omni:'от третьего лица всеведущего',second:'от второго лица (ты)'};
                const toneMap = {serious:'серьёзный',humorous:'юмористический',dark:'тёмный',lyrical:'лирический',dramatic:'драматический',satirical:'сатирический',melancholic:'меланхоличный',optimistic:'оптимистичный'};
                const endingMap = {happy:'счастливой концовкой',tragic:'трагической концовкой',open:'открытым концом',unexpected:'неожиданной концовкой',bittersweet:'горько-сладкой концовкой',cyclical:'циклической концовкой'};
                const langMap = {russian:'русском',english:'английском',ukrainian:'украинском',german:'немецком',french:'французском',spanish:'испанском'};

                const systemPrompt = `Ты профессиональный писатель. Напиши произведение строго на ${langMap[outputLang.value]} языке, в жанре ${genreMap[genre.value]}, ${styleMap[writingStyle.value]} стиле. Тон: ${toneMap[tone.value]}. Повествование ${povMap[pov.value]}. Структура: ${narrative.value === 'linear' ? 'линейная' : narrative.value === 'nonlinear' ? 'нелинейная' : narrative.value === 'flashbacks' ? 'с флэшбэками' : narrative.value === 'frame' ? 'обрамляющая' : 'параллельные сюжетные линии'}. Объём: примерно ${wordCount.value} слов, ${pageCount.value} страниц, ${chapterCount.value} глав. Диалоги: ${dialogueLevel.value === 'minimal' ? 'минимальные' : dialogueLevel.value === 'moderate' ? 'умеренные' : 'интенсивные'}. Описания: ${descLevel.value === 'brief' ? 'краткие' : descLevel.value === 'detailed' ? 'подробные' : 'очень детальные'}. Концовка: ${endingMap[ending.value]}.${prologueCheck._cb.checked ? ' Начни с пролога.' : ''}${epilogueCheck._cb.checked ? ' Закончи эпилогом.' : ''} Аудитория: ${audience.value === 'children' ? 'дети 6–12 лет' : audience.value === 'ya' ? 'подростки 12–18 лет' : audience.value === 'adult' ? 'взрослые' : 'все возрасты'}. Тип конфликта: ${conflict.value.replace(/_/g, ' vs ')}. Сеттинг: ${era.value}.${themes.value.trim() ? ` Ключевые темы: ${themes.value.trim()}.` : ''}${protagonist.value.trim() ? ` Главный герой: ${protagonist.value.trim()}.` : ''}${extraInstructions.value.trim() ? ` Дополнительные инструкции: ${extraInstructions.value.trim()}` : ''}`;

                const userPrompt = inputNotes
                    ? `На основе следующих заметок напиши книгу:\n\n${inputNotes}`
                    : 'Придумай интересный оригинальный сюжет и напиши книгу согласно всем заданным параметрам.';

                runBtn.disabled = true;
                outputArea.value = '';
                statusEl.textContent = '⏳ Генерация... (может занять несколько минут для больших текстов)';

                try {
                    const temperature = tempMap[creativity.value] ?? 0.8;

                    await streamCompletion(
                        {
                            temperature,
                            max_tokens: 8192,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userPrompt }
                            ]
                        },
                        (chunk) => {
                            outputArea.value += chunk;
                            outputArea.scrollTop = outputArea.scrollHeight;
                            const words = outputArea.value.split(/\s+/).filter(Boolean).length;
                            statusEl.textContent = `⏳ Генерация... ${words} слов`;
                        }
                    );
                    const finalWords = outputArea.value.split(/\s+/).filter(Boolean).length;
                    statusEl.textContent = `✅ Готово! ${finalWords} слов`;
                    defaultTextarea.value = outputArea.value;

                } catch (err) {
                    outputArea.value = '';
                    statusEl.textContent = `❌ ${err.message}`;
                } finally {
                    runBtn.disabled = false;
                }
            });
            ui.appendChild(runBtn);

            body.appendChild(ui);
        }
    });
}
