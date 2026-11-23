<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test DMX — Enttec PRO</title>
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0; padding: 24px;
            background: #0b0b0f; color: #eee;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        h1 { font-size: 1.4rem; margin: 0 0 4px; }
        .sub { opacity: .6; font-size: .9rem; margin-bottom: 20px; }
        .bar {
            display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
            background: #16161d; border: 1px solid #262633; border-radius: 12px;
            padding: 14px; margin-bottom: 20px;
        }
        button {
            background: #2d6cdf; color: #fff; border: 0; border-radius: 8px;
            padding: 10px 16px; font-size: .95rem; cursor: pointer; font-weight: 600;
        }
        button.sec { background: #33333f; }
        button.danger { background: #d13b3b; }
        button:disabled { opacity: .4; cursor: not-allowed; }
        select {
            background: #22222c; color: #eee; border: 1px solid #343444;
            border-radius: 8px; padding: 9px 10px; font-size: .9rem;
        }
        #status { font-weight: 600; font-size: .9rem; }
        .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #666; margin-right: 6px; vertical-align: middle; }
        .dot.on { background: #35c759; box-shadow: 0 0 8px #35c759; }
        .dot.err { background: #d13b3b; }
        .quick { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .ch {
            background: #16161d; border: 1px solid #262633; border-radius: 12px; padding: 14px;
        }
        .ch .top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .ch .num { font-weight: 700; }
        .ch .val { font-variant-numeric: tabular-nums; opacity: .8; }
        input[type=range] { width: 100%; }
        .explore { margin-top: 24px; background:#16161d; border:1px solid #262633; border-radius:12px; padding:14px; }
        .explore label { font-size:.85rem; opacity:.7; margin-right:6px; }
        .explore input[type=number] { width: 90px; background:#22222c; color:#eee; border:1px solid #343444; border-radius:6px; padding:7px; }
        code { background:#22222c; padding:2px 6px; border-radius:5px; }
    </style>
</head>
<body>
    <h1>Test DMX — Enttec DMX USB PRO</h1>
    <div class="sub">Web Serial · à ouvrir dans Chrome/Edge, sur le PC où le boîtier est branché.</div>

    <div class="bar">
        <button id="connectBtn">🔌 Connecter</button>
        <button id="disconnectBtn" class="sec" disabled>Déconnecter</button>
        <label style="opacity:.7;font-size:.85rem;">Baud&nbsp;
            <select id="baud">
                <option value="57600" selected>57600</option>
                <option value="115200">115200</option>
                <option value="250000">250000</option>
            </select>
        </label>
        <span id="status"><span class="dot" id="dot"></span>Non connecté</span>
    </div>

    <div class="quick">
        <button class="sec" data-all="255">Tout à 255</button>
        <button class="sec" data-ch="1" data-v="255">Canal 1 → 255</button>
        <button class="sec" data-ch="2" data-v="255">Canal 2 → 255</button>
        <button class="sec" data-ch="3" data-v="255">Canal 3 → 255</button>
        <button class="danger" data-all="0">⬛ Blackout</button>
    </div>

    <div class="grid" id="sliders"></div>

    <div class="explore">
        <strong>Explorer un canal précis</strong><br><br>
        <label>Canal</label><input type="number" id="exCh" min="1" max="512" value="1">
        <label>Valeur</label><input type="number" id="exVal" min="0" max="255" value="255">
        <button class="sec" id="exSet">Envoyer</button>
        <span style="opacity:.6;font-size:.85rem;margin-left:10px;">Pratique pour trouver les canaux au-delà de 16.</span>
    </div>

    <p style="opacity:.5;font-size:.85rem;margin-top:24px;">
        Si rien ne s'allume après connexion : vérifie l'adresse DMX du projecteur, essaie un autre <em>baud</em> ci-dessus,
        et confirme que le driver FTDI est bien installé (le boîtier doit apparaître comme port COM). Le câble DMX part de
        <code>DMX OUT</code> du PRO vers le <code>DMX IN</code> du projecteur.
    </p>

<script>
const NUM_SLIDERS = 16;
const universe = new Uint8Array(512); // 512 canaux, tous à 0
let port = null, writer = null, running = false;

const statusEl = document.getElementById('status');
const dot = document.getElementById('dot');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

function setStatus(txt, cls) {
    statusEl.innerHTML = '<span class="dot ' + (cls||'') + '" id="dot"></span>' + txt;
}

// Trame Enttec PRO : 0x7E | label 6 | len LSB | len MSB | [startcode 0x00, canaux...] | 0xE7
function dmxFrame(chan) {
    const dataLen = chan.length + 1;            // +1 : start code DMX
    const out = new Uint8Array(5 + chan.length + 1);
    out[0] = 0x7E;                               // start of message
    out[1] = 6;                                  // label : Output Only Send DMX
    out[2] = dataLen & 0xFF;                     // length LSB
    out[3] = (dataLen >> 8) & 0xFF;              // length MSB
    out[4] = 0x00;                               // DMX start code
    out.set(chan, 5);                            // valeurs des canaux
    out[out.length - 1] = 0xE7;                  // end of message
    return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Boucle d'envoi ~33 Hz : rafraîchit en continu l'univers DMX
async function sendLoop() {
    while (running && writer) {
        try {
            await writer.write(dmxFrame(universe));
        } catch (e) {
            console.error('Erreur écriture DMX', e);
            setStatus('Erreur d\'écriture', 'err');
            break;
        }
        await sleep(30);
    }
}

async function connect() {
    if (!('serial' in navigator)) {
        alert('Web Serial non supporté. Utilise Chrome ou Edge (pas Firefox/Safari), en HTTPS.');
        return;
    }
    try {
        port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0403 }] }); // FTDI
        const baud = parseInt(document.getElementById('baud').value, 10);
        await port.open({ baudRate: baud });
        writer = port.writable.getWriter();
        running = true;
        sendLoop();
        setStatus('Connecté (' + baud + ' baud)', 'on');
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    } catch (e) {
        console.error(e);
        setStatus('Échec connexion : ' + e.message, 'err');
    }
}

async function disconnect() {
    running = false;
    await sleep(60);
    try { if (writer) { writer.releaseLock(); } } catch(e){}
    try { if (port) { await port.close(); } } catch(e){}
    writer = null; port = null;
    setStatus('Non connecté', '');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
}

function setChannel(ch /*1-based*/, val) {
    if (ch < 1 || ch > 512) return;
    universe[ch - 1] = Math.max(0, Math.min(255, val|0));
    const sl = document.getElementById('sl' + ch);
    const lbl = document.getElementById('v' + ch);
    if (sl) sl.value = universe[ch - 1];
    if (lbl) lbl.textContent = universe[ch - 1];
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);

// Boutons rapides
document.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', () => {
    const v = parseInt(b.dataset.all, 10);
    for (let i = 1; i <= 512; i++) setChannel(i, v);
}));
document.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => {
    setChannel(parseInt(b.dataset.ch,10), parseInt(b.dataset.v,10));
}));

// Explorer
document.getElementById('exSet').addEventListener('click', () => {
    setChannel(parseInt(document.getElementById('exCh').value,10), parseInt(document.getElementById('exVal').value,10));
});

// Génère les sliders
const slidersDiv = document.getElementById('sliders');
for (let ch = 1; ch <= NUM_SLIDERS; ch++) {
    const div = document.createElement('div');
    div.className = 'ch';
    div.innerHTML =
        '<div class="top"><span class="num">Canal ' + ch + '</span><span class="val" id="v' + ch + '">0</span></div>' +
        '<input type="range" min="0" max="255" value="0" id="sl' + ch + '">';
    slidersDiv.appendChild(div);
    div.querySelector('input').addEventListener('input', e => setChannel(ch, parseInt(e.target.value,10)));
}

window.addEventListener('beforeunload', () => { running = false; });
</script>
</body>
</html>
