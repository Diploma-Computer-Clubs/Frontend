const API_URL = 'http://138.16.224.101:8000';
const params = new URLSearchParams(window.location.search);
const clubId = params.get('club_id');
if (!clubId) { window.location.href = 'map.html'; }

const startTime = localStorage.getItem('booking_start_time') || "17:00";
const endTime   = localStorage.getItem('booking_end_time')   || "18:00";
const token     = localStorage.getItem('access_token');

function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const savedStartDate = localStorage.getItem('booking_start_date') || getTodayISO();
const savedEndDate   = localStorage.getItem('booking_end_date')   || getTodayISO();

let selected       = [];
let selectedDateStr = "";
let selectedEndDateStr = "";
let availabilityData = [];

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
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────
async function fetchAvailability() {
    const layer = document.getElementById('pcsLayer');
    layer.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#444;font-size:12px;">Загрузка...</div>';

    const startISO = `${selectedDateStr}T${startTime}:00`;
    const endISO   = `${selectedEndDateStr}T${endTime}:00`;

    try {
        const res = await axios.get(
            `${API_URL}/clubs/${clubId}/availability`,
            {
                params: { start_time: startISO, end_time: endISO },
                headers: {
                    "ngrok-skip-browser-warning": "69420",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                }
            }
        );
        availabilityData = res.data;
    } catch (e) {
        console.error('Availability error:', e);
        availabilityData = [];
        layer.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#555;font-size:12px;">Не удалось загрузить места</div>';
        return;
    }

    selected = [];
    updateUI();
    renderMap();
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
// Парсим время напрямую из строки "2026-05-15T19:00:00" — без Date(), без сдвига таймзоны
function formatTime(isoStr) {
    if (!isoStr) return '--:--';
    const timePart = isoStr.split('T')[1] || isoStr;
    const parts = timePart.split(':');
    return `${parts[0]}:${parts[1]}`;
}

function getOrCreateTooltip() {
    let tt = document.getElementById('pcTooltip');
    if (!tt) {
        // Inject CSS matching admin design exactly
        const s = document.createElement('style');
        s.textContent = `
            .pc-tooltip {
                position: fixed;
                z-index: 9998;
                background: rgba(15,15,15,0.97);
                border: 1px solid rgba(139,26,26,0.6);
                border-radius: 12px;
                padding: 10px 14px;
                pointer-events: none;
                opacity: 0;
                transform: translateY(6px) scale(0.97);
                transition: opacity 0.18s ease, transform 0.18s ease;
                box-shadow: 0 8px 28px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
                min-width: 170px;
                max-width: 230px;
                font-family: 'Montserrat', sans-serif;
            }
            .pc-tooltip.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .pc-tooltip-header {
                display: flex;
                align-items: center;
                gap: 7px;
                margin-bottom: 8px;
            }
            .pc-tooltip-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                background: #ff4d4d;
                box-shadow: 0 0 6px #ff4d4d;
                flex-shrink: 0;
            }
            .pc-tooltip-title {
                font-size: 11px;
                font-weight: 700;
                color: rgba(255,255,255,0.45);
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .pc-tooltip-time {
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 6px 10px;
            }
            .pc-tooltip-time-icon {
                font-size: 14px;
                color: rgba(255,255,255,0.4);
            }
            .pc-tooltip-time-text {
                font-size: 13px;
                font-weight: 700;
                color: #fff;
                letter-spacing: 0.3px;
            }
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
                <span class="material-symbols-outlined pc-tooltip-time-icon">schedule</span>
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
    let top  = rect.top - tt.offsetHeight - 10;
    if (top < 8) top = rect.bottom + 10;
    if (left < 8) left = 8;
    if (left + ttW > window.innerWidth - 8) left = window.innerWidth - ttW - 8;
    tt.style.left = left + 'px';
    tt.style.top  = top + 'px';
}

function hidePcTooltip() {
    const tt = document.getElementById('pcTooltip');
    if (tt) tt.classList.remove('visible');
}

// ─── MAP RENDER ───────────────────────────────────────────────────────────────
function renderMap() {
    const layer = document.getElementById('pcsLayer');
    layer.innerHTML = '';

    document.querySelectorAll('.dynamic-label').forEach(el => el.remove());

    const mapContainer = document.getElementById('clubMap');
    const PC_SIZE  = 36;
    const PC_GAP   = 8;
    const ZONE_GAP = 30;
    const START_X  = 20;
    const START_Y  = 140;

    let currentY = START_Y;

    availabilityData.forEach(zone => {
        if (!zone.computers || zone.computers.length === 0) return;

        const lbl = document.createElement('div');
        lbl.className = 'label dynamic-label';
        lbl.style.top  = (currentY - 18) + 'px';
        lbl.style.left = START_X + 'px';
        lbl.textContent = zone.name;
        mapContainer.appendChild(lbl);

        const isVip = zone.name.toLowerCase().includes('vip');

        zone.computers.forEach((comp, idx) => {
            const isOffline = !comp.is_Active;
            const isFree = comp.is_Active && comp.bookings && comp.bookings.length === 0;

            const x = START_X + idx * (PC_SIZE + PC_GAP);
            const y = currentY;

            const el = document.createElement('div');
            el.className = `pc ${isVip ? 'vip' : ''} ${isFree ? 'free' : 'busy'}`;
            el.style.top    = y + 'px';
            el.style.left   = x + 'px';
            el.style.width  = PC_SIZE + 'px';
            el.style.height = PC_SIZE + 'px';

            if (isOffline) {
                // Выключен — показываем иконку, выбрать нельзя
                el.style.background  = '#0d0d0d';
                el.style.borderColor = '#1a1a1a';
                el.style.cursor      = 'default';
                el.style.opacity     = '0.5';
                el.innerHTML = `<img src="../img/offline.png" style="width:20px;height:20px;object-fit:contain;opacity:0.6;" alt="offline">`;
                el.title = `ПК №${comp.number} — не активен`;
            } else if (!isFree) {
                el.innerText = comp.number;
                el.style.background   = '#1a1a1a';
                el.style.borderColor  = '#2a2a2a';
                el.style.color        = '#333';
                el.style.cursor       = 'default';
                if (comp.bookings && comp.bookings.length > 0) {
                    el.addEventListener('mouseenter', () => showPcTooltip(el, comp.bookings));
                    el.addEventListener('mouseleave', hidePcTooltip);
                    el.addEventListener('mousemove',  () => movePcTooltip(el));
                    el.addEventListener('touchstart', (e) => { e.preventDefault(); showPcTooltip(el, comp.bookings); }, { passive: false });
                    el.addEventListener('touchend',   () => setTimeout(hidePcTooltip, 1500));
                }
            } else {
                el.innerText = comp.number;
                if (isVip) {
                    el.style.background  = '#1a0a0a';
                    el.style.borderColor = '#8b1a1a';
                    el.style.color       = '#ff6b6b';
                } else {
                    el.style.background  = '#1a1a2e';
                    el.style.borderColor = '#4a4a8a';
                    el.style.color       = '#aaaaff';
                }

                el.onclick = () => {
                    const pcData = { id: comp.id, n: comp.number, zid: zone.id, isVip };
                    const idx = selected.findIndex(s => s.id === comp.id);
                    if (idx > -1) {
                        selected.splice(idx, 1);
                        el.classList.remove('selected');
                        if (isVip) {
                            el.style.background  = '#1a0a0a';
                            el.style.borderColor = '#8b1a1a';
                            el.style.color       = '#ff6b6b';
                        } else {
                            el.style.background  = '#1a1a2e';
                            el.style.borderColor = '#4a4a8a';
                            el.style.color       = '#aaaaff';
                        }
                    } else {
                        if (selected.length >= 5) {
                            showToast("Максимум можно выбрать 5 компьютеров");
                            return;
                        }
                        selected.push(pcData);
                        el.classList.add('selected');
                        el.style.background  = '#8b1a1a';
                        el.style.borderColor = '#ff4d4d';
                        el.style.color       = '#fff';
                    }
                    updateUI();
                };
            }

            layer.appendChild(el);
        });

        currentY += PC_SIZE + ZONE_GAP;
    });
}

// ─── PRICE ────────────────────────────────────────────────────────────────────
async function calculatePrice() {
    if (selected.length === 0) return 0;

    const zonesCount = selected.reduce((acc, pc) => {
        acc[pc.zid] = (acc[pc.zid] || 0) + 1;
        return acc;
    }, {});

    const items = Object.entries(zonesCount).map(([zid, count]) => ({
        zone_id: parseInt(zid),
        count: count
    }));

    const payload = [{ items, start_time: `${selectedDateStr}T${startTime}:00`, end_time: `${selectedEndDateStr}T${endTime}:00` }];

    try {
        const res = await axios.post(`${API_URL}/pricing/calculate`, payload, {
            headers: { "ngrok-skip-browser-warning": "69420" }
        });
        return res.data.total_amount;
    } catch (e) {
        console.error("Ошибка расчета цены:", e);
        return 0;
    }
}

// ─── UI UPDATE ────────────────────────────────────────────────────────────────
async function updateUI() {
    const btn   = document.getElementById('confirmBtn');
    const label = document.getElementById('seatLabel');

    if (selected.length > 0) {
        const totalPrice = await calculatePrice();
        window.currentTotalPrice = totalPrice;

        const grouped = selected.reduce((acc, curr) => {
            const zone = curr.isVip ? "VIP зона" : "Стандарт";
            acc[zone] = acc[zone] || [];
            acc[zone].push(`№${curr.n}`);
            return acc;
        }, {});

        label.innerHTML = Object.entries(grouped)
            .map(([z, nums]) => `${z} <b>${nums.join(', ')}</b>`)
            .join('<br>') +
            `<br><span style="color:#4CAF50; font-size:16px;">К оплате: ${totalPrice} ₸</span>`;

        btn.classList.add('active');
    } else {
        label.innerHTML = '<span>не выбраны</span>';
        btn.classList.remove('active');
        window.currentTotalPrice = 0;
    }
}

// ─── BOOKING ──────────────────────────────────────────────────────────────────
async function handleBooking() {
    const btn = document.getElementById('confirmBtn');
    if (!window.currentTotalPrice || window.currentTotalPrice === 0) {
        showToast("Ошибка: цена не рассчитана");
        return;
    }

    btn.innerText = "БРОНИРУЕМ...";
    btn.classList.remove('active');

    try {
        const pricePerPc = window.currentTotalPrice / selected.length;

        // FIX: убран user_id (бэк берёт из токена), эндпоинт /bookings/create_booking → /bookings
        const data = selected.map(s => ({
            "start_time":  `${selectedDateStr}T${startTime}:00`,
            "end_time":    `${selectedEndDateStr}T${endTime}:00`,
            "total_price": pricePerPc,
            "computer_id": s.id,
            "zone_id":     s.zid,
            "club_id":     parseInt(clubId)
        }));

        await axios.post(`${API_URL}/bookings`, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420'
            }
        });

        showToast("Успешно забронировано!", "success");
        setTimeout(() => { window.location.href = 'booking.html'; }, 1500);
    } catch (e) {
        showToast(e.response?.data?.detail || "Ошибка бронирования");
        btn.innerText = "ПОДТВЕРДИТЬ БРОНИРОВАНИЕ";
        btn.classList.add('active');
    }
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
async function fetchClubInfo() {
    try {
        const cached = localStorage.getItem('club_cache_' + clubId);
        if (cached) renderHeader(JSON.parse(cached));

        // FIX: /clubs/get_club_info?club_id= → /clubs/{id}
        const r = await axios.get(`${API_URL}/clubs/${clubId}`, {
            headers: { "ngrok-skip-browser-warning": "69420" }
        });
        renderHeader(r.data);
        localStorage.setItem('club_cache_' + clubId, JSON.stringify(r.data));
    } catch (e) {
        document.getElementById('clubNameHeader').innerText = "Клуб";
    }
}

function renderHeader(club) {
    document.getElementById('clubNameHeader').innerText = club.name;
    document.getElementById('clubAddrHeader').innerHTML =
        `<span class="material-symbols-outlined" style="font-size:12px">location_on</span> ${club.address}`;
    const logoImg = document.getElementById('clubLogoImg');
    const logoPlaceholder = document.getElementById('clubLogoPlaceholder');
    if (club.image_url && club.image_url !== 'string') {
        logoImg.src = API_URL + club.image_url;
        logoImg.style.display = 'block';
        logoPlaceholder.style.display = 'none';
    } else {
        logoPlaceholder.innerText = club.name.substring(0, 2).toUpperCase();
    }
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function initCalendar() {
    const list = document.getElementById('dateSelector');
    const daysShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    list.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);

        const year  = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day   = String(d.getDate()).padStart(2, '0');
        const iso   = `${year}-${month}-${day}`;

        const item = document.createElement('div');
        item.className = `date-item ${i === 0 ? 'active' : ''}`;
        if (i === 0) {
            selectedDateStr    = savedStartDate;
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
                selectedEndDateStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
            } else {
                selectedEndDateStr = iso;
            }
            await fetchAvailability();
        };
        list.appendChild(item);
    }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('timeLabel').innerText = `${startTime} – ${endTime}`;
    fetchClubInfo();
    initCalendar();
    await fetchAvailability();
});