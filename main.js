// Charge les catégories dans le select (seulement les actives)
async function loadCategories() {
    const res = await fetch('data/categories.json.php?' + Date.now());
    if(res.ok) {
        const cats = await res.json();
        // Conserve l'index original pour retrouver la catégorie lors de la sélection
        const activeCats = cats
            .map((cat, idx) => ({ ...cat, idx }))
            .filter(cat => cat.active !== false); // Par défaut active si pas de propriété
        const select = document.getElementById('catSelect');
        select.innerHTML = '';
        // Regroupe les catégories par type
        const groups = activeCats.reduce((acc, cat) => {
            const type = cat.type || 'Autres';
            if (!acc[type]) acc[type] = [];
            acc[type].push(cat);
            return acc;
        }, {});
        Object.keys(groups).sort().forEach(type => {
            const og = document.createElement('optgroup');
            og.label = type;
            groups[type].forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.idx; // Garder l'index original
                opt.textContent = cat.name;
                og.appendChild(opt);
            });
            select.appendChild(og);
        });
    }
}

let selectedCat = null;
let selectedDuree = null;
let selectedTheme = null;
let chronoInterval = null;
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
const audioTransition = document.getElementById('audioTransition');
const stopMusicBtn = document.getElementById('stopMusicBtn');
const transitionContainer = document.getElementById('transitionContainer');
audioTransition.addEventListener('ended', () => {
    transitionContainer.style.display = 'none';
    audioTransition.style.display = 'none';
    audioTransition.volume = 1;
});

stopMusicBtn.addEventListener('click', () => {
    let vol = audioTransition.volume;
    const fade = setInterval(() => {
        if (vol > 0.05) {
            vol -= 0.05;
            audioTransition.volume = vol;
        } else {
            clearInterval(fade);
            audioTransition.pause();
            audioTransition.currentTime = 0;
            audioTransition.volume = 1;
            audioTransition.style.display = 'none';
            transitionContainer.style.display = 'none';
        }
    }, 100);
});

// Sélection catégorie et tirage durée + thème

document.getElementById('selectCatForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const idx = document.getElementById('catSelect').value;
    const res = await fetch('data/categories.json.php?' + Date.now());
    if(res.ok) {
        const cats = await res.json();
        selectedCat = cats[idx];
        // Tirage durée
        selectedDuree = selectedCat.durees[Math.floor(Math.random()*selectedCat.durees.length)];
        document.getElementById('duree').textContent = formatTime(selectedDuree);
        // Thème généré uniquement si la catégorie l'autorise
        if (selectedCat.theme_generated === false) {
            selectedTheme = '';
            document.getElementById('theme').textContent = '—';
        } else {
            // Appel API pour le thème
            const themeHistory = getThemeHistory();
            const themeRes = await fetch('get_theme.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    categorie: selectedCat.name,
                    type: selectedCat.type,
                    description: selectedCat.description,
                    themeHistory: themeHistory
                })
            });
            if(themeRes.ok) {
                const data = await themeRes.json();
                selectedTheme = data.theme;
                document.getElementById('theme').textContent = selectedTheme;
                // --- Historique des thèmes ---
                addThemeToHistory({
                    theme: selectedTheme,
                    date: new Date().toLocaleString()
                });
                renderThemeHistory();
            } else {
                document.getElementById('theme').textContent = 'Erreur API';
            }
        }
        document.getElementById('result').style.display = '';
        document.getElementById('chrono').textContent = '';

        // --- Historique des catégories ---
        addCatToHistory({
            name: selectedCat.name,
            type: selectedCat.type,
            date: new Date().toLocaleString()
        });
        renderCatHistory();
// --- Historique des thèmes (localStorage) ---
function getThemeHistory() {
    try {
        return JSON.parse(localStorage.getItem('themeHistory') || '[]');
    } catch(e) {
        return [];
    }
}

function setThemeHistory(arr) {
    localStorage.setItem('themeHistory', JSON.stringify(arr));
}

function addThemeToHistory(themeObj) {
    let arr = getThemeHistory();
    arr.unshift(themeObj); // Ajoute en haut
    if(arr.length > 10) arr = arr.slice(0, 10); // Max 10 entrées
    setThemeHistory(arr);
}

