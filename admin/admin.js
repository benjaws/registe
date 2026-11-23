let editingCategoryId = null;

// Gestion du formulaire catégorie
// Gestion du formulaire catégorie
document.getElementById('catForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        name: form.name.value,
        description: form.description.value,
        type: form.type.value,
        durees: form.durees.value.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x)),
        theme_generated: form.theme_generated.checked
    };
    let url = '../save_category.php';
    if (editingCategoryId) {
        // Mode édition
        url = '../manage_category.php';
        data.action = 'update';
        data.id = editingCategoryId;
    }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const txt = await res.text();
        let json = null;
        try { json = JSON.parse(txt); } catch(e) {}
        if(res.ok) {
            form.reset();
            cancelEdit();
            loadCategories();
        } else {
            alert('Erreur lors de l\'ajout de la catégorie : ' + (json?.error || txt));
            console.error('Erreur ajout catégorie:', txt);
        }
    } catch (e) {
        alert('Erreur réseau ou serveur lors de l\'ajout de la catégorie.');
        console.error(e);
    }
});

// Gestion du formulaire d'ajout de musique
// Gestion du formulaire d'ajout de musique
document.getElementById('musicForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const res = await fetch('../save_music_simple.php', {
        method: 'POST',
        body: formData
    });
    if(res.ok) {
        form.reset();
        loadMusics();
    } else {
        alert('Erreur lors de l\'enregistrement de la musique.');
    }
});

// Gestion du formulaire d'édition de musique
document.getElementById('musicEditForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    if (!editingMusicId) return;
    const data = {
        action: 'update',
        id: editingMusicId,
        title: form.querySelector('input[name="title"]').value,
        transition: form.querySelector('input[name="transition"]').checked,
        types: Array.from(form.querySelectorAll('input[name="types[]"]:checked')).map(cb => cb.value)
    };
    const res = await fetch('../manage_music.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    if(res.ok) {
        form.reset();
        cancelEditMusic();
        loadMusics();
    } else {
        alert('Erreur lors de la modification de la musique.');
    }
});



// Annuler l'édition
document.getElementById('catCancelBtn').addEventListener('click', cancelEdit);

function cancelEdit() {
    editingCategoryId = null;
    document.getElementById('catSubmitBtn').textContent = 'Ajouter catégorie';
    document.getElementById('catCancelBtn').style.display = 'none';
    document.getElementById('catForm').reset();
}

// Éditer une catégorie
function editCategory(id, name, type, description, durees, themeGenerated) {
    editingCategoryId = id;
    const form = document.getElementById('catForm');
    form.name.value = name;
    if (form.theme_generated) form.theme_generated.checked = (themeGenerated === undefined ? true : !!themeGenerated);
    // Ajout dynamique du type si inconnu
    let typeSelect = form.type;
    let found = false;
    for (let i = 0; i < typeSelect.options.length; i++) {
        if (typeSelect.options[i].value === type) {
            found = true;
            break;
        }
    }
    if (!found && type) {
        let opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type + ' (inconnu)';
        typeSelect.appendChild(opt);
    }
    form.type.value = type;
    form.description.value = description;
    form.durees.value = Array.isArray(durees) ? durees.join(', ') : durees;
    document.getElementById('catSubmitBtn').textContent = 'Modifier catégorie';
    document.getElementById('catCancelBtn').style.display = 'inline-block';
}

// Supprimer une catégorie
async function deleteCategory(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
        const res = await fetch('../manage_category.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', id: id})
        });
        if(res.ok) {
            loadCategories();
        }
    }
}

// Archiver/désarchiver une catégorie
async function toggleCategory(id) {
    const res = await fetch('../manage_category.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'toggle_active', id: id})
    });
    if(res.ok) {
        loadCategories();
    }
}




