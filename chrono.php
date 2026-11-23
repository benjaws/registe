<?php require __DIR__."/auth.php"; require_login_page(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Chrono</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <style>
        :root { color-scheme: dark; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            height: 100%;
            width: 100%;
            background: #0b0b0f;
            color: #fff;
            font-family: "Poppins", system-ui, -apple-system, sans-serif;
            overflow: hidden;
            -webkit-user-select: none;
            user-select: none;
        }
        #wrap {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2vmin;
            transition: background 0.4s ease;
        }
        #theme {
            font-size: 4.5vmin;
            font-weight: 600;
            color: #eec41e;
            max-width: 90%;
            min-height: 6vmin;
            margin-bottom: 1vmin;
        }
        #time {
            font-size: 38vmin;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.02em;
        }
        #status {
            font-size: 3.5vmin;
            opacity: 0.5;
            margin-top: 2vmin;
            text-transform: uppercase;
            letter-spacing: 0.3em;
        }
        /* États */
        body.running #wrap { background: #0b0b0f; }
        body.warning #time { color: #eec41e; }
        body.danger  #time { color: #ff3b3b; }
        body.finished #wrap { background: #2a0000; }
        body.finished #time { color: #ff3b3b; }
        body.stopped #time, body.idle #time { opacity: 0.25; }

        /* Clignotement sur les 5 dernières secondes + FIN */
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        body.blink #time { animation: blink 1s steps(1) infinite; }

        #hint {
            position: fixed;
            top: 1.5vmin;
            right: 2vmin;
            font-size: 1.8vmin;
            opacity: 0.25;
        }
        #actions {
            position: fixed; left: 0; right: 0; bottom: 0;
            display: flex; gap: 2vmin; padding: 2vmin;
            background: linear-gradient(to top, rgba(0,0,0,.55), transparent);
        }
        #actions button {
            flex: 1 1 0; min-height: 12vmin; border: 0; border-radius: 2vmin;
            font-size: 3.4vmin; font-weight: 700; color: #fff; cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }
        #btnEnd { background: #e4405f; }
        #btnCut { background: #38424d; }
        #actions button:active { filter: brightness(1.3); transform: scale(0.98); }
        #actions button.sent { filter: brightness(1.6); box-shadow: 0 0 0 0.6vmin rgba(255,255,255,.4); }
    </style>
</head>
<body class="idle">
    <div id="wrap">
        <div id="theme"></div>
        <div id="time">0:00</div>
        <div id="status">En attente</div>
    </div>
    <div id="hint">Chrono — synchro</div>
    <div id="actions">
        <button id="btnEnd">⏹️ Fin d'impro</button>
        <button id="btnCut">🔇 Couper le son</button>
    </div>

<script>
// Commandes envoyées à la page principale (qui les exécute)
async function sendCommand(name, btn) {
    try {
        if (btn) { btn.classList.add('sent'); setTimeout(() => btn.classList.remove('sent'), 450); }
        await fetch('chrono_state.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'command', cmd: name }),
            keepalive: true
        });
    } catch (e) { /* best-effort */ }
}
document.getElementById('btnEnd').addEventListener('click', e => sendCommand('end_impro', e.currentTarget));
document.getElementById('btnCut').addEventListener('click', e => sendCommand('cut_sound', e.currentTarget));

const timeEl   = document.getElementById('time');
const themeEl  = document.getElementById('theme');
const statusEl = document.getElementById('status');
const body     = document.body;

let state = null;      // dernier état reçu du serveur
let clockOffset = 0;   // serverNow - clientNow (en secondes)

function format(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
}

function serverTime() {
    return (Date.now() / 1000) + clockOffset;
}

function setBodyClass(cls) {
    body.className = cls;
}

async function poll() {
    try {
        const res = await fetch('chrono_state.php?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            clockOffset = data.serverNow - (Date.now() / 1000);
            state = data;
        }
    } catch (e) { /* réseau momentané : on garde le dernier état */ }
}

function render() {
    if (!state) return;
    themeEl.textContent = state.theme || '';

    if (state.state === 'running') {
        const remaining = state.endAt - serverTime();
        if (remaining <= 0) {
            timeEl.textContent = 'FIN';
            statusEl.textContent = 'Terminé';
            setBodyClass('finished blink');
            return;
        }
        timeEl.textContent = format(remaining);
        statusEl.textContent = 'En cours';
        let cls = 'running';
        if (remaining <= 5)      cls = 'danger blink';
        else if (remaining <= 15) cls = 'warning';
        setBodyClass(cls);
    } else if (state.state === 'stopped') {
        timeEl.textContent = '0:00';
        statusEl.textContent = 'Stoppé';
        setBodyClass('stopped');
    } else { // idle
        timeEl.textContent = '0:00';
        statusEl.textContent = 'En attente';
        setBodyClass('idle');
    }
}

// Rendu fluide local (interpolation) + re-synchro régulière
setInterval(render, 200);
setInterval(poll, 1000);
poll();

// Garde l'écran de la tablette allumé si possible
let wakeLock = null;
async function keepAwake() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (e) {}
}
keepAwake();
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { keepAwake(); poll(); }
});
</script>
</body>
</html>
