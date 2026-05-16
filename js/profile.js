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

    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                const refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken) {
                    try {
                        const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
                            headers: { "Authorization": `Bearer ${refreshToken}`, "ngrok-skip-browser-warning": "69420" }
                        });
                        localStorage.setItem('access_token', res.data.access_token);
                        originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
                        return api(originalRequest);
                    } catch (e) { localStorage.clear(); window.location.href = 'check.html'; }
                } else { window.location.href = 'check.html'; }
            }
            return Promise.reject(error);
        }
    );

    async function getProfile() {
        try {
            const res = await api.get('/users/me');
            const user = res.data;
            document.getElementById('full_name').value = user.full_name || "Не указано";
            document.getElementById('phone_number').value = user.phone_number || "Не указан";
            document.getElementById('city').value = user.city || "Не указан";
            document.getElementById('drawer_name').innerText = user.full_name || "Пользователь";
            document.getElementById('drawer_phone').innerText = user.phone_number || "";
        } catch (error) { console.error("Ошибка профиля:", error); }
    }

    const modal = document.getElementById('deleteModal');
    
    document.getElementById('openDeleteModal').onclick = () => modal.classList.add('active');
    document.getElementById('cancelDeleteBtn').onclick = () => modal.classList.remove('active');

    document.getElementById('confirmDeleteBtn').onclick = async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        try {
            btn.innerText = "Удаляем...";
            btn.disabled = true;
            await api.delete('/users/delete_user');
            localStorage.clear();
            window.location.href = 'check.html';
        } catch (error) {
            alert("Ошибка при удалении. Попробуйте позже.");
            btn.innerText = "Да, удалить";
            btn.disabled = false;
            modal.classList.remove('active');
        }
    };

    const burgerBtn = document.getElementById('burger');
    const sideDrawer = document.getElementById('sideDrawer');
    const overlay = document.getElementById('overlay');
    function toggleMenu() {
        burgerBtn.classList.toggle('open');
        sideDrawer.classList.toggle('open');
        overlay.classList.toggle('active');
    }
    burgerBtn.onclick = toggleMenu;
    overlay.onclick = toggleMenu;

    document.addEventListener('DOMContentLoaded', getProfile);