async function loadCategories() {
    const res = await fetch('../data/categories.json.php');
    if(res.ok) {
        const cats = await res.json();
        let html = '';
        for(const cat of cats) {
            const statusBadge = cat.active ?
                '<span class="badge bg-success">Active</span>' :
                '<span class="badge bg-secondary">Inactive</span>';
            const themeBadge = (cat.theme_generated === false)
                ? ' <span class="badge bg-info text-dark">Sans thème</span>'
                : '';

            const toggleBtn = cat.active ?
                `<button class="btn btn-sm btn-warning" onclick="toggleCategory('${cat.id}')" title="Archiver"><i class="bi bi-archive"></i></button>` :
                `<button class="btn btn-sm btn-success" onclick="toggleCategory('${cat.id}')" title="Désarchiver"><i class="bi bi-archive"></i></button>`;
                
            html += `
                <tr>
                    <td><strong>${cat.name}</strong></td>
                    <td>${cat.type}</td>
                    <td>${cat.description}</td>
                    <td>${cat.durees.join(', ')} sec</td>
                    <td>${statusBadge}${themeBadge}</td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary" onclick="editCategory('${cat.id}', '${cat.name}', '${cat.type}', '${cat.description}', [${cat.durees}], ${cat.theme_generated ? 1 : 0})" title="Éditer"><i class="bi bi-pencil"></i></button>
                            ${toggleBtn}
                            <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')" title="Supprimer"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }
        document.getElementById('catList').innerHTML = html;
    }
}


// Supprimer une musique
async function deleteMusic(id) {
    if (confirm('Supprimer cette musique ?')) {
        const res = await fetch('../manage_music.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', id: id})
        });
        if(res.ok) loadMusics();
    }
}

// Archiver/désarchiver une musique
async function toggleMusic(id) {
    const res = await fetch('../manage_music.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'toggle_active', id: id})
    });
    if(res.ok) loadMusics();
}



let editingMusicId = null;

function editMusic(id, title, transition, types) {
    // Désérialisation des arguments passés via JSON.stringify
    try { id = JSON.parse(id); } catch(e) {}
    try { title = JSON.parse(title); } catch(e) {}
    try { types = JSON.parse(types); } catch(e) {}
    
    editingMusicId = id;
    // Masquer le formulaire d'ajout, afficher le formulaire d'édition
    document.getElementById('musicForm').style.display = 'none';
    const editForm = document.getElementById('musicEditForm');
    editForm.style.display = '';
    // Remplir les champs
    editForm.querySelector('input[name="title"]').value = title || '';
    // transition peut être 1, 0, true, false, ou string '1'/'0'
    editForm.querySelector('input[name="transition"]').checked = (transition === true || transition === 1 || transition === '1');
    // types doit être un tableau
    let typesArr = Array.isArray(types) ? types : [];
    editForm.querySelectorAll('input[name="types[]"]').forEach(cb => {
        cb.checked = typesArr.includes(cb.value);
    });
}

function cancelEditMusic() {
    editingMusicId = null;
    // Masquer le formulaire d'édition, afficher le formulaire d'ajout
    document.getElementById('musicEditForm').reset();
    document.getElementById('musicEditForm').style.display = 'none';
    document.getElementById('musicForm').style.display = '';
}

// Bouton Annuler sur le formulaire d'édition musique
document.getElementById('musicEditCancelBtn').addEventListener('click', cancelEditMusic);
async function loadMusics() {
    const res = await fetch('../data/musics.json.php');
    if(res.ok) {
        const musics = await res.json();
        let html = '';
        for(const m of musics) {
            const statusBadge = m.active !== false ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>';
            const toggleBtn = m.active !== false ?
                `<button class="btn btn-sm btn-warning" onclick="toggleMusic('${m.id}')" title="Archiver"><i class="bi bi-archive"></i></button>` :
                `<button class="btn btn-sm btn-success" onclick="toggleMusic('${m.id}')" title="Désarchiver"><i class="bi bi-archive"></i></button>`;
            // Utiliser JSON.stringify pour éviter les injections puis échapper les apostrophes pour l'attribut HTML
            const safeId = JSON.stringify(m.id ?? '').replace(/'/g, "&apos;");
            const safeTitle = JSON.stringify(m.title ?? '').replace(/'/g, "&apos;");
            const safeTransition = m.transition ? 1 : 0;
            const safeTypes = JSON.stringify(Array.isArray(m.types) ? m.types : []).replace(/'/g, "&apos;");
            html += `
                <tr>
                    <td>${m.title || m.filename}</td>
                    <td>${m.filename || ''}</td>
                    <td>${m.transition ? '<span class=\"badge bg-success\">transition</span>' : ''}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary" onclick='editMusic(${safeId}, ${safeTitle}, ${safeTransition}, ${safeTypes})' title="Éditer"><i class="bi bi-pencil"></i></button>
                            ${toggleBtn}
                            <button class="btn btn-sm btn-danger" onclick='deleteMusic(${safeId})' title="Supprimer"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }

        document.getElementById('musicList').innerHTML = `<div class='table-responsive'><table class='table table-striped'><thead><tr><th>Titre</th><th>Fichier</th><th>Transition</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${html}</tbody></table></div>`;
    }
}

