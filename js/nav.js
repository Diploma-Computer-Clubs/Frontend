/**
 * Единое боковое меню для всех страниц.
 * На <body> задай data-nav-active="map" (ключ текущей страницы).
 *
 * Роли:
 *   user  — обычный пользователь
 *   owner — владелец клуба
 *   admin — суперадмин (только профиль + админ-панель)
 */
(function () {
    const API_URL = 'http://138.16.224.101:8000/';

    const NAV_LINKS = [
        { key: 'mainpage', href: 'mainpage.html', icon: 'home', label: 'Главная', hideForRoles: ['admin'] },
        { key: 'profile', href: 'profile.html', icon: 'account_circle', label: 'Профиль', auth: true },
        { key: 'owner_benefits', href: 'owner_benefits.html', icon: 'handshake', label: 'Для владельцев', roles: ['owner'] },
        { key: 'map', href: 'map.html', icon: 'search', label: 'Карта клубов', hideForRoles: ['admin'] },
        { key: 'owner', href: 'admin_create_club.html', icon: 'add_business', label: 'Создать клуб', roles: ['owner'] },
        { key: 'dashboard', href: 'admin_dashboard.html', icon: 'store', label: 'Мой клуб', roles: ['owner'] },
        { key: 'superadmin', href: 'superadmin.html', icon: 'admin_panel_settings', label: 'Админ панель', roles: ['admin'] },
        { key: 'booking', href: 'booking.html', icon: 'diamond', label: 'Бронь', auth: true, hideForRoles: ['admin'] },
    ];

    function createApi() {
        const api = axios.create({
            baseURL: API_URL,
            headers: { 'ngrok-skip-browser-warning': '69420' },
        });
        api.interceptors.request.use(cfg => {
            const t = localStorage.getItem('access_token');
            if (t) cfg.headers.Authorization = 'Bearer ' + t;
            return cfg;
        });
        return api;
    }

    function icon(name) {
        return '<span class="material-symbols-outlined">' + name + '</span>';
    }

    function shouldShowItem(item, active, role, isAuth) {
        if (item.hideOn && item.hideOn.includes(active)) return false;
        if (item.auth && !isAuth) return false;
        if (item.hideForRoles && item.hideForRoles.includes(role)) return false;
        if (item.roles && !item.roles.includes(role)) return false;
        return true;
    }

    function buildNavHtml(active, user, isAuth) {
        const role = user?.role || '';
        let html = '';

        NAV_LINKS.forEach(item => {
            if (!shouldShowItem(item, active, role, isAuth)) return;
            const cls = item.key === active ? 'drawer-link active' : 'drawer-link';
            html += '<a href="' + item.href + '" class="' + cls + '" data-nav-key="' + item.key + '">' +
                icon(item.icon) + item.label + '</a>';
        });

        if (isAuth) {
            html += '<a href="#" class="drawer-link logout" id="appNavLogout">' +
                icon('logout') + 'Выйти</a>';
        } else {
            html += '<a href="check.html" class="drawer-link login-link">' +
                icon('login') + 'Войти</a>';
        }
        return html;
    }

    function updateDrawerUser(user, isAuth) {
        const nameEl = document.getElementById('drawer_name');
        const phoneEl = document.getElementById('drawer_phone');
        if (!nameEl) return;

        if (isAuth && user) {
            nameEl.textContent = user.full_name || 'Пользователь';
            phoneEl.textContent = user.phone_number || '';
            localStorage.setItem('user_full_name', user.full_name || '');
            localStorage.setItem('user_phone', user.phone_number || '');
        } else {
            nameEl.textContent = 'Гость';
            phoneEl.textContent = 'Войдите в аккаунт';
        }
    }

    function applyOwnerStorage(user) {
        if (!user) return;
        if (user.club_id) localStorage.setItem('owner_club_id', user.club_id);
        if (user.club_ids?.length) localStorage.setItem('owner_club_id', user.club_ids[0]);
    }

    function updateHeaderAdminLink(user) {
        const el = document.getElementById('superadminNavLink');
        if (!el) return;
        if (user?.role === 'admin') el.classList.add('visible');
        else el.classList.remove('visible');
    }

    function bindBurger() {
        const burger = document.getElementById('burger');
        const drawer = document.getElementById('sideDrawer');
        const overlay = document.getElementById('overlay');
        if (!burger || !drawer || !overlay) return;

        function close() {
            burger.classList.remove('open');
            drawer.classList.remove('open');
            overlay.classList.remove('active');
        }
        function toggle() {
            burger.classList.toggle('open');
            drawer.classList.toggle('open');
            overlay.classList.toggle('active');
        }

        burger.replaceWith(burger.cloneNode(true));
        document.getElementById('burger').addEventListener('click', toggle);
        overlay.replaceWith(overlay.cloneNode(true));
        document.getElementById('overlay').addEventListener('click', close);
    }

    function bindLogout(container) {
        const btn = container.querySelector('#appNavLogout');
        if (!btn) return;
        btn.addEventListener('click', e => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'check.html';
        });
    }

    async function initAppNav() {
        const drawer = document.getElementById('sideDrawer');
        if (!drawer) return;

        let container = document.getElementById('appDrawerNav');
        if (!container) {
            container = drawer.querySelector('.drawer-nav');
            if (container) container.id = 'appDrawerNav';
        }
        if (!container) return;

        const active = document.body.dataset.navActive || '';
        const token = localStorage.getItem('access_token');
        let user = null;

        if (token) {
            const cachedName = localStorage.getItem('user_full_name');
            if (cachedName) {
                updateDrawerUser({ full_name: cachedName, phone_number: localStorage.getItem('user_phone') }, true);
            }
            try {
                user = (await createApi().get('/users/me')).data;
                applyOwnerStorage(user);
            } catch (_) { /* guest fallback */ }
        }

        const isAuth = !!token;
        container.innerHTML = buildNavHtml(active, user, isAuth);
        updateDrawerUser(user, isAuth);
        updateHeaderAdminLink(user);
        bindBurger();
        bindLogout(container);

        document.dispatchEvent(new CustomEvent('appnav:ready', { detail: { user, isAuth } }));
    }

    document.addEventListener('DOMContentLoaded', initAppNav);
    window.AppNav = { init: initAppNav, refresh: initAppNav };
})();