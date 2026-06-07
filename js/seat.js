const API_URL = 'http://138.16.224.101:8000';
const params = new URLSearchParams(window.location.search);
const clubId = params.get('club_id');
if (!clubId) { window.location.href = 'map.html'; }

const startTime = localStorage.getItem('booking_start_time') || '17:00';
const endTime   = localStorage.getItem('booking_end_time')   || '18:00';
const token     = localStorage.getItem('access_token');

const PC_SIZE = 28;
const MAP_PAD = 48;
const ZONE_COLORS = ['#6b8cff', '#ff6b6b', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];

function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const savedStartDate = localStorage.getItem('booking_start_date') || getTodayISO();
const savedEndDate   = localStorage.getItem('booking_end_date')   || getTodayISO();

let selected = [];
let selectedDateStr = '';
let selectedEndDateStr = '';
let availabilityData = [];
let mapObjects = [];
let clubDetail = null;
let zoneColorById = {};
let zoneNameById = {};
let mapLayout = { ox: 0, oy: 0, w: 600, h: 480 };

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'error') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check_circle' : 'info';
    toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.35s ease-in forwards';
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}

function apiImg(path) {
    if (!path || path === 'string') return '';
    return path.startsWith('http') ? path : `${API_URL}${path}`;
}

function zoneAccent(zoneId, zoneName) {
    if (zoneColorById[zoneId]) return zoneColorById[zoneId];
    const isVip = (zoneName || '').toLowerCase().includes('vip');
    return isVip ? '#ff6b6b' : '#6b8cff';
}

function looksLikeGridCoords(items) {
    if (!items.length) return false;
    const mx = Math.max(...items.map(p => p.x ?? 0));
    const my = Math.max(...items.map(p => p.y ?? 0));
    return mx < 24 && my < 24;
}

function normalizeFloorCoords() {
    availabilityData.forEach((zone, zi) => {
        const pcs = zone.computers || [];
        const zx = zone.x ?? 0;
        const zy = zone.y ?? 0;
        const zoneGrid = looksLikeGridCoords(pcs.map(p => ({ x: p.x, y: p.y })));
        const zonePosUnset = (zx === 0 && zy === 0) || zoneGrid;

        if (zonePosUnset && zi > 0) {
            zone.x = 70 + zi * 160;
            zone.y = 100;
        } else if (zone.x == null) zone.x = zx;
        if (zone.y == null) zone.y = zy;

        if (zoneGrid && pcs.length) {
            const step = PC_SIZE + 8;
            const baseX = (zone.x || 0) + 8;
            const baseY = (zone.y || 0) + 26;
            pcs.forEach((pc, i) => {
                const gx = pc.x ?? (i % 4);
                const gy = pc.y ?? Math.floor(i / 4);
                pc.x = baseX + gx * step;
                pc.y = baseY + gy * step;
            });
        } else {
            pcs.forEach(pc => {
                pc.x = pc.x ?? 0;
                pc.y = pc.y ?? 0;
            });
        }
    });
}

function computeMapLayout() {
    const pts = [];
    availabilityData.forEach(zone => {
        if (zone.x != null && zone.y != null) pts.push({ x: zone.x, y: zone.y });
        (zone.computers || []).forEach(pc => {
            if (pc.x != null && pc.y != null) pts.push({ x: pc.x, y: pc.y, w: PC_SIZE, h: PC_SIZE });
        });
    });
    mapObjects.forEach(obj => {
        pts.push({ x: obj.x, y: obj.y, w: obj.width || 40, h: obj.height || 40 });
    });
    if (!pts.length) {
        mapLayout = { ox: MAP_PAD, oy: MAP_PAD, w: 360, h: 400 };
        return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
        const w = p.w || 0;
        const h = p.h || 0;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + w);
        maxY = Math.max(maxY, p.y + h);
    });
    mapLayout = {
        ox: MAP_PAD - minX,
        oy: MAP_PAD - minY,
        w: Math.max(320, maxX - minX + MAP_PAD * 2),
        h: Math.max(280, maxY - minY + MAP_PAD * 2),
    };
}