function renderThemeHistory() {
    const list = document.getElementById('themeHistoryList');
    if(!list) return;
    const arr = getThemeHistory();
    list.innerHTML = '';
    if(arr.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item text-muted';
        li.textContent = 'Aucun thème généré.';
        list.appendChild(li);
        return;
    }
    arr.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${item.theme}  —  ${item.date}`;
        list.appendChild(li);
    });
}
    }
});

// Synchro du chrono avec la page tablette (chrono.php)
function syncChrono(payload) {
    try {
        fetch('chrono_state.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
            keepalive: true
        });
    } catch(e) { /* synchro best-effort */ }
}

// Chrono
document.getElementById('playBtn').addEventListener('click', function() {
    // Filtre les musiques selon le type de la catégorie sélectionnée
    loadMusicsPublic(selectedCat ? selectedCat.type : null);
    let t = selectedDuree;
    const chrono = document.getElementById('chrono');
    chrono.textContent = formatTime(t);
    // Informe la tablette : démarrage du chrono
    syncChrono({ action: 'start', duree: selectedDuree, theme: selectedTheme || '' });
    if(chronoInterval) clearInterval(chronoInterval);
    chronoInterval = setInterval(() => {
        t--;
        chrono.textContent = formatTime(t);
        if(t <= 0) {
            clearInterval(chronoInterval);
            chrono.textContent = 'FIN !';
        }
    }, 1000);
});

// Bouton Stopper : reset, stop chrono, joue musique de transition
document.getElementById('stopBtn').addEventListener('click', async function() {
    // Stop chrono
    if(chronoInterval) clearInterval(chronoInterval);
    document.getElementById('chrono').textContent = '';
    // Informe la tablette : arrêt du chrono
    syncChrono({ action: 'stop' });
    // Fin d'impro : noir 3 s puis rallumage blanc chaud
    if (window.DMX && window.DMX.isConnected()) { window.DMX.endOfImpro(); }
    // Reset select et résultat
    document.getElementById('selectCatForm').reset();
    document.getElementById('result').style.display = 'none';
    const currentType = selectedCat ? selectedCat.type : null;
    selectedCat = null;
    // Recharger toutes les musiques
    loadMusicsPublic();
    // Affiche le conteneur et le lecteur audio même si aucune musique n'est trouvée
    transitionContainer.style.display = '';
    audioTransition.style.display = '';
    audioTransition.src = '';
    // Joue une musique de transition aléatoire filtrée par type de catégorie
    const res = await fetch('data/musics.json.php?' + Date.now());
    let message = '';
    if(res.ok) {
        const musics = await res.json();
        // Filtrer musiques actives et transition uniquement (on ignore le type)
        const transitions = musics.filter(m => m.transition && m.active !== false);
        if(transitions.length > 0) {
            const m = transitions[Math.floor(Math.random()*transitions.length)];
            const audioPath = 'music/' + m.filename;
            console.log('[Transition] Fichier audio sélectionné :', audioPath);
            audioTransition.src = audioPath;
            audioTransition.currentTime = 60;
            audioTransition.volume = 1;
            // Ajout d'un gestionnaire d'erreur
            audioTransition.onerror = function(e) {
                console.error('[Transition] Erreur de chargement audio :', audioPath, e);
            };
            // Si la musique n'est pas encore chargée, attendre l'événement 'loadedmetadata' avant de définir currentTime et jouer
            audioTransition.onloadedmetadata = function() {
                audioTransition.currentTime = 60;
                audioTransition.play();
            };
            // Si déjà prêt, jouer directement
            if (audioTransition.readyState >= 1) {
                audioTransition.currentTime = 60;
                audioTransition.play();
            }
            message = '';
        } else {
            message = "Aucune musique de transition disponible.";
        }
    } else {
        message = "Erreur lors du chargement des musiques de transition.";
    }
    // Affiche ou masque le message selon le cas
    let msgDiv = document.getElementById('transitionMsg');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'transitionMsg';
        msgDiv.className = 'alert alert-warning mt-2';
        transitionContainer.insertBefore(msgDiv, audioTransition);
    }
    if (message) {
        msgDiv.textContent = message;
        msgDiv.style.display = '';
        // On masque le lecteur audio si aucune musique
        audioTransition.style.display = 'none';
    } else {
        msgDiv.textContent = '';
        msgDiv.style.display = 'none';
        // On affiche le lecteur audio
        audioTransition.style.display = '';
    }
});


// Charge les musiques actives dans le select public, filtrées par type si fourni
async function loadMusicsPublic(type = null) {
    const res = await fetch('data/musics.json.php?' + Date.now());
    if(res.ok) {
        const musics = await res.json();
        const select = document.getElementById('musicSelect');
        if (!select) return;
        select.innerHTML = '';
        musics
            .filter(m => m.active !== false && (!type || (Array.isArray(m.types) && m.types.includes(type))))
            .forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.filename;
                opt.textContent = m.title || m.youtube_url;
                select.appendChild(opt);
            });
        // Charger la première musique si dispo, sinon retirer la source
        const player = document.getElementById('musicPlayer');
        if(select.options.length > 0) {
            player.src = 'music/' + select.value;
        } else {
            player.removeAttribute('src');
        }
    }
}

// Changement de sélection
const musicSelect = document.getElementById('musicSelect');
if(musicSelect) {
    musicSelect.addEventListener('change', function() {
        document.getElementById('musicPlayer').src = 'music/' + this.value;
    });
}

loadCategories();
loadMusicsPublic();

// --- Historique des catégories (localStorage) ---
function getCatHistory() {
    try {
        return JSON.parse(localStorage.getItem('catHistory') || '[]');
    } catch(e) {
        return [];
    }
}

function setCatHistory(arr) {
    localStorage.setItem('catHistory', JSON.stringify(arr));
}

function addCatToHistory(cat) {
    let arr = getCatHistory();
    arr.unshift(cat); // Ajoute en haut
    if(arr.length > 10) arr = arr.slice(0, 10); // Max 10 entrées
    setCatHistory(arr);
}

function renderCatHistory() {
    const list = document.getElementById('catHistoryList');
    if(!list) return;
    const arr = getCatHistory();
    list.innerHTML = '';
    if(arr.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item text-muted';
        li.textContent = 'Aucune catégorie choisie.';
        list.appendChild(li);
        return;
    }
    arr.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<strong>${item.name}</strong> <span class="text-secondary">(${item.type || 'Type inconnu'})</span> <span class="float-end text-muted" style="font-size:0.9em;">${item.date}</span>`;
        list.appendChild(li);
    });
}


