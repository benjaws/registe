// Éditeur des séquences personnalisées (admin → onglet Séquences)

(function () {
    const S = window.Sequences;
    if (!S || !document.getElementById('seqEditor')) return;
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let list = [], fixtures = [], musics = [];
    let draft = null;   // { id, name, trigger, loop, steps: [] }

    const DEFAULTS = {
        light:      () => ({ type: 'light', target: 'all', color: 'chaud', fade: 0, parallel: false }),
        intensity:  () => ({ type: 'intensity', level: 100, fade: 2, parallel: false }),
        blackout:   () => ({ type: 'blackout' }),
        lights_on:  () => ({ type: 'lights_on' }),
        music:      () => ({ type: 'music', file: (musics[0] || {}).filename || '', start: 0, volume: 100 }),
        music_stop: () => ({ type: 'music_stop', fade: 1.5 }),
        spotify:    () => ({ type: 'spotify', action: 'play', link: '' }),
        chrono:     () => ({ type: 'chrono', action: 'start' }),
        wait:       () => ({ type: 'wait', seconds: 2 }),
        go:         () => ({ type: 'go' }),
    };

    async function api(body) {
        const res = await fetch('../manage_sequence.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!res.ok) throw new Error((j && j.error) || t || res.status);
        return j;
    }

    async function loadRefs() {
        try { const r = await fetch('../data/fixtures.json.php?' + Date.now()); if (r.ok) fixtures = (await r.json()).map(f => ({ id: f.id, name: f.name })); } catch (e) {}
        try { const r = await fetch('../data/musics.json.php?' + Date.now()); if (r.ok) musics = (await r.json()).filter(m => m.active !== false && m.filename); } catch (e) {}
    }

    // ---------- Liste ----------
    async function refreshList() {
        list = await S.load();
        const tb = $('seqAdminList');
        if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="text-muted">Aucune séquence. Crée la première avec « + Nouvelle séquence ».</td></tr>'; return; }
        tb.innerHTML = list.map((s, i) => `<tr>
            <td><div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter"><i class="bi bi-arrow-up"></i></button>
                <button class="btn btn-outline-secondary" data-act="down" data-i="${i}" ${i === list.length - 1 ? 'disabled' : ''} title="Descendre"><i class="bi bi-arrow-down"></i></button>
            </div></td>
            <td><strong>${esc(s.name)}</strong>${i < 9 ? ` <kbd class="ms-1">${i + 1}</kbd>` : ''}${s.loop ? ' 🔁' : ''}</td>
            <td>${esc(S.TRIGGERS[s.trigger] || 'Manuel')}</td>
            <td title="${esc(s.steps.map(st => S.describe(st, fixtures)).join(' → '))}">${s.steps.length}</td>
            <td><div class="btn-group btn-group-sm">
                <button class="btn btn-primary" data-act="edit" data-i="${i}" title="Éditer"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-outline-secondary" data-act="dup" data-i="${i}" title="Dupliquer"><i class="bi bi-copy"></i></button>
                <button class="btn btn-danger" data-act="del" data-i="${i}" title="Supprimer"><i class="bi bi-trash"></i></button>
            </div></td></tr>`).join('');
    }

    $('seqAdminList').addEventListener('click', async e => {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        const i = +b.dataset.i, s = list[i];
        try {
            if (b.dataset.act === 'edit') openEditor(s);
            else if (b.dataset.act === 'dup') openEditor({ ...s, id: null, name: s.name + ' (copie)', trigger: '' });
            else if (b.dataset.act === 'del') {
                if (!confirm(`Supprimer la séquence « ${s.name} » ?`)) return;
                await api({ action: 'delete', id: s.id }); refreshList();
            } else {
                const ids = list.map(x => x.id);
                const j = b.dataset.act === 'up' ? i - 1 : i + 1;
                [ids[i], ids[j]] = [ids[j], ids[i]];
                await api({ action: 'reorder', ids }); refreshList();
            }
        } catch (err) { alert('Erreur : ' + err.message); }
    });

    // ---------- Éditeur ----------
    function openEditor(seq) {
        draft = seq ? JSON.parse(JSON.stringify(seq)) : { id: null, name: '', trigger: '', loop: false, steps: [] };
        $('seqName').value = draft.name;
        $('seqTrigger').value = draft.trigger || '';
        $('seqLoop').checked = !!draft.loop;
        $('seqListView').style.display = 'none';
        $('seqEditor').style.display = '';
        renderSteps();
        $('seqName').focus();
    }
    function closeEditor() {
        draft = null;
        $('seqEditor').style.display = 'none';
        $('seqListView').style.display = '';
    }

    const num = (key, label, step, val, min = 0, max = 3600, unit = 's') =>
        `<label>${label}<span class="input-group input-group-sm" style="width:120px;">
            <input type="number" class="form-control" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${esc(val)}">
            <span class="input-group-text">${unit}</span></span></label>`;
    const check = (key, label, val) =>
        `<label class="form-check-label"><input type="checkbox" class="form-check-input" data-k="${key}" ${val ? 'checked' : ''}> ${label}</label>`;
    const select = (key, label, options, val, width = 200) =>
        `<label>${label}<select class="form-select form-select-sm" data-k="${key}" style="width:${width}px;">${
            options.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

    function fieldsFor(st) {
        switch (st.type) {
            case 'light': {
                const isHex = !S.PRESETS[st.color];
                const sw = Object.keys(S.PRESETS).map(k =>
                    `<button type="button" class="seq-swatch${st.color === k ? ' active' : ''}" data-color="${k}" title="${S.PRESETS[k]}" style="background:${S.PRESET_CSS[k]};"></button>`).join('');
                return select('target', 'Projecteur', [['all', 'Tous']].concat(fixtures.map(f => [f.id, f.name])), st.target, 160)
                    + `<label>Couleur<span class="seq-swatches">${sw}<input type="color" data-color-custom value="${isHex ? esc(st.color) : '#ff8800'}" title="Couleur personnalisée"${isHex ? ' class="active"' : ''}></span></label>`
                    + num('fade', 'Fondu', 0.1, st.fade, 0, 600) + check('parallel', 'En parallèle', st.parallel);
            }
            case 'intensity':
                return num('level', 'Intensité', 1, st.level, 0, 100, '%') + num('fade', 'Fondu', 0.1, st.fade, 0, 600) + check('parallel', 'En parallèle', st.parallel);
            case 'wait':
                return num('seconds', 'Durée', 0.1, st.seconds, 0, 3600);
            case 'music': {
                const opts = musics.map(m => [m.filename, m.title || m.filename]);
                if (st.file && !opts.some(o => o[0] === st.file)) opts.unshift([st.file, st.file + ' (introuvable)']);
                if (!opts.length) opts.push(['', 'Aucun mp3 (onglet Musiques)']);
                return select('file', 'Fichier', opts, st.file, 240) + num('start', 'Départ à', 1, st.start, 0, 36000) + num('volume', 'Volume', 5, st.volume, 0, 100, '%');
            }
            case 'music_stop':
                return num('fade', 'Fondu', 0.1, st.fade, 0, 60);
            case 'spotify':
                return select('action', 'Action', [['play', 'Lecture'], ['pause', 'Pause'], ['next', 'Titre suivant'], ['link', 'Jouer un lien…']], st.action, 160)
                    + (st.action === 'link' ? `<label style="flex:1;min-width:220px;">Lien Spotify (titre, playlist ou album)
                        <input type="url" class="form-control form-control-sm" data-k="link" value="${esc(st.link)}" placeholder="https://open.spotify.com/track/…"></label>` : '');
            case 'chrono':
                return select('action', 'Action', [['start', 'Jouer (lance le chrono)'], ['stop', 'Stopper (fin d\'impro)']], st.action, 220);
            case 'go':
                return '<span class="text-muted" style="font-size:.85rem;">La séquence attend que tu appuies sur GO (touche <kbd>G</kbd>).</span>';
        }
        return '';
    }

    function renderSteps() {
        const ol = $('seqSteps');
        if (!draft.steps.length) { ol.innerHTML = '<li class="text-muted" style="font-size:.9rem;">Aucune étape. Ajoute-en avec le menu ci-dessous.</li>'; return; }
        const n = draft.steps.length;
        ol.innerHTML = draft.steps.map((st, i) => `<li class="seq-step" data-i="${i}">
            <span class="seq-step-num">${i + 1}</span>
            <div class="seq-step-body">
                <div class="seq-step-title">${esc((S.STEP_TYPES[st.type] || {}).label || st.type)}</div>
                <div class="seq-step-fields">${fieldsFor(st)}</div>
            </div>
            <div class="seq-step-actions">
                <button type="button" class="btn btn-sm btn-outline-secondary" data-act="up" ${i === 0 ? 'disabled' : ''} title="Monter"><i class="bi bi-arrow-up"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-act="down" ${i === n - 1 ? 'disabled' : ''} title="Descendre"><i class="bi bi-arrow-down"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-act="dup" title="Dupliquer"><i class="bi bi-copy"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-act="del" title="Supprimer"><i class="bi bi-x-lg"></i></button>
            </div></li>`).join('');
    }

    // Valeurs saisies → brouillon
    $('seqSteps').addEventListener('input', e => {
        const li = e.target.closest('.seq-step'); if (!li) return;
        const st = draft.steps[+li.dataset.i];
        if (e.target.hasAttribute('data-color-custom')) {
            st.color = e.target.value.toLowerCase();
            li.querySelectorAll('.seq-swatch').forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            return;
        }
        const k = e.target.dataset.k; if (!k) return;
        st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
        if (k === 'action' && st.type === 'spotify') renderSteps();   // affiche / masque le champ lien
    });

    $('seqSteps').addEventListener('click', e => {
        const li = e.target.closest('.seq-step'); if (!li) return;
        const i = +li.dataset.i;
        const sw = e.target.closest('.seq-swatch');
        if (sw) { draft.steps[i].color = sw.dataset.color; renderSteps(); return; }
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const steps = draft.steps;
        if (b.dataset.act === 'del') steps.splice(i, 1);
        else if (b.dataset.act === 'dup') steps.splice(i + 1, 0, JSON.parse(JSON.stringify(steps[i])));
        else { const j = b.dataset.act === 'up' ? i - 1 : i + 1; [steps[i], steps[j]] = [steps[j], steps[i]]; }
        renderSteps();
    });

    // Menu « Ajouter une étape », groupé par famille
    const add = $('seqAddStep');
    const groups = {};
    Object.entries(S.STEP_TYPES).forEach(([k, v]) => { (groups[v.group] = groups[v.group] || []).push([k, v.label]); });
    add.innerHTML += Object.entries(groups).map(([g, items]) =>
        `<optgroup label="${esc(g)}">${items.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</optgroup>`).join('');
    add.addEventListener('change', () => {
        if (!add.value || !draft) return;
        draft.steps.push(DEFAULTS[add.value]());
        add.value = '';
        renderSteps();
        const last = $('seqSteps').lastElementChild;
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    $('seqEditor').addEventListener('submit', async e => {
        e.preventDefault();
        draft.name = $('seqName').value.trim();
        draft.trigger = $('seqTrigger').value;
        draft.loop = $('seqLoop').checked;
        if (draft.trigger) {
            const other = list.find(s => s.trigger === draft.trigger && s.id !== draft.id);
            if (other && !confirm(`« ${other.name} » est déjà déclenchée ${S.TRIGGERS[draft.trigger].toLowerCase()}. La remplacer par celle-ci ?`)) return;
        }
        try {
            await api({ action: 'save', id: draft.id, name: draft.name, trigger: draft.trigger, loop: draft.loop, steps: draft.steps });
            closeEditor();
            refreshList();
        } catch (err) { alert('Erreur : ' + err.message); }
    });
    $('seqCancelBtn').addEventListener('click', closeEditor);
    $('seqNewBtn').addEventListener('click', () => openEditor(null));

    // Lien direct admin/#sequences (bouton « Modifier » de la régie)
    function openTabFromHash() {
        if (location.hash === '#sequences' && window.bootstrap) bootstrap.Tab.getOrCreateInstance($('sequence-tab')).show();
    }
    window.addEventListener('hashchange', openTabFromHash);

    loadRefs().then(refreshList);
    openTabFromHash();
})();
