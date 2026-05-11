    const API_URL = 'https://subopposite-nonheretical-brynn.ngrok-free.dev';
    
    // Функция уведомления
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const icon = type === 'success' ? 'check_circle' : 'error';
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined icon">${icon}</span>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.4s forwards';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

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
                            headers: { 
                                "Authorization": `Bearer ${refreshToken}`,
                                "ngrok-skip-browser-warning": "69420"
                            }
                        });
                        const newAccessToken = res.data.access_token;
                        localStorage.setItem('access_token', newAccessToken);
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        return api(originalRequest);
                    } catch (refreshError) {
                        localStorage.clear();
                        window.location.href = 'check.html';
                    }
                } else {
                    window.location.href = 'check.html';
                }
            }
            return Promise.reject(error);
        }
    );

    async function loadCities(currentCityName) {
    try {

        const res = await api.get('/cities/');
        const data = res.data;

        console.log('Cities:', data);

        const select = document.getElementById("city_id");
        select.innerHTML = "";

        data.forEach(city => {

            const option = document.createElement("option");

            option.value = city.id;
            option.textContent = city.city;

            select.appendChild(option);
        });

        const selectedCity = data.find(
            c => c.city === currentCityName
        );

        if (selectedCity) {
            select.value = selectedCity.id;
        }

    } catch (err) {

        console.error(
            'Cities error:',
            err.response?.data || err
        );

        showToast(
            "Не удалось загрузить города",
            "error"
        );
    }
}

    async function initPage() {
        try {
            const response = await api.get('/users/me');
            const user = response.data;
            
            document.getElementById('full_name').value = user.full_name || "";
            document.getElementById('drawer_name').innerText = user.full_name || "Пользователь";
            document.getElementById('drawer_phone').innerText = user.phone_number || "";
            
            await loadCities(user.city);
        } catch (error) {
            console.error("Ошибка инициализации:", error);
        }
    }

    async function updateProfile() {
        const name = document.getElementById('full_name').value.trim();
        const cityId = document.getElementById('city_id').value;

        if (!name) return showToast("Введите имя", "error");

        const payload = {
            full_name: name,
            city_id: parseInt(cityId)
        };

        try {
            const res = await api.patch('/users/me', payload);
            if (res.status === 200 || res.status === 204) {
                showToast("Данные успешно обновлены!");
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 1500);
            }
        } catch (error) {
            const msg = error.response?.data?.detail || "Ошибка сохранения";
            showToast(msg, "error");
        }
    }

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

    document.addEventListener('DOMContentLoaded', initPage);
