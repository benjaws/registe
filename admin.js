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
        durees: form.durees.value.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x))
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
function editCategory(id, name, type, description, durees) {
    editingCategoryId = id;
    const form = document.getElementById('catForm');
    form.name.value = name;
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

// Activer/désactiver une catégorie
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
            
            const toggleBtn = cat.active ? 
                `<button class="btn btn-sm btn-warning" onclick="toggleCategory('${cat.id}')">Désactiver</button>` :
                `<button class="btn btn-sm btn-success" onclick="toggleCategory('${cat.id}')">Activer</button>`;
                
            html += `
                <tr>
                    <td><strong>${cat.name}</strong></td>
                    <td>${cat.type}</td>
                    <td>${cat.description}</td>
                    <td>${cat.durees.join(', ')} sec</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" 
                                onclick="editCategory('${cat.id}', '${cat.name}', '${cat.type}', '${cat.description}', [${cat.durees}])">
                            Éditer
                        </button>
                        ${toggleBtn}
                        <button class="btn btn-sm btn-danger ms-1" onclick="deleteCategory('${cat.id}')">
                            Supprimer
                        </button>
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

// Activer/désactiver une musique
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
    // Désérialisation si les arguments sont passés via JSON.stringify
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
                `<button class="btn btn-sm btn-warning" onclick="toggleMusic('${m.id}')">Désactiver</button>` :
                `<button class="btn btn-sm btn-success" onclick="toggleMusic('${m.id}')">Activer</button>`;
            // Utiliser JSON.stringify pour tous les arguments string pour éviter toute injection ou erreur JS
            const safeId = JSON.stringify(m.id ?? '');
            const safeTitle = JSON.stringify(m.title ?? '');
            const safeTransition = m.transition ? 1 : 0;
            const safeTypes = JSON.stringify(Array.isArray(m.types) ? m.types : []);
            // Toujours fournir 4 arguments à editMusic, même si certains sont vides
            html += `
                <tr>
                    <td>${m.title || m.filename}</td>
                    <td>${m.filename || ''}</td>
                    <td>${m.transition ? '<span class=\"badge bg-success\">transition</span>' : ''}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="editMusic(${safeId}, ${safeTitle}, ${safeTransition}, ${safeTypes})">Éditer</button>
                        ${toggleBtn}
                        <button class="btn btn-sm btn-danger ms-1" onclick="deleteMusic('${m.id}')">Supprimer</button>
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
