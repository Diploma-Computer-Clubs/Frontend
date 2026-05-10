const API_URL = 'https://subopposite-nonheretical-brynn.ngrok-free.dev';
const params = new URLSearchParams(window.location.search);
const clubId = params.get('club_id');
if (!clubId) { window.location.href = 'map.html'; }

const startTime = localStorage.getItem('booking_start_time') || "17:00";
const endTime   = localStorage.getItem('booking_end_time')   || "18:00";
const token     = localStorage.getItem('access_token');

// Дата берётся из select_time (он уже посчитал нужный день с учётом полуночи)
// Если не сохранена — используем сегодня как fallback
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

    // Формируем start/end в ISO с учётом что endTime может быть следующего дня
    const startISO = `${selectedDateStr}T${startTime}:00`;
    // endDate уже правильно посчитан в select_time (учитывает переход через полночь)
    // при смене даты в календаре пересчитываем endDate относительно новой startDate
    const endISO = `${selectedEndDateStr}T${endTime}:00`;

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

    // Сбрасываем выбор при смене даты
    selected = [];
    updateUI();
    renderMap();
}

// ─── MAP RENDER ───────────────────────────────────────────────────────────────
// Авто-раскладка: зоны идут вертикально блоками
function renderMap() {
    const layer = document.getElementById('pcsLayer');
    layer.innerHTML = '';

    // Убираем старые динамические лейблы (статические оставляем)
    document.querySelectorAll('.dynamic-label').forEach(el => el.remove());

    const mapContainer = document.getElementById('clubMap');
    const PC_SIZE  = 36;
    const PC_GAP   = 8;
    const ZONE_GAP = 30; // отступ между зонами
    const START_X  = 20;
    const START_Y  = 140; // ниже стойки администратора

    let currentY = START_Y;

    availabilityData.forEach(zone => {
        if (!zone.computers || zone.computers.length === 0) return;

        // Лейбл зоны
        const lbl = document.createElement('div');
        lbl.className = 'label dynamic-label';
        lbl.style.top  = (currentY - 18) + 'px';
        lbl.style.left = START_X + 'px';
        lbl.textContent = zone.name;
        mapContainer.appendChild(lbl);

        const isVip = zone.name.toLowerCase().includes('vip');

        zone.computers.forEach((comp, idx) => {
            const isFree = comp.is_Active && comp.bookings && comp.bookings.length === 0;

            const x = START_X + idx * (PC_SIZE + PC_GAP);
            const y = currentY;

            const el = document.createElement('div');
            el.className = `pc ${isVip ? 'vip' : ''} ${isFree ? 'free' : 'busy'}`;
            el.innerText = comp.number;
            el.style.top    = y + 'px';
            el.style.left   = x + 'px';
            el.style.width  = PC_SIZE + 'px';
            el.style.height = PC_SIZE + 'px';

            if (!isFree) {
                // Занятый — тёмно-серый, некликабельный
                el.style.background   = '#1a1a1a';
                el.style.borderColor  = '#2a2a2a';
                el.style.color        = '#333';
                el.style.cursor       = 'default';
                el.title = 'Занято';
            } else {
                // Свободный — яркий
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
                        // Восстанавливаем свободный вид
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
        const res = await axios.post(`${API_URL}/pricing/calculate_bulk`, payload, {
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

    const endDateTimeStr = `${selectedEndDateStr}T${endTime}:00`;

    btn.innerText = "БРОНИРУЕМ...";
    btn.classList.remove('active');

    try {
        const payloadToken = JSON.parse(atob(token.split('.')[1]));
        const userId = payloadToken.sub || payloadToken.user_id;
        const pricePerPc = window.currentTotalPrice / selected.length;

        const data = selected.map(s => ({
            "start_time":   `${selectedDateStr}T${startTime}:00`,
            "end_time":     endDateTimeStr,
            "total_price":  pricePerPc,
            "user_id":      parseInt(userId),
            "computer_id":  s.id,
            "zone_id":      s.zid,
            "club_id":      parseInt(clubId)
        }));

        await axios.post(`${API_URL}/bookings/create_booking`, data, {
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
        const r = await axios.get(`${API_URL}/clubs/get_club_info?club_id=${clubId}`, {
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
            // При первой загрузке берём дату из select_time
            selectedDateStr    = savedStartDate;
            selectedEndDateStr = savedEndDate;
        }

        item.innerHTML = `<span>${daysShort[d.getDay()]}</span><b>${d.getDate()}</b>`;

        item.onclick = async () => {
            document.querySelectorAll('.date-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedDateStr = iso;
            // Пересчитываем дату конца: если end <= start — следующий день
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
    initCalendar(); // выставляет selectedDateStr (сегодня)

    await fetchAvailability();
});