function mapX(x) { return (x || 0) + mapLayout.ox; }
function mapY(y) { return (y || 0) + mapLayout.oy; }

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────
async function fetchAvailability() {
    const loading = document.getElementById('mapLoading');
    if (loading) loading.style.display = 'flex';

    const startISO = `${selectedDateStr}T${startTime}:00`;
    const endISO = `${selectedEndDateStr}T${endTime}:00`;

    try {
        const [availRes, mapRes] = await Promise.all([
            axios.get(`${API_URL}/clubs/${clubId}/availability`, {
                params: { start_time: startISO, end_time: endISO },
                headers: {
                    'ngrok-skip-browser-warning': '69420',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }),
            axios.get(`${API_URL}/map-objects/${clubId}/map-objects/`, {
                headers: { 'ngrok-skip-browser-warning': '69420' },
            }).catch(() => ({ data: [] })),
        ]);
        availabilityData = Array.isArray(availRes.data) ? availRes.data : [];
        mapObjects = Array.isArray(mapRes.data) ? mapRes.data : [];
    } catch (e) {
        console.error('Availability error:', e);
        availabilityData = [];
        mapObjects = [];
        if (loading) {
            loading.textContent = 'Не удалось загрузить схему';
            return;
        }
    }

    normalizeFloorCoords();
    computeMapLayout();
    selected = [];
    updateUI();
    renderMap();
    scrollMapIntoView();
    if (loading) loading.style.display = 'none';
}

function scrollMapIntoView() {
    const wrap = document.getElementById('mapWrapper');
    if (!wrap) return;
    requestAnimationFrame(() => {
        wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
        wrap.scrollTop = Math.max(0, (wrap.scrollHeight - wrap.clientHeight) / 4);
    });
}

// ─── TOOLTIP ────────────────────────────────────────────────────────────────
function formatTime(isoStr) {
    if (!isoStr) return '--:--';
    const timePart = isoStr.split('T')[1] || isoStr;
    const parts = timePart.split(':');
    return `${parts[0]}:${parts[1]}`;
}

function getOrCreateTooltip() {
    let tt = document.getElementById('pcTooltip');
    if (!tt) {
        const s = document.createElement('style');
        s.textContent = `
            .pc-tooltip {
                position: fixed; z-index: 9998;
                background: rgba(15,15,15,0.97);
                border: 1px solid rgba(139,26,26,0.6);
                border-radius: 12px; padding: 10px 14px;
                pointer-events: none; opacity: 0;
                transform: translateY(6px) scale(0.97);
                transition: opacity 0.18s ease, transform 0.18s ease;
                box-shadow: 0 8px 28px rgba(0,0,0,0.7);
                min-width: 170px; max-width: 230px;
                font-family: 'Montserrat', sans-serif;
            }
            .pc-tooltip.visible { opacity: 1; transform: translateY(0) scale(1); }
            .pc-tooltip-header { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
            .pc-tooltip-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 6px #ff4d4d; }
            .pc-tooltip-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.8px; }
            .pc-tooltip-time { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 6px 10px; }
            .pc-tooltip-time-text { font-size: 13px; font-weight: 700; color: #fff; }
        `;
        document.head.appendChild(s);
        tt = document.createElement('div');
        tt.id = 'pcTooltip';
        tt.className = 'pc-tooltip';
        tt.innerHTML = `
            <div class="pc-tooltip-header">
                <div class="pc-tooltip-dot"></div>
                <span class="pc-tooltip-title">Занято</span>
            </div>
            <div class="pc-tooltip-time">
                <span class="material-symbols-outlined" style="font-size:14px;color:rgba(255,255,255,0.4)">schedule</span>
                <span class="pc-tooltip-time-text" id="tooltipTimeText"></span>
            </div>`;
        document.body.appendChild(tt);
    }
    return tt;
}

function showPcTooltip(el, bookings) {
    const tt = getOrCreateTooltip();
    const lines = bookings.map(b => `${formatTime(b.start_time)} – ${formatTime(b.end_time)}`);
    const timeEl = document.getElementById('tooltipTimeText');
    if (timeEl) timeEl.textContent = lines.join(', ');
    tt.classList.add('visible');
    movePcTooltip(el);
}

function movePcTooltip(el) {
    const tt = document.getElementById('pcTooltip');
    if (!tt) return;
    const rect = el.getBoundingClientRect();
    const ttW = 200;
    let left = rect.left + rect.width / 2 - ttW / 2;
    let top = rect.top - tt.offsetHeight - 10;
    if (top < 8) top = rect.bottom + 10;
    if (left < 8) left = 8;
    if (left + ttW > window.innerWidth - 8) left = window.innerWidth - ttW - 8;
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
}

function hidePcTooltip() {
    const tt = document.getElementById('pcTooltip');
    if (tt) tt.classList.remove('visible');
}

// ─── MAP RENDER ─────────────────────────────────────────────────────────────
function renderMapObjects(layer) {
    mapObjects.forEach(obj => {
        if (obj.type === 'wall') {
            const el = document.createElement('div');
            el.className = 'map-obj-wall';
            el.style.left = mapX(obj.x) + 'px';
            el.style.top = mapY(obj.y) + 'px';
            el.style.width = (obj.width || 80) + 'px';
            el.style.height = (obj.height || 5) + 'px';
            if (obj.rotation) el.style.transform = `rotate(${obj.rotation}deg)`;
            layer.appendChild(el);
            return;
        }
        const el = document.createElement('div');
        if (obj.type === 'admin_desk') {
            el.className = 'map-obj-desk map-obj-facility';
            el.style.left = mapX(obj.x) + 'px';
            el.style.top = mapY(obj.y) + 'px';
            el.style.width = (obj.width || 90) + 'px';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'flex-start';
            el.style.justifyContent = 'flex-end';
            el.style.border = 'none';
            el.innerHTML = `<div class="desk-bar"></div><div class="desk-lbl">${obj.label || 'стойка'}</div>`;
        } else {
            el.className = 'map-obj-facility';
            el.style.left = mapX(obj.x) + 'px';
            el.style.top = mapY(obj.y) + 'px';
            el.style.width = (obj.width || 48) + 'px';
            el.style.height = (obj.height || 40) + 'px';
            el.textContent = obj.label || (obj.type === 'toilet' ? 'WC' : '');
        }
        if (obj.rotation) el.style.transform = `rotate(${obj.rotation}deg)`;
        layer.appendChild(el);
    });
}

function renderMap() {
    const canvas = document.getElementById('floorCanvas');
    const objLayer = document.getElementById('mapObjectsLayer');
    const lblLayer = document.getElementById('zoneLabelsLayer');
    const pcLayer = document.getElementById('pcsLayer');
    if (!canvas || !pcLayer) return;

    canvas.style.width = mapLayout.w + 'px';
    canvas.style.height = mapLayout.h + 'px';
    objLayer.innerHTML = '';
    lblLayer.innerHTML = '';
    pcLayer.innerHTML = '';

    renderMapObjects(objLayer);

    availabilityData.forEach((zone, zi) => {
        if (!zone.computers || !zone.computers.length) return;

        const zName = zone.name || zoneNameById[zone.id] || 'зона';
        const accent = zoneAccent(zone.id, zName);
        zoneColorById[zone.id] = accent;

        const lbl = document.createElement('div');
        lbl.className = 'zone-label';
        lbl.style.left = mapX(zone.x ?? 70 + zi * 140) + 'px';
        lbl.style.top = mapY(zone.y ?? 90) + 'px';
        lbl.innerHTML = `<span class="zone-label-dot" style="background:${accent}"></span><span class="zone-label-text">${zName}</span>`;
        lblLayer.appendChild(lbl);

        const isVip = zName.toLowerCase().includes('vip');

        zone.computers.forEach(comp => {
            const isOffline = comp.is_Active === false || comp.is_active === false;
            const isFree = !isOffline && comp.bookings && comp.bookings.length === 0;
            const isSelected = !!selected.find(s => s.id === comp.id);

            const el = document.createElement('div');
            el.className = `pc ${isVip ? 'vip' : ''} ${isOffline ? 'offline' : isFree ? 'free' : 'busy'}${isSelected ? ' selected' : ''}`;
            el.style.left = mapX(comp.x) + 'px';
            el.style.top = mapY(comp.y) + 'px';
            el.style.width = PC_SIZE + 'px';
            el.style.height = PC_SIZE + 'px';
            el.style.borderColor = accent;

            if (isOffline) {
                el.innerHTML = `<img src="../img/offline.png" style="width:18px;height:18px;object-fit:contain;opacity:0.55" alt="">`;
                el.title = `ПК №${comp.number} — не активен`;
            } else if (!isFree) {
                el.textContent = comp.number;
                if (comp.bookings && comp.bookings.length) {
                    el.addEventListener('mouseenter', () => showPcTooltip(el, comp.bookings));
                    el.addEventListener('mouseleave', hidePcTooltip);
                    el.addEventListener('mousemove', () => movePcTooltip(el));
                    el.addEventListener('touchstart', e => {
                        e.preventDefault();
                        showPcTooltip(el, comp.bookings);
                    }, { passive: false });
                    el.addEventListener('touchend', () => setTimeout(hidePcTooltip, 1500));
                }
            } else {
                el.textContent = comp.number;
                applyFreePcStyle(el, isVip, isSelected);
                el.onclick = () => togglePcSelect(comp, zone.id, zName, isVip, el);
            }

            pcLayer.appendChild(el);
        });
    });

    const hasPcs = pcLayer.querySelector('.pc');
    if (!hasPcs) {
        const empty = document.createElement('div');
        empty.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#555;font-size:12px;font-weight:600;text-align:center;padding:20px;';
        empty.textContent = 'Нет мест на выбранное время';
        pcLayer.appendChild(empty);
    }
}

function applyFreePcStyle(el, isVip, isSelected) {
    if (isSelected) {
        el.classList.add('selected');
        return;
    }
    el.classList.remove('selected');
}

function togglePcSelect(comp, zoneId, zoneName, isVip, el) {
    const idx = selected.findIndex(s => s.id === comp.id);
    if (idx > -1) {
        selected.splice(idx, 1);
        applyFreePcStyle(el, isVip, false);
    } else {
        if (selected.length >= 5) {
            showToast('Максимум 5 компьютеров');
            return;
        }
        selected.push({ id: comp.id, n: comp.number, zid: zoneId, zoneName, isVip });
        el.classList.add('selected');
    }
    updateUI();
}

// ─── PRICE ──────────────────────────────────────────────────────────────────
async function calculatePrice() {
    if (selected.length === 0) return 0;
    const zonesCount = selected.reduce((acc, pc) => {
        acc[pc.zid] = (acc[pc.zid] || 0) + 1;
        return acc;
    }, {});
    const items = Object.entries(zonesCount).map(([zid, count]) => ({
        zone_id: parseInt(zid, 10),
        count,
    }));
    const payload = [{
        items,
        start_time: `${selectedDateStr}T${startTime}:00`,
        end_time: `${selectedEndDateStr}T${endTime}:00`,
    }];
    try {
        const res = await axios.post(`${API_URL}/pricing/calculate`, payload, {
            headers: { 'ngrok-skip-browser-warning': '69420' },
        });
        return res.data.total_amount;
    } catch (e) {
        console.error('Ошибка расчета цены:', e);
        return 0;
    }
}

// ─── UI UPDATE ──────────────────────────────────────────────────────────────
async function updateUI() {
    const btn = document.getElementById('confirmBtn');
    const label = document.getElementById('seatLabel');

    if (selected.length > 0) {
        const totalPrice = await calculatePrice();
        window.currentTotalPrice = totalPrice;

        const grouped = selected.reduce((acc, curr) => {
            const zn = curr.zoneName || zoneNameById[curr.zid] || 'Зона';
            acc[zn] = acc[zn] || [];
            acc[zn].push(`№${curr.n}`);
            return acc;
        }, {});

        label.innerHTML = Object.entries(grouped)
            .map(([z, nums]) => `${z} <span>${nums.join(', ')}</span>`)
            .join('<br>') +
            `<br><span style="color:#6fcf97;font-size:15px;font-weight:700;">К оплате: ${totalPrice} ₸</span>`;

        btn.classList.add('active');
        btn.onclick = handleBooking;
    } else {
        label.innerHTML = '<span style="color:#555">не выбраны</span>';
        btn.classList.remove('active');
        window.currentTotalPrice = 0;
    }
}

// ─── BOOKING ────────────────────────────────────────────────────────────────
async function handleBooking() {
    const btn = document.getElementById('confirmBtn');
    if (!window.currentTotalPrice || window.currentTotalPrice === 0) {
        showToast('Ошибка: цена не рассчитана');
        return;
    }

    btn.textContent = 'Бронируем…';
    btn.classList.remove('active');

    try {
        const pricePerPc = Math.round(window.currentTotalPrice / selected.length);
        const data = selected.map(s => ({
            start_time: `${selectedDateStr}T${startTime}:00`,
            end_time: `${selectedEndDateStr}T${endTime}:00`,
            total_price: pricePerPc,
            computer_id: s.id,
            zone_id: s.zid,
            club_id: parseInt(clubId, 10),
        }));

        await axios.post(`${API_URL}/bookings`, data, {
            headers: {
                Authorization: `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420',
            },
        });

        showToast('Успешно забронировано!', 'success');
        setTimeout(() => { window.location.href = 'booking.html'; }, 1500);
    } catch (e) {
        const errData = e.response?.data;
        let errMsg = 'Ошибка бронирования';

        if (errData) {
            if (typeof errData === 'string') {
                errMsg = errData;
            } else if (errData.detail) {
                // detail может быть строкой или массивом объектов (FastAPI validation)
                if (typeof errData.detail === 'string') {
                    errMsg = errData.detail;
                } else if (Array.isArray(errData.detail)) {
                    errMsg = errData.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
                } else {
                    errMsg = JSON.stringify(errData.detail);
                }
            } else if (errData.message) {
                errMsg = errData.message;
            } else {
                errMsg = JSON.stringify(errData);
            }
        } else if (e.message) {
            errMsg = e.message;
        }

        console.error('Booking error:', e.response?.status, errData);
        showToast(errMsg);
        btn.textContent = 'Подтвердить бронирование';
        btn.classList.add('active');
    }
}

// ─── CLUB INFO ──────────────────────────────────────────────────────────────
async function fetchClubInfo() {
    try {
        const cached = localStorage.getItem('club_cache_' + clubId);
        if (cached) applyClubDetail(JSON.parse(cached));

        const r = await axios.get(`${API_URL}/clubs/${clubId}`, {
            headers: { 'ngrok-skip-browser-warning': '69420' },
        });
        clubDetail = r.data;
        applyClubDetail(clubDetail);
        localStorage.setItem('club_cache_' + clubId, JSON.stringify(clubDetail));
    } catch (e) {
        document.getElementById('clubNameHeader').textContent = 'Клуб';
    }
}

function applyClubDetail(club) {
    clubDetail = club;
    document.getElementById('clubNameHeader').textContent = club.name || 'Клуб';
    const addrEl = document.getElementById('clubAddrText');
    if (addrEl) addrEl.textContent = club.address || '—';

    const logoImg = document.getElementById('clubLogoImg');
    const logoPlaceholder = document.getElementById('clubLogoPlaceholder');
    const imgUrl = apiImg(club.image_url);
    if (imgUrl) {
        logoImg.src = imgUrl;
        logoImg.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        logoImg.onerror = () => {
            logoImg.style.display = 'none';
            logoPlaceholder.style.display = 'flex';
            logoPlaceholder.textContent = (club.name || 'CL').substring(0, 2).toUpperCase();
        };
    } else {
        logoImg.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
        logoPlaceholder.textContent = (club.name || 'CL').substring(0, 2).toUpperCase();
    }

    zoneNameById = {};
    zoneColorById = {};
    (club.zones || []).forEach((z, i) => {
        zoneNameById[z.id] = z.name;
        zoneColorById[z.id] = z.name?.toLowerCase().includes('vip') ? '#ff6b6b' : ZONE_COLORS[i % ZONE_COLORS.length];
    });

    const canvas = document.getElementById('floorCanvas');
    const bg = apiImg(club.img_background);
    if (canvas && bg) {
        canvas.classList.add('has-bg');
        canvas.style.backgroundImage = `url(${bg})`;
    }
}

// ─── CALENDAR ───────────────────────────────────────────────────────────────
function initCalendar() {
    const list = document.getElementById('dateSelector');
    const daysShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    list.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const iso = `${year}-${month}-${day}`;

        const item = document.createElement('div');
        item.className = `date-item ${i === 0 ? 'active' : ''}`;
        if (i === 0) {
            selectedDateStr = savedStartDate;
            selectedEndDateStr = savedEndDate;
        }

        item.innerHTML = `<span>${daysShort[d.getDay()]}</span><b>${d.getDate()}</b>`;

        item.onclick = async () => {
            document.querySelectorAll('.date-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedDateStr = iso;
            if (endTime <= startTime) {
                const next = new Date(iso);
                next.setDate(next.getDate() + 1);
                selectedEndDateStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
            } else {
                selectedEndDateStr = iso;
            }
            await fetchAvailability();
        };
        list.appendChild(item);
    }
}

// ─── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('timeLabel').textContent = `${startTime} – ${endTime}`;
    document.getElementById('confirmBtn').onclick = handleBooking;
    await fetchClubInfo();
    initCalendar();
    await fetchAvailability();
});