// Initialisation
loadCategories();
loadMusics();


// ==== Gestion des projecteurs (fixtures) ====
const FIXTURE_TYPE_LABELS = {
    RGB: 'RGB', RGBW: 'RGBW', RGB_DIM: 'RGB + Dimmer', DIM_RGB: 'Dimmer + RGB',
    RGBW_DIM: 'RGBW + Dimmer', DIM_RGBW: 'Dimmer + RGBW'
};
const FIXTURE_TYPE_SIZE = { RGB: 3, RGBW: 4, RGB_DIM: 4, DIM_RGB: 4, RGBW_DIM: 5, DIM_RGBW: 5 };
let fixturesCache = [];
let editingFixtureId = null;

const fixtureForm = document.getElementById('fixtureForm');
if (fixtureForm) {
    fixtureForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            action: editingFixtureId ? 'update' : 'add',
            name: form.name.value.trim(),
            address: parseInt(form.address.value, 10),
            type: form.type.value
        };
        if (editingFixtureId) data.id = editingFixtureId;
        const res = await fetch('../manage_fixture.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (res.ok) { form.reset(); cancelFixtureEdit(); loadFixtures(); }
        else {
            const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
            alert('Erreur projecteur : ' + (j?.error || t));
        }
    });
    document.getElementById('fixtureCancelBtn').addEventListener('click', cancelFixtureEdit);
}

function cancelFixtureEdit() {
    editingFixtureId = null;
    document.getElementById('fixtureSubmitBtn').textContent = 'Ajouter';
    document.getElementById('fixtureCancelBtn').style.display = 'none';
    document.getElementById('fixtureForm').reset();
}

function editFixture(id) {
    const fx = fixturesCache.find(f => f.id === id);
    if (!fx) return;
    editingFixtureId = id;
    const form = document.getElementById('fixtureForm');
    form.name.value = fx.name;
    form.address.value = fx.address;
    form.type.value = fx.type;
    document.getElementById('fixtureSubmitBtn').textContent = 'Modifier';
    document.getElementById('fixtureCancelBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteFixture(id) {
    if (!confirm('Supprimer ce projecteur ?')) return;
    const res = await fetch('../manage_fixture.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id })
    });
    if (res.ok) loadFixtures();
}

async function loadFixtures() {
    const list = document.getElementById('fixtureList');
    if (!list) return;
    const res = await fetch('../data/fixtures.json.php?' + Date.now());
    if (!res.ok) return;
    fixturesCache = await res.json();
    let html = '';
    for (const fx of fixturesCache) {
        const size = FIXTURE_TYPE_SIZE[fx.type] || 4;
        const label = FIXTURE_TYPE_LABELS[fx.type] || fx.type;
        html += `<tr>
            <td><strong>${fx.name}</strong></td>
            <td>${fx.address}</td>
            <td>${label}</td>
            <td>${fx.address}–${fx.address + size - 1}</td>
            <td><div class="btn-group" role="group">
                <button class="btn btn-sm btn-primary" onclick="editFixture('${fx.id}')" title="Éditer"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteFixture('${fx.id}')" title="Supprimer"><i class="bi bi-trash"></i></button>
            </div></td></tr>`;
    }
    list.innerHTML = html || '<tr><td colspan="5" class="text-muted">Aucun projecteur. Ajoutes-en un ci-dessus.</td></tr>';
}
loadFixtures();
