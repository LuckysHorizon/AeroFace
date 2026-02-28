// ═══════════════════════════════════════════════════════════
//  AeroFace Lounge Verification — App Logic
// ═══════════════════════════════════════════════════════════

// ── Config ────────────────────────────────────────────────
const SUPABASE_URL = 'https://fksgblzszxwmoqbmzbsj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2dibHpzenh3bW9xYm16YnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzY5NjksImV4cCI6MjA4Nzc1Mjk2OX0.aAh2Tj8CMiTjXpawt4afEA6YTCQevCV9SFhKJPlNZ-I';
const FACE_API_URL = 'http://10.250.9.132:8000';

// ── Supabase Client ───────────────────────────────────────
// CDN v2 puts createClient on window.supabase
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ─────────────────────────────────────────────────
let currentUser = null;
let loungeData = null;
let cameraStream = null;
let autoScanInterval = null;
let isVerifying = false;

// ── DOM ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════

async function handleLogin() {
    const email = $('email').value.trim();
    const password = $('password').value;
    const btn = $('login-btn');
    const errorBox = $('login-error');

    if (!email || !password) {
        showError(errorBox, 'Please enter email and password.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>Signing in…</span>';
    errorBox.classList.add('hidden');

    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        await loadLoungeAndStart();
    } catch (err) {
        showError(errorBox, err.message || 'Login failed.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
    }
}

async function handleLogout() {
    stopAutoScan();
    stopCamera();
    await sb.auth.signOut();
    currentUser = null;
    loungeData = null;
    switchScreen('login-screen');
}

async function checkSession() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
            currentUser = session.user;
            await loadLoungeAndStart();
        }
    } catch (e) {
        console.warn('Session check failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════
//  LOUNGE DATA
// ═══════════════════════════════════════════════════════════

async function loadLoungeAndStart() {
    const { data, error } = await sb
        .from('lounges')
        .select('id, name, airport_code, airport_name')
        .eq('owner_id', currentUser.id)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Failed to load lounge:', error);
        $('lounge-name').textContent = 'Lounge not found';
    } else if (data) {
        loungeData = data;
        $('lounge-name').textContent = data.name + ' — ' + data.airport_code;
    } else {
        $('lounge-name').textContent = 'No lounge registered';
    }

    switchScreen('verify-screen');
    await startCamera();
    checkApiHealth();
}

// ═══════════════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════════════

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
        });
        $('camera-feed').srcObject = cameraStream;
    } catch (err) {
        console.error('Camera error:', err);
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(function (t) { t.stop(); });
        cameraStream = null;
    }
}

function captureFrame() {
    var video = $('camera-feed');
    var canvas = $('capture-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

// ═══════════════════════════════════════════════════════════
//  VERIFICATION
// ═══════════════════════════════════════════════════════════

async function captureAndVerify() {
    if (isVerifying) return;
    isVerifying = true;

    var btn = $('verify-btn');
    var overlay = $('scan-overlay');
    var resultOverlay = $('result-overlay');

    btn.disabled = true;
    btn.classList.add('scanning');
    btn.querySelector('span').textContent = 'Scanning…';
    overlay.className = 'scan-overlay scanning';
    resultOverlay.classList.add('hidden');

    try {
        var imageBase64 = captureFrame();

        var payload = { image_base64: imageBase64 };
        if (loungeData && loungeData.id) {
            payload.lounge_id = loungeData.id;
        }

        var res = await fetch(FACE_API_URL + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            var errBody = await res.json().catch(function () { return { detail: 'Server error' }; });
            throw new Error(errBody.detail || 'Verification failed (' + res.status + ')');
        }

        var result = await res.json();

        if (result.matched) {
            showResult(true, result.user_id, result.confidence, result.message);
            overlay.className = 'scan-overlay success';
        } else {
            showResult(false, null, result.confidence, result.message);
            overlay.className = 'scan-overlay fail';
        }

        addLogEntry(result);

    } catch (err) {
        showResult(false, null, 0, err.message || 'Verification error');
        overlay.className = 'scan-overlay fail';
        addLogEntry({ matched: false, message: err.message, confidence: 0 });
    } finally {
        btn.disabled = false;
        btn.classList.remove('scanning');
        btn.querySelector('span').textContent = 'Verify Face';
        isVerifying = false;

        setTimeout(function () {
            overlay.className = 'scan-overlay';
            resultOverlay.classList.add('hidden');
        }, 3000);
    }
}

function showResult(success, userId, confidence, message) {
    var overlay = $('result-overlay');
    var card = $('result-card');
    var icon = $('result-icon');
    var title = $('result-title');
    var detail = $('result-detail');

    overlay.classList.remove('hidden');
    card.className = 'result-card ' + (success ? 'success' : 'fail');
    icon.textContent = success ? '✅' : '❌';
    title.textContent = success ? ('Welcome, ' + userId) : 'No Match';
    title.style.color = success ? '#10B981' : '#EF4444';
    detail.textContent = success
        ? ('Verified with ' + (confidence * 100).toFixed(1) + '% confidence')
        : (message || 'Face not recognized');
}

function addLogEntry(result) {
    var list = $('log-list');
    var empty = list.querySelector('.log-empty');
    if (empty) empty.remove();

    var now = new Date();
    var time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    var entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML =
        '<div class="log-icon ' + (result.matched ? 'success' : 'fail') + '">' +
        (result.matched ? '✅' : '❌') +
        '</div>' +
        '<div class="log-info">' +
        '<div class="log-name">' + (result.matched ? result.user_id : 'Unrecognized') + '</div>' +
        '<div class="log-detail">' + (result.matched ? ((result.confidence * 100).toFixed(1) + '% confidence') : (result.message || 'No match')) + '</div>' +
        '</div>' +
        '<div class="log-time">' + time + '</div>';

    list.prepend(entry);
}

// ═══════════════════════════════════════════════════════════
//  AUTO SCAN
// ═══════════════════════════════════════════════════════════

function toggleAutoScan() {
    var btn = $('auto-toggle');
    if (autoScanInterval) {
        stopAutoScan();
        btn.classList.remove('active');
        btn.querySelector('span').textContent = 'Auto Scan: OFF';
    } else {
        autoScanInterval = setInterval(function () {
            if (!isVerifying) captureAndVerify();
        }, 5000);
        btn.classList.add('active');
        btn.querySelector('span').textContent = 'Auto Scan: ON';
    }
}

function stopAutoScan() {
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
}

// ═══════════════════════════════════════════════════════════
//  API HEALTH
// ═══════════════════════════════════════════════════════════

async function checkApiHealth() {
    var dot = $('api-status');
    var text = $('api-status-text');

    try {
        var res = await fetch(FACE_API_URL + '/health');
        if (res.ok) {
            dot.className = 'status-dot online';
            text.textContent = 'API Online';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'API Error';
        }
    } catch (e) {
        dot.className = 'status-dot offline';
        text.textContent = 'API Offline';
    }

    setTimeout(checkApiHealth, 30000);
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $(id).classList.add('active');
}

function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {
    $('login-btn').addEventListener('click', handleLogin);
    $('logout-btn').addEventListener('click', handleLogout);
    $('verify-btn').addEventListener('click', captureAndVerify);
    $('auto-toggle').addEventListener('click', toggleAutoScan);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && $('login-screen').classList.contains('active')) {
            handleLogin();
        }
    });

    checkSession();
});
