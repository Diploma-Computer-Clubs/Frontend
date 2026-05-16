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
                            headers: { 
                                "Authorization": `Bearer ${refreshToken}`,
                                "ngrok-skip-browser-warning": "69420"
                            }
                        });
                        const newAccessToken = res.data.access_token;
                        localStorage.setItem('access_token', newAccessToken);
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        return api(originalRequest);
                    } catch (refreshErr) {
                        console.error("Refresh token expired");
                        localStorage.clear();
                        window.location.href = 'check.html';
                    }
                }
            }
            return Promise.reject(error);
        }
    );

    // 2. Бургер-меню
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

    // 3. Синхронизация данных пользователя
    function updateBurgerUI(user) {
        const nameEl = document.getElementById('drawer_name');
        const phoneEl = document.getElementById('drawer_phone');
        
        if (user) {
            nameEl.innerText = user.full_name || "Пользователь";
            phoneEl.innerText = user.phone_number || "";
            // Кэшируем данные
            localStorage.setItem('user_full_name', user.full_name);
            localStorage.setItem('user_phone', user.phone_number);
        } else {
            nameEl.innerText = "Войти в аккаунт";
            phoneEl.innerText = "";
        }
    }

    async function syncProfile() {
        const savedName = localStorage.getItem('user_full_name');
        const savedPhone = localStorage.getItem('user_phone');
        if (savedName) {
            document.getElementById('drawer_name').innerText = savedName;
            document.getElementById('drawer_phone').innerText = savedPhone || "";
        }

        try {
            const response = await api.get('/users/me');
            updateBurgerUI(response.data);
        } catch (err) {
            if (!localStorage.getItem('access_token')) {
                document.getElementById('drawer_name').innerText = "Войти в аккаунт";
            }
            console.log("Profile sync skipped or user not logged in");
        }
    }

    document.addEventListener('DOMContentLoaded', syncProfile);