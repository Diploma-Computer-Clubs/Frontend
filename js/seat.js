            const API_URL = 'https://subopposite-nonheretical-brynn.ngrok-free.dev';
            const params = new URLSearchParams(window.location.search);
            const clubId = params.get('club_id') || 27; 
            
            const startTime = localStorage.getItem('booking_start_time') || "17:00";
            const endTime = localStorage.getItem('booking_end_time') || "18:00";
            const token = localStorage.getItem('access_token');

            let selected = [];
            let selectedDateStr = "";

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

            const pcsData = [
                {n: 1, id: 5, zid: 7, x: 50, y: 150, isVip: false},
                {n: 2, id: 6, zid: 7, x: 100, y: 150, isVip: false},
                {n: 3, id: 11, zid: 7, x: 150, y: 150, isVip: false},
                {n: 4, id: 12, zid: 7, x: 200, y: 150, isVip: false},
                {n: 5, id: 13, zid: 7, x: 250, y: 150, isVip: false},
                {n: 30, id: 4, zid: 9, x: 50, y: 320, isVip: true},
                {n: 31, id: 7, zid: 9, x: 100, y: 320, isVip: true},
                {n: 32, id: 8, zid: 9, x: 150, y: 320, isVip: true},
                {n: 33, id: 9, zid: 9, x: 200, y: 320, isVip: true},
                {n: 34, id: 10, zid: 9, x: 250, y: 320, isVip: true}
            ];


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

    let endDateTime = `${selectedDateStr}T${endTime}:00Z`;
    if (endTime <= startTime) {
        let nextDay = new Date(selectedDateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        const y = nextDay.getFullYear();
        const m = String(nextDay.getMonth() + 1).padStart(2, '0');
        const d = String(nextDay.getDate()).padStart(2, '0');
        endDateTime = `${y}-${m}-${d}T${endTime}:00Z`;
    }

    const payload = [{
        items: items,
        start_time: `${selectedDateStr}T${startTime}:00Z`,
        end_time: endDateTime
    }];

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
                    document.getElementById('clubNameHeader').innerText = "Клуб Prime";
                }
            }

            function renderHeader(club) {
                document.getElementById('clubNameHeader').innerText = club.name;
                document.getElementById('clubAddrHeader').innerHTML = `<span class="material-symbols-outlined" style="font-size:12px">location_on</span> ${club.address}`;
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

            function renderMap() {
                const layer = document.getElementById('pcsLayer');
                layer.innerHTML = ''; 
                pcsData.forEach(pc => {
                    const el = document.createElement('div');
                    el.className = `pc ${pc.isVip ? 'vip' : ''}`;
                    el.innerText = pc.n;
                    el.style.top = pc.y + 'px';
                    el.style.left = pc.x + 'px';
                    el.onclick = () => {
                        const idx = selected.findIndex(s => s.id === pc.id);
                        if (idx > -1) {
                            selected.splice(idx, 1);
                            el.classList.remove('selected');
                        } else {
                            if (selected.length >= 5) {
                                showToast("Максимум можно выбрать 5 компьютеров");
                                return;
                            }
                            selected.push(pc);
                            el.classList.add('selected');
                        }
                        updateUI();
                    };
                    layer.appendChild(el);
                });
            }

                            async function updateUI() {
                    const btn = document.getElementById('confirmBtn');
                    const label = document.getElementById('seatLabel');
                    
                    if (selected.length > 0) {
                        
                        const totalPrice = await calculatePrice();
                        window.currentTotalPrice = totalPrice; 

                        const grouped = selected.reduce((acc, curr) => {
                            const zone = curr.isVip ? "Vip зона" : "Общий зал";
                            acc[zone] = acc[zone] || [];
                            acc[zone].push(`№${curr.n}`);
                            return acc;
                        }, {});

                        label.innerHTML = Object.entries(grouped)
                            .map(([z, nums]) => `${z} <b>${nums.join(', ')}</b>`)
                            .join('<br>') + `<br><span style="color:#4CAF50; font-size:16px;">К оплате: ${totalPrice} ₸</span>`;
                        
                        btn.classList.add('active');
                    } else {
                        label.innerHTML = '<span>не выбраны</span>';
                        btn.classList.remove('active');
                        window.currentTotalPrice = 0;
                    }
                }

            async function handleBooking() {
    const btn = document.getElementById('confirmBtn');
    if (!window.currentTotalPrice || window.currentTotalPrice === 0) {
        showToast("Ошибка: цена не рассчитана");
        return;
    }

    let endDateTimeStr = `${selectedDateStr}T${endTime}:00`;
    if (endTime <= startTime) {
        let nextDay = new Date(selectedDateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        const y = nextDay.getFullYear();
        const m = String(nextDay.getMonth() + 1).padStart(2, '0');
        const d = String(nextDay.getDate()).padStart(2, '0');
        endDateTimeStr = `${y}-${m}-${d}T${endTime}:00`;
    }

    btn.innerText = "БРОНИРУЕМ...";
    btn.classList.remove('active');
    
    try {
        const payloadToken = JSON.parse(atob(token.split('.')[1]));
        const userId = payloadToken.sub || payloadToken.user_id;
        const pricePerPc = window.currentTotalPrice / selected.length;

        const data = selected.map(s => ({
            "start_time": `${selectedDateStr}T${startTime}:00`,
            "end_time": endDateTimeStr, //  корректная дата следующего дня
            "total_price": pricePerPc, 
            "user_id": parseInt(userId),
            "computer_id": s.id, 
            "zone_id": s.zid,    
            "club_id": parseInt(clubId)
        }));

        await axios.post(`${API_URL}/bookings/create_booking`, data, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        showToast("Успешно забронировано!", "success");
        setTimeout(() => { window.location.href = 'booking.html'; }, 1500);
    } catch (e) {
        showToast(e.response?.data?.detail || "Ошибка бронирования");
        btn.innerText = "ПОДТВЕРДИТЬ БРОНИРОВАНИЕ";
        btn.classList.add('active');
    }
}

function initCalendar() {
    const list = document.getElementById('dateSelector');
    const daysShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    list.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        
      
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const iso = `${year}-${month}-${day}`; 

        const item = document.createElement('div');
        item.className = `date-item ${i === 0 ? 'active' : ''}`;
        
        if (i === 0) selectedDateStr = iso;

        item.innerHTML = `<span>${daysShort[d.getDay()]}</span><b>${d.getDate()}</b>`;
        
        item.onclick = async () => {
            const allItems = document.querySelectorAll('.date-item');
            allItems.forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            selectedDateStr = iso; 
            console.log("Выбрана дата:", selectedDateStr);
            
            await updateUI(); 
        };
        list.appendChild(item);
    }
}
document.addEventListener('DOMContentLoaded', () => {
   
    const now = new Date();
    const [h, m] = startTime.split(':');
    const bookingDate = new Date(selectedDateStr);
    bookingDate.setHours(h, m);

    if (bookingDate < now) {
        console.warn("Бронь в прошлом! Измените время в select_time.html");
    
    }

    fetchClubInfo();
    renderMap();
    initCalendar();
    document.getElementById('timeLabel').innerText = `${startTime} - ${endTime}`;
});