document.addEventListener('DOMContentLoaded', function() {
    renderCatHistory();
    const resetBtn = document.getElementById('resetHistoryBtn');
    if(resetBtn) {
        resetBtn.addEventListener('click', function() {
            setCatHistory([]);
            renderCatHistory();
        });
    }
});


// --- Commandes reçues de la tablette chrono (chrono.php) ---
// Fondu de sortie puis pause (restaure le volume pour la prochaine lecture)
function fadeOutAudio(el, ms) {
    if (!el || el.paused) return;
    const startVol = el.volume;
    const steps = Math.max(1, Math.round(ms / 50));
    let i = 0;
    const iv = setInterval(() => {
        i++;
        el.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
            clearInterval(iv);
            el.pause();
            try { el.currentTime = 0; } catch(e){}
            el.volume = startVol;
        }
    }, 50);
}
function stopAllSound() {
    fadeOutAudio(document.getElementById('audioTransition'), 1500);
    fadeOutAudio(document.getElementById('musicPlayer'), 1500);
}

let __lastCmdTs = null;
function handleRemoteCommand(name) {
    if (name === 'end_impro') {
        const b = document.getElementById('stopBtn');
        if (b) b.click();            // même effet que le bouton Stopper (chrono + musique + lumières)
    } else if (name === 'cut_sound') {
        stopAllSound();
    }
}
async function pollChronoCommands() {
    try {
        const res = await fetch('chrono_state.php?c=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const ts = (data.cmd && data.cmd.ts) ? data.cmd.ts : 0;
        if (__lastCmdTs === null) { __lastCmdTs = ts; }   // au chargement : ne pas rejouer une vieille commande
        else if (ts > __lastCmdTs) { __lastCmdTs = ts; handleRemoteCommand(data.cmd.name); }
    } catch (e) { /* réseau momentané */ }
}
setInterval(pollChronoCommands, 1000);
pollChronoCommands();
