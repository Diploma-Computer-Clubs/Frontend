const API_URL = 'http://138.16.224.101:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: { "ngrok-skip-browser-warning": "69420" }
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const burgerBtn = document.getElementById('burger');
const sideDrawer = document.getElementById('sideDrawer');
const overlay = document.getElementById('overlay');

function toggleMenu() {
    burgerBtn.classList.toggle('open');
    sideDrawer.classList.toggle('open');
    overlay.classList.toggle('active');
}
burgerBtn.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

async function syncProfile() {
    try {
        const response = await api.get('/users/me');
        const user = response.data;
        document.getElementById('drawer_name').innerText = user.full_name || "Пользователь";
        document.getElementById('drawer_phone').innerText = user.phone_number || "";
    } catch (err) { console.log("Profile sync skipped"); }
}

async function loadBookings() {
    const listElement = document.getElementById('bookings-list');
    const emptyState = document.getElementById('empty-state');
    const loader = document.getElementById('loader');

    try {
        const res = await api.get('/bookings/me');
        const bookings = Array.isArray(res.data) ? res.data : [];
        loader.style.display = 'none';

        if (bookings.length === 0) {
            emptyState.style.display = 'block';
            listElement.innerHTML = '';
            return;
        }

        const groups = {};
        bookings.forEach(b => {
            const zoneId = b.zone?.id || b.zone?.name || 'default';
            const key = `${b.club?.name}-${b.start_time}-${b.end_time}-${zoneId}`;

            if (!groups[key]) {
                groups[key] = {
                    club: b.club?.name || "UNDERLIE",
                    address: b.club?.address || "",
                    zone: b.zone?.name || "Стандарт",
                    start: new Date(b.start_time),
                    end: new Date(b.end_time),
                    pcs: [b.computer?.number],
                    ids: [b.id],
                    totalPrice: b.total_price || 0  // берём цену первого, суммируем ниже
                };
            } else {
                groups[key].pcs.push(b.computer?.number);
                groups[key].ids.push(b.id);
                groups[key].totalPrice += b.total_price || 0;  // суммируем цены всех мест
            }
        });

        emptyState.style.display = 'none';
        
        const sortedGroups = Object.values(groups).sort((a, b) => b.start - a.start);

        listElement.innerHTML = sortedGroups.map(g => {
            const dateStr = g.start.toLocaleDateString('ru-RU');
            const timeStr = `${g.start.getHours().toString().padStart(2,'0')}:${g.start.getMinutes().toString().padStart(2,'0')} - ${g.end.getHours().toString().padStart(2,'0')}:${g.end.getMinutes().toString().padStart(2,'0')}`;
            const idsStr = JSON.stringify(g.ids);
            const pcsList = g.pcs.sort((a, b) => a - b).join(', ');
            
            return `
                <div class="booking-card">
                    <button class="delete-btn" onclick='confirmDelete(this, ${idsStr})'>
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                    <div class="club-name">${g.club}</div>
                    <div class="club-address">${g.address}</div>
                    <div class="details-grid">
                        <div><div class="label">Дата</div><div class="value">${dateStr}</div></div>
                        <div><div class="label">Время</div><div class="value">${timeStr}</div></div>
                        <div><div class="label">Зона</div><div class="value">${g.zone}</div></div>
                        <div><div class="label">Места</div><div class="value pc-badge">№${pcsList}</div></div>
                    </div>
                    <div class="price-row">
                        <span class="material-symbols-outlined" style="font-size:16px">payments</span>
                        Итого: <b>${g.totalPrice} ₸</b>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        loader.innerText = "Ошибка загрузки.";
    }
}

async function confirmDelete(btn, ids) {
    if (btn.classList.contains('confirm-mode')) {
        btn.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 1s infinite linear">sync</span>`;
        btn.disabled = true;
        try {
            await Promise.all(
    ids.map(id =>
        api.delete(`/bookings/${id}`)
    )
);
            await loadBookings();
        } catch (e) {
            alert("Ошибка удаления");
            resetDeleteBtn(btn);
        }
    } else {
        btn.classList.add('confirm-mode');
        btn.innerHTML = `<span style="font-size: 10px; font-weight: bold;">ОК?</span>`;
        btn.style.width = "60px";
        btn.style.background = "#ff4d4d";
        btn.style.color = "#fff";
        setTimeout(() => resetDeleteBtn(btn), 3000);
    }
}

function resetDeleteBtn(btn) {
    if (btn && btn.classList.contains('confirm-mode')) {
        btn.classList.remove('confirm-mode');
        btn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
        btn.style.width = "36px";
        btn.style.background = "rgba(255,255,255,0.1)";
        btn.style.color = "#ff4d4d";
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncProfile();
    loadBookings();
});