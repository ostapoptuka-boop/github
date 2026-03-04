
        // ==========================================
        // API LAYER — CONNECTION TO BACKEND
        // ==========================================
        const API_BASE = '/api';
        let authToken = localStorage.getItem('trustAuthToken') || null;

        async function apiCall(endpoint, method, body) {
            try {
                const opts = {
                    method: method || 'GET',
                    headers: { 'Content-Type': 'application/json' }
                };
                if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
                if (body) opts.body = JSON.stringify(body);
                const res = await fetch(API_BASE + endpoint, opts);
                const data = await res.json();
                if (res.status === 401 && data.error === 'Сессия истекла, войдите снова') {
                    authToken = null;
                    localStorage.removeItem('trustAuthToken');
                    isAuth = false;
                    checkAuthUI();
                    showCustomAlert('Сессия истекла', 'Войдите снова', 'warning');
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                console.error('API Error:', err);
                return { ok: false, status: 0, data: { error: 'Ошибка сети. Проверьте подключение.' } };
            }
        }

        // ==========================================
        // БАЗОВАЯ ЛОГИКА (БАЛАНС, ПОРТФЕЛЬ, АВТОРИЗАЦИЯ)
        // ==========================================
        let trustMainBalance = parseFloat(localStorage.getItem('trustMainBalance')) || 0.00;
        let trustPortfolio = JSON.parse(localStorage.getItem('trustPortfolio')) || {};
        let trustBuyPrices = JSON.parse(localStorage.getItem('trustBuyPrices')) || {};
        let isAuth = localStorage.getItem('trustIsAuth') === 'true';

        function updateBalanceUI() {
            const profileBal = document.getElementById('profileBalance');
            if (profileBal) profileBal.textContent = trustMainBalance.toFixed(2) + '$'; 
            const tradeBal = document.getElementById('tradeAvailableBal');
            if (tradeBal) tradeBal.textContent = trustMainBalance.toFixed(2);
            // Also update any balance display inside miner modal
            const minerBal = document.getElementById('minerBalanceDisplay');
            if (minerBal) minerBal.textContent = trustMainBalance.toFixed(4) + '$ USDT';
            // Update withdrawal available balance
            const wAvail = document.getElementById('withdrawAvailBalance');
            if (wAvail) wAvail.textContent = trustMainBalance.toFixed(2) + '$ USDT';
        }
        updateBalanceUI();

        function checkAuthUI() {
            if(isAuth) {
                document.getElementById('btnAuth').style.display = 'none';
                document.getElementById('profileArea').style.display = 'block';
                let savedName = localStorage.getItem('trustUserName');
                if(savedName) {
                    document.getElementById('displayUserName').textContent = savedName;
                    // Обновить аватар-буквы
                    const parts = savedName.trim().split(/\s+/);
                    const initials = parts.length >= 2 
                        ? (parts[0][0] + parts[1][0]).toUpperCase() 
                        : savedName.slice(0,2).toUpperCase();
                    const av = document.getElementById('profileAvatar');
                    if(av) av.textContent = initials;
                }
                let savedId = localStorage.getItem('trustUserId');
                if(savedId) document.getElementById('displayTrustId').textContent = 'ID: ' + savedId;
                // Restore avatar
                setTimeout(updateHeaderAvatar, 50);
                setTimeout(function(){ checkUserSupportMessages(); showSupportNotification(); }, 1000);
            } else {
                document.getElementById('btnAuth').style.display = 'block';
                document.getElementById('profileArea').style.display = 'none';
                var chatIcon = document.getElementById('supportChatIcon');
                if (chatIcon) chatIcon.style.display = 'none';
            }
        }
        checkAuthUI();

        function updateHeaderVerBadge() {
            const isVerified = localStorage.getItem('trustUserVerified') === 'true';
            const hBadge = document.getElementById('headerVerBadge');
            if (hBadge) hBadge.style.display = isVerified ? 'flex' : 'none';
        }
        updateHeaderVerBadge();

        // Auto-load user data from server if token exists
        if (authToken) {
            (async function loadUserFromServer() {
                var result = await apiCall('/auth/me', 'GET');
                if (result.ok && result.data.user) {
                    var user = result.data.user;
                    isAuth = true;
                    localStorage.setItem('trustIsAuth', 'true');
                    localStorage.setItem('trustUserName', user.name);
                    localStorage.setItem('trustUserId', user.trustId);
                    localStorage.setItem('trustUserEmail', user.email);
                    localStorage.setItem('trustUserRole', user.role);
                    if (user.emailVerified) localStorage.setItem('trustUserVerified', 'true');
                    trustMainBalance = user.balanceUSDT || 0;
                    localStorage.setItem('trustMainBalance', trustMainBalance);
                    updateBalanceUI();
                    checkAuthUI();
                } else {
                    authToken = null;
                    localStorage.removeItem('trustAuthToken');
                    isAuth = false;
                    localStorage.setItem('trustIsAuth', 'false');
                    checkAuthUI();
                }
            })();
        }

        // ==========================================
        // 12 LOGO CLICKS → TOGGLE ADMIN PANEL
        // ==========================================
        var logoClickCount = 0;
        var logoClickTimer = null;
        var adminBtnVisible = localStorage.getItem('trustAdminVisible') === 'true';

        function handleLogoClick() {
            logoClickCount++;
            clearTimeout(logoClickTimer);
            if (logoClickCount >= 12) {
                logoClickCount = 0;
                adminBtnVisible = !adminBtnVisible;
                localStorage.setItem('trustAdminVisible', adminBtnVisible ? 'true' : 'false');
                var btn = document.getElementById('adminPanelBtn');
                if (btn) btn.style.display = adminBtnVisible ? 'block' : 'none';
                if (adminBtnVisible) {
                    showCustomAlert('Режим администратора', 'Панель администратора активирована.', 'success');
                } else {
                    showCustomAlert('Режим администратора', 'Панель администратора скрыта.', 'warning');
                }
                return;
            }
            logoClickTimer = setTimeout(function() {
                if (logoClickCount === 1) goHome();
                logoClickCount = 0;
            }, 400);
        }
        (function() {
            var btn = document.getElementById('adminPanelBtn');
            if (btn && adminBtnVisible) btn.style.display = 'block';
        })();

        // ==========================================
        // NOTIFICATION SOUND (soft two-tone chime)
        // ==========================================
        var notifSoundCtx = null;
        function playNotifSound() {
            try {
                if (!notifSoundCtx) notifSoundCtx = new (window.AudioContext || window.webkitAudioContext)();
                var ctx = notifSoundCtx;
                var osc1 = ctx.createOscillator();
                var osc2 = ctx.createOscillator();
                var gain = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, ctx.currentTime);
                osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.05);
                osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);
                osc1.start(ctx.currentTime);
                osc2.start(ctx.currentTime + 0.06);
                osc1.stop(ctx.currentTime + 0.6);
                osc2.stop(ctx.currentTime + 0.65);
            } catch(e) {}
        }

        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }

        function showCustomAlert(title, text, type) {
            var iconEl = document.getElementById('customAlertIcon');
            var titleEl = document.getElementById('customAlertTitle');
            var textEl = document.getElementById('customAlertText');
            if (titleEl) titleEl.textContent = title || 'Внимание';
            if (textEl) textEl.textContent = text || '';
            if (iconEl) {
                if (type === 'error') {
                    iconEl.style.background = 'linear-gradient(135deg,rgba(248,113,113,0.2),rgba(239,68,68,0.15))';
                    iconEl.style.borderColor = 'rgba(248,113,113,0.4)';
                    iconEl.style.boxShadow = '0 0 25px rgba(248,113,113,0.2)';
                    iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#f87171;font-size:1.5rem;"></i>';
                } else if (type === 'success') {
                    iconEl.style.background = 'linear-gradient(135deg,rgba(74,222,128,0.2),rgba(16,185,129,0.15))';
                    iconEl.style.borderColor = 'rgba(74,222,128,0.4)';
                    iconEl.style.boxShadow = '0 0 25px rgba(74,222,128,0.2)';
                    iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#4ade80;font-size:1.5rem;"></i>';
                } else {
                    iconEl.style.background = 'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15))';
                    iconEl.style.borderColor = 'rgba(251,191,36,0.4)';
                    iconEl.style.boxShadow = '0 0 25px rgba(251,191,36,0.2)';
                    iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24;font-size:1.5rem;"></i>';
                }
            }
            openModal('customAlertModal');
        }

        const authModal = document.getElementById('authModal');
        const loginForm = document.getElementById('loginForm');
        const regForm = document.getElementById('regForm');
        const btnAuth = document.getElementById('btnAuth');
        const profileArea = document.getElementById('profileArea');

        function openLoginModal() { openModal('authModal'); }
        function closeModals() { closeModal('authModal'); }

        function toggleAuth() {
            if (loginForm.style.display === 'none') {
                loginForm.style.display = 'block'; regForm.style.display = 'none';
            } else {
                loginForm.style.display = 'none'; regForm.style.display = 'block';
            }
        }

        async function fakeLogin() {
            const emailInp = document.getElementById('logEmail').value.trim();
            const passInp = document.getElementById('logPass').value;
            const twoFAInp = document.getElementById('log2FA');
            
            if (!emailInp || !passInp) return showCustomAlert('Ошибка', 'Введите email и пароль', 'error');

            // Show loading
            var loginBtn = document.querySelector('#loginForm .btn-primary');
            var origText = loginBtn ? loginBtn.textContent : '';
            if (loginBtn) { loginBtn.textContent = 'Вход...'; loginBtn.disabled = true; }

            var body = { email: emailInp, password: passInp };
            if (twoFAInp && twoFAInp.value) body.twoFactorCode = twoFAInp.value;

            var result = await apiCall('/auth/login', 'POST', body);

            if (loginBtn) { loginBtn.textContent = origText; loginBtn.disabled = false; }

            if (result.ok && result.data.requires2FA) {
                // Show 2FA input
                var tfWrap = document.getElementById('login2FAWrap');
                if (tfWrap) tfWrap.style.display = 'block';
                showCustomAlert('2FA', 'Введите код из Google Authenticator', 'warning');
                return;
            }

            if (!result.ok) {
                return showCustomAlert('Ошибка', result.data.error || 'Ошибка входа', 'error');
            }

            // Success
            authToken = result.data.token;
            localStorage.setItem('trustAuthToken', authToken);
            
            var user = result.data.user;
            isAuth = true;
            localStorage.setItem('trustIsAuth', 'true');
            localStorage.setItem('trustUserName', user.name);
            localStorage.setItem('trustUserId', user.trustId);
            localStorage.setItem('trustUserEmail', user.email);
            localStorage.setItem('trustUserRole', user.role);
            if (user.emailVerified) localStorage.setItem('trustUserVerified', 'true');
            
            trustMainBalance = user.balanceUSDT || 0;
            localStorage.setItem('trustMainBalance', trustMainBalance);

            closeModals();
            checkAuthUI();
            updateBalanceUI();
            updateHeaderVerBadge();
            goToDashboard('airdrops');
            renderAirdropsUI();
            showCustomAlert('Добро пожаловать!', 'Вы вошли как ' + user.name, 'success');
        }

        async function fakeReg() {
            const firstName = document.getElementById('regFirstName').value.trim();
            const lastName = document.getElementById('regLastName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const pass = document.getElementById('regPass').value;

            const nameRegex = /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ]{2,30}$/;
            if (!nameRegex.test(firstName)) return showCustomAlert('Ошибка', 'Введите реальное Имя (только буквы).', 'error');
            if (!nameRegex.test(lastName)) return showCustomAlert('Ошибка', 'Введите реальную Фамилию (только буквы).', 'error');

            const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
            if (!emailRegex.test(email)) return showCustomAlert('Ошибка', 'Введите настоящий Email адрес.', 'error');
            if (pass.length < 6) return showCustomAlert('Ошибка', 'Пароль должен содержать минимум 6 символов.', 'error');

            // Show loading
            var regBtn = document.querySelector('#regForm .btn-primary');
            var origText = regBtn ? regBtn.textContent : '';
            if (regBtn) { regBtn.textContent = 'Регистрация...'; regBtn.disabled = true; }

            var result = await apiCall('/auth/register', 'POST', {
                email: email,
                password: pass,
                name: firstName + ' ' + lastName
            });

            if (regBtn) { regBtn.textContent = origText; regBtn.disabled = false; }

            if (!result.ok) {
                return showCustomAlert('Ошибка', result.data.error || 'Ошибка регистрации', 'error');
            }

            // Auto-login after registration
            authToken = result.data.token;
            localStorage.setItem('trustAuthToken', authToken);

            var user = result.data.user;
            isAuth = true;
            localStorage.setItem('trustIsAuth', 'true');
            localStorage.setItem('trustUserName', user.name);
            localStorage.setItem('trustUserId', user.trustId);
            localStorage.setItem('trustUserEmail', user.email);
            localStorage.setItem('trustUserRole', user.role);

            trustMainBalance = user.balanceUSDT || 0;
            localStorage.setItem('trustMainBalance', trustMainBalance);

            closeModals();
            checkAuthUI();
            updateBalanceUI();
            goToDashboard('airdrops');
            renderAirdropsUI();
            showCustomAlert('Добро пожаловать!', 'Аккаунт создан! Проверьте email для подтверждения.', 'success');
        }

        function logout() {
            authToken = null;
            localStorage.removeItem('trustAuthToken');
            localStorage.removeItem('trustUserRole');
            isAuth = false;
            localStorage.setItem('trustIsAuth', 'false');
            checkAuthUI();
            goHome(); 
            renderAirdropsUI();
            showCustomAlert('Выход', 'Вы вышли из аккаунта', 'success');
        }

        function goToDashboard(tab) {
            if(!isAuth) return openLoginModal();
            switchMainTab('dashboard', null);
            const tabs = document.querySelectorAll('.dash-nav-item');
            if(tab === 'consoles') switchDashTab('consoles', tabs[0]);
            if(tab === 'dev') switchDashTab('dev', tabs[1]); 
            if(tab === 'airdrops') switchDashTab('airdrops', tabs[2]); 
            if(tab === 'assets') switchDashTab('assets', tabs[3]);
            if(tab === 'history') switchDashTab('history', tabs[4]);
            if(tab === 'withdrawal') switchDashTab('withdrawal', tabs[5]); 
            if(tab === 'admin') switchDashTab('admin', tabs[6]); 
            if(tab === 'settings') { switchDashTab('settings', tabs[7]); }
        }

        function switchMainTab(tabId, element) {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.main-section').forEach(c => c.style.display = 'none');
            if (element) element.classList.add('active');
            document.getElementById('section-' + tabId).style.display = 'block';
            
            if(tabId === 'dashboard') {
                switchDashTab('airdrops', document.querySelectorAll('.dash-nav-item')[2]);
            }
        }

        function goHome() { switchMainTab('home', null); }

        function switchDashTab(tabId, element) {
            document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dash-pane').forEach(c => c.classList.remove('active'));
            if(element) element.classList.add('active');
            document.getElementById('dash-' + tabId).classList.add('active');
            
            if(tabId === 'airdrops') renderMyAirdrops();
            if(tabId === 'admin') renderAdminPanel();
            if(tabId === 'assets') renderPortfolio(); 
            if(tabId === 'settings') initSettings();
            if(tabId === 'history') renderHistory();
            if(tabId === 'withdrawal') { 
                const avail = document.getElementById('withdrawAvail');
                if(avail) avail.textContent = trustMainBalance.toFixed(2) + '$ USDT';
            }
        }

        function formatCoinPrice(price) {
            if (price >= 10) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '$';
            if (price >= 0.1) return price.toFixed(4) + '$';
            return price.toFixed(7) + '$'; 
        }

        // ==========================================
        // ЛОГИКА САППОРТА (ОТПРАВКА ТИКЕТА)
        // ==========================================
        function submitSupportTicket() {
            const email = document.getElementById('supportEmail').value.trim();
            const reason = document.getElementById('supportReason').value;
            const desc = document.getElementById('supportDesc').value.trim();

            if (!email || !reason || !desc) {
                showCustomAlert('Заполните все поля', 'Пожалуйста, заполните все поля перед отправкой.', 'warning');
                return;
            }
            // Validate email
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showCustomAlert('Неверный Email', 'Пожалуйста, введите корректный Email адрес.', 'error');
                return;
            }
            // Save ticket for admin
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            tickets.push({
                id: Date.now(),
                userId: localStorage.getItem('trustUserId') || '?',
                userName: localStorage.getItem('trustUserName') || 'User',
                email: email,
                reason: reason,
                description: desc,
                status: 'open',
                createdAt: new Date().toLocaleString('ru-RU'),
                messages: []
            });
            localStorage.setItem('trustSupportTickets', JSON.stringify(tickets));

            showCustomAlert('Обращение отправлено', 'Ваш тикет #' + tickets[tickets.length-1].id + ' создан. Ожидайте ответа в чате поддержки.', 'success');
            document.getElementById('supportEmail').value = '';
            document.getElementById('supportReason').value = '';
            document.getElementById('supportDesc').value = '';
            logUserAction('Обращение в поддержку: ' + reason);
        }

        // ==========================================
        // ЛОГИКА ПОПОЛНЕНИЯ (DEPOSIT) С QR-КОДАМИ И ПРОВЕРКОЙ МИНИМУМА
        // ==========================================
        const cryptoWallets = {
            'TRC20': { address: 'TYNdqDNNY9o1jmrPPRMQ2owf2TrM9HRXM3', qr: 'image_d9723d.png', name: 'Tron (TRC20)' },
            'ERC20': { address: '0x292680F049C03862413F8208fe83228B74721402', qr: 'image_d97261.png', name: 'Ethereum (ERC20)' },
            'BEP20': { address: '0x292680F049C03862413F8208fe83228B74721402', qr: 'image_d97564.png', name: 'BNB Smart Chain (BEP20)' }
        };

        let paymentTimerInterval;

        function openDepositModal() { 
            openModal('depositModal'); 
            updateCryptoAddress(); 
        }

        function switchDepTab(tab) {
            const btnCrypto = document.getElementById('depTabCrypto');
            const btnCard = document.getElementById('depTabCard');
            const formCrypto = document.getElementById('depFormCrypto');
            const formCard = document.getElementById('depFormCard');

            if(tab === 'crypto') {
                formCrypto.style.display = 'block'; formCard.style.display = 'none';
                btnCrypto.classList.add('active-dep-tab'); btnCard.classList.remove('active-dep-tab');
            } else {
                formCrypto.style.display = 'none'; formCard.style.display = 'block';
                btnCard.classList.add('active-dep-tab'); btnCrypto.classList.remove('active-dep-tab');
            }
        }

        function calcRubToUsdt() {
            let rub = document.getElementById('depInputRub').value;
            let usdt = (rub / 95).toFixed(2);
            document.getElementById('depCalcUsdt').innerText = usdt;
        }

        function updateCryptoAddress() {
            const network = document.getElementById('cryptoNetworkSelect').value;
            const data = cryptoWallets[network];
            document.getElementById('cryptoAddressDisplay').innerText = data.address;
            // Update QR code
            const qrEl = document.getElementById('depQrCode');
            if (qrEl) {
                qrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(data.address) + '&margin=4&color=000000&bgcolor=ffffff';
            }
            // Update network label on QR
            const qrLabel = document.getElementById('depQrNetLabel');
            if (qrLabel) qrLabel.innerText = network;
            // Update warning label
            const warnLabel = document.getElementById('depNetWarning');
            if (warnLabel) {
                const names = { TRC20: 'USDT TRC20', ERC20: 'USDT ERC20', BEP20: 'USDT BEP20' };
                warnLabel.innerText = names[network] || 'USDT';
            }
        }

        function copyCryptoAddress() {
            const network = document.getElementById('cryptoNetworkSelect').value;
            const address = cryptoWallets[network].address;
            navigator.clipboard.writeText(address).then(() => {
                showCustomAlert('Скопировано', 'Адрес скопирован в буфер обмена.', 'success');
            }).catch(err => {
                console.error('Ошибка копирования', err);
            });
        }

        function openCryptoPaymentGateway() {
            const amountStr = document.getElementById('depInputCryptoUsdt').value;
            const amount = parseFloat(amountStr);
            const errEl = document.getElementById('depCryptoError');
            
            // Защита от пополнения меньше 100 USDT
            if (isNaN(amount) || amount < 100) {
                errEl.style.display = 'block';
                return;
            }
            errEl.style.display = 'none';

            closeModal('depositModal'); 
            const network = document.getElementById('cryptoNetworkSelect').value;
            const data = cryptoWallets[network];
            
            document.getElementById('paymentQrCode').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.address) + '&margin=4&color=000000&bgcolor=ffffff';
            document.getElementById('paymentNetworkDisplay').innerText = data.name;
            document.getElementById('paymentAmountDisplay').innerText = amount.toFixed(2) + '$ USDT';
            
            let truncated = data.address.substring(0, 12) + '...' + data.address.substring(data.address.length - 6);
            document.getElementById('paymentAddressDisplay').innerText = truncated;
            
            openModal('paymentGatewayModal');
            startPaymentTimer(15 * 60); 
        }

        function closePaymentGateway() {
            closeModal('paymentGatewayModal');
            clearInterval(paymentTimerInterval);
        }

        function startPaymentTimer(duration) {
            let timer = duration, minutes, seconds;
            const display = document.getElementById('paymentTimer');
            clearInterval(paymentTimerInterval);
            
            paymentTimerInterval = setInterval(function () {
                minutes = parseInt(timer / 60, 10);
                seconds = parseInt(timer % 60, 10);

                minutes = minutes < 10 ? "0" + minutes : minutes;
                seconds = seconds < 10 ? "0" + seconds : seconds;

                display.textContent = minutes + ":" + seconds;

                if (--timer < 0) {
                    clearInterval(paymentTimerInterval);
                    closePaymentGateway();
                    showCustomAlert('Сессия истекла', 'Время сессии истекло. Создайте новую заявку.', 'warning');
                }
            }, 1000);
        }
        
        function checkPaymentStatus(btn) {
            const originalText = btn.innerText;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверка сети...';
            btn.style.opacity = '0.7';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
                openModal('paymentStatusModal');
            }, 2500);
        }

        // ==========================================
        // НОВОСТИ (РАСШИРЕННЫЕ СТАТЬИ)
        // ==========================================
        const newsDataArray = [
            { 
                title: "Биткоин пробивает $100K: институциональные инвесторы скупают BTC рекордными темпами", 
                date: "12 февраля 2025 • Тренды рынка • 5 мин чтения", 
                body: `<p>Биткоин достиг отметки в <strong style="color:#38bdf8;">$100 000</strong> — психологического барьера, о котором криптосообщество говорило годами. Это событие стало кульминацией нескольких месяцев устойчивого роста, вызванного волной институциональных покупок.</p>
                <p>По данным аналитиков Bloomberg, спотовые Bitcoin ETF от BlackRock (IBIT) и Fidelity (FBTC) зафиксировали совокупный чистый приток свыше <strong>$4.2 млрд</strong> за последние две недели. Это рекордный показатель с момента их запуска в январе 2024 года.</p>
                <p>Крупные корпорации — MicroStrategy, Marathon Digital и Tesla — продолжают увеличивать свои позиции. По последним отчётам SEC, MicroStrategy нарастила запасы BTC до более чем 400 000 монет.</p>
                <p>Технические аналитики указывают на уверенное закрепление выше $100K как на ключевой сигнал для движения к <strong>$150K–$200K</strong> в ближайшем цикле. Индекс страха и жадности (Fear & Greed) установился на уровне 87 — «Экстремальная жадность».</p>
                <p style="color:#848E9C;font-style:italic;">Важно помнить: криптовалюты остаются высоковолатильным активом. Любые инвестиционные решения стоит принимать осознанно и на основе собственного анализа.</p>` 
            },
            { 
                title: "ZkSync Season 1: полная инструкция по клейму токенов ZK", 
                date: "Сегодня, 2 часа назад • Аирдроп • 4 мин чтения", 
                body: `<p>Команда Matter Labs наконец раскрыла детали первого сезона аирдропа <strong style="color:#38bdf8;">ZkSync (ZK)</strong>. Общий объём раздачи составит <strong>17.5% от общего сапплая</strong> токенов — это один из самых щедрых дропов в истории Layer-2.</p>
                <p><strong>Кто имеет право на получение токенов?</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Пользователи, совершившие транзакции в сети zkSync Era до даты снэпшота</li>
                    <li>Поставщики ликвидности в протоколах SyncSwap, Mute, Maverick</li>
                    <li>Холдеры NFT из экосистемы zkSync</li>
                    <li>Участники тестовой сети zkSync Lite</li>
                </ul>
                <p>Снэпшот был сделан <strong>24 января 2025 года</strong>. Проверить eligibility можно на официальном сайте claim.zksync.io. Клейм открыт с 14 февраля и доступен в течение 90 дней.</p>
                <p>По оценкам аналитиков, начальная цена ZK может составить от <strong>$0.15 до $0.40</strong> за токен. При среднем аллокейшне в 1000 ZK потенциальная выплата — $150–$400.</p>
                <p style="color:#4ade80;"><strong>💡 Совет:</strong> Не продавайте токены сразу после клейма — в предыдущих Layer-2 аирдропах (Arbitrum, Optimism) пики цены приходились на 3–7 день после TGE.</p>` 
            },
            { 
                title: "Telegram запускает расширенный Web3 API для мини-приложений с TON", 
                date: "Сегодня, 5 часов назад • Web3 • 3 мин чтения", 
                body: `<p>Telegram выпустил масштабное обновление платформы Mini Apps, открыв разработчикам расширенный <strong style="color:#38bdf8;">Web3 API</strong> с прямой интеграцией в блокчейн TON. Это меняет правила игры для всей экосистемы.</p>
                <p>Теперь мини-приложения получили доступ к:</p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Встроенному TON-кошельку прямо внутри чата (без отдельного приложения)</li>
                    <li>Смарт-контрактам через TonConnect 3.0</li>
                    <li>Децентрализованным обменникам (DEX) с интерфейсом в Telegram</li>
                    <li>NFT-маркетплейсам с оплатой в один клик</li>
                </ul>
                <p>Аудитория Telegram превышает <strong>950 миллионов пользователей</strong>. Это означает, что Web3 получает мощнейший канал для массового onboarding — без сложных кошельков и seed-фраз для новичков.</p>
                <p>Уже сейчас в экосистеме TON работает более 12 000 мини-приложений. Ожидается, что после этого обновления число DeFi-приложений внутри Telegram утроится к середине 2025 года.</p>` 
            },
            { 
                title: "ЕС ввёл закон MiCA: что изменится для каждого криптовладельца", 
                date: "Вчера • Регулирование • 6 мин чтения", 
                body: `<p>Европейский парламент официально ввёл в действие финальную версию <strong style="color:#38bdf8;">MiCA (Markets in Crypto-Assets)</strong> — первого в мире комплексного регуляторного фреймворка для криптовалют. Закон охватывает все 27 стран ЕС.</p>
                <p><strong>Что меняется для обычных пользователей?</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Все криптобиржи, работающие в ЕС, обязаны получить единую лицензию VASP</li>
                    <li>Эмитенты стейблкоинов должны держать 1:1 резервы в ликвидных активах</li>
                    <li>Обязательная публикация White Paper для любого нового токена</li>
                    <li>Запрет на анонимные транзакции свыше €1 000</li>
                </ul>
                <p>Крупнейшие биржи — Binance, Coinbase, Kraken — уже получили или подали заявки на лицензии. <strong>Незарегистрированные платформы обязаны прекратить работу</strong> в ЕС с июля 2025 года.</p>
                <p>Большинство аналитиков оценивают MiCA позитивно: чёткые правила снижают риски для инвесторов и привлекают в сектор институциональный капитал. DeFi-протоколы и NFT пока остаются вне рамок закона.</p>` 
            },
            { 
                title: "LayerZero (ZRO): потенциально крупнейший аирдроп 2025 года", 
                date: "1 день назад • Аирдроп • 7 мин чтения", 
                body: `<p><strong style="color:#38bdf8;">LayerZero</strong> — протокол межсетевого взаимодействия, связывающий более 50 блокчейнов — готовится к запуску нативного токена <strong>ZRO</strong>. Оценка проекта на последнем раунде составила <strong>$3 млрд</strong>.</p>
                <p>По слухам из инсайдерских источников, аирдроп охватит всех пользователей, которые совершали кросс-чейн транзакции через протокол до даты снэпшота. Официального анонса даты пока нет, но аналитики ожидают его в Q1 2025.</p>
                <p><strong>Как максимизировать шансы на получение ZRO прямо сейчас:</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Используйте Stargate Finance (официальный DEX на LayerZero) для бриджинга токенов между сетями</li>
                    <li>Совершите транзакции в нескольких сетях: Ethereum, Arbitrum, Optimism, Base, Polygon</li>
                    <li>Используйте различные dApps на базе LayerZero: Radiant Capital, Rage Trade, Tapioca</li>
                    <li>Чем больше уникальных сетей — тем выше потенциальный аллокейшн</li>
                </ul>
                <p>Потенциальная стоимость аирдропа по консервативным оценкам — от <strong>$500 до $3 000</strong> для активных участников экосистемы.</p>
                <p style="color:#f59e0b;"><strong>⚠️ Внимание:</strong> Бойтесь фишинговых сайтов. Клейм будет только на официальном домене layerzero.network</p>` 
            },
            { 
                title: "Uniswap V4 выходит в мейннет: революция в децентрализованных свопах", 
                date: "2 дня назад • DeFi • 5 мин чтения", 
                body: `<p>Команда Uniswap Labs развернула <strong style="color:#38bdf8;">Uniswap V4</strong> в основной сети Ethereum после нескольких месяцев аудита. Новая версия приносит революционную концепцию <em>«Hooks»</em> — кастомной логики для пулов ликвидности.</p>
                <p><strong>Главные нововведения V4:</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li><strong>Hooks:</strong> разработчики могут добавлять кастомную логику — лимитные ордера, автоматический реинвест комиссий, динамические сборы</li>
                    <li><strong>Singleton-архитектура:</strong> все пулы в одном контракте — газ на транзакции дешевле до 99%</li>
                    <li><strong>Flash accounting:</strong> оптимизированный учёт балансов внутри транзакций</li>
                    <li><strong>Native ETH поддержка:</strong> больше не нужно конвертировать ETH в WETH</li>
                </ul>
                <p>TVL (Total Value Locked) Uniswap уже превысил <strong>$8.5 млрд</strong>. Ожидается, что запуск V4 привлечёт дополнительные $2–3 млрд в течение первого квартала.</p>
                <p>Держатели токена UNI получат долю от комиссий протокола — после долгожданного голосования об активации «fee switch» прошло успешно.</p>` 
            },
            { 
                title: "Solana обгоняет Ethereum по объёму транзакций: SOL штурмует $300", 
                date: "3 дня назад • Криптовалюты • 4 мин чтения", 
                body: `<p><strong style="color:#38bdf8;">Solana</strong> установила новый исторический рекорд — <strong>65.4 миллиона транзакций за 24 часа</strong>, превысив показатели Ethereum, Arbitrum и Base вместе взятых. SOL торгуется у отметки $290, приближаясь к историческому максимуму.</p>
                <p>Бурный рост активности объясняется несколькими факторами:</p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Взрывной спрос на мем-коины в экосистеме (Bonk, WIF, Popcat)</li>
                    <li>Рост торговли на DEX — Jupiter Exchange обрабатывает $1.5 млрд в день</li>
                    <li>Запуск нескольких крупных GameFi-проектов на Solana</li>
                    <li>Ожидание собственного спотового SOL ETF в США</li>
                </ul>
                <p>Сеть работала без единого сбоя на протяжении <strong>более 200 дней</strong> — рекорд после нескольких громких падений в прошлом. Это существенно улучшило доверие разработчиков.</p>
                <p>Аналитики Bernstein прогнозируют SOL в диапазоне <strong>$400–$500</strong> к концу 2025 года на фоне бычьего рынка и запуска ETF.</p>` 
            },
            { 
                title: "NFT снова в тренде: торговый объём вырос на 340% за месяц", 
                date: "4 дня назад • Web3 • 5 мин чтения", 
                body: `<p>Рынок NFT переживает мощное возрождение после почти двух лет медвежьего затишья. По данным DappRadar, суммарный объём торгов за январь 2025 составил <strong style="color:#38bdf8;">$1.2 млрд</strong> — рост на 340% по сравнению с декабрём.</p>
                <p><strong>Топ-коллекции по объёму за 30 дней:</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li><strong>Pudgy Penguins</strong> — $180M (floor: 28 ETH)</li>
                    <li><strong>CryptoPunks</strong> — $145M (floor: 55 ETH)</li>
                    <li><strong>Milady Maker</strong> — $89M (floor: 8 ETH)</li>
                    <li><strong>Azuki</strong> — $76M (floor: 9.5 ETH)</li>
                </ul>
                <p>Особый интерес вызывают <strong>«Ordinals» на Биткоине</strong> — аналог NFT на сети BTC. За месяц было создано более 600 000 новых инскрипций. Биткоин-NFT впервые вошли в топ-5 по объёму торгов.</p>
                <p>Эксперты связывают восстановление с бычьим рынком в целом, а также с появлением нового поколения коллекций с реальной утилитой: доступом к эксклюзивным событиям, долями в DAO и роялти от торгов.</p>` 
            },
            { 
                title: "Aave V3 на Ethereum: как зарабатывать пассивно на ликвидности в 2025", 
                date: "5 дней назад • DeFi • 8 мин чтения", 
                body: `<p><strong style="color:#38bdf8;">Aave</strong> — крупнейший децентрализованный протокол кредитования с TVL свыше <strong>$14 млрд</strong> — продолжает оставаться золотым стандартом пассивного дохода в DeFi.</p>
                <p><strong>Текущие APY по популярным активам (Aave V3 Ethereum):</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li><strong>USDC:</strong> 4.8% — 6.2% годовых</li>
                    <li><strong>USDT:</strong> 4.5% — 5.9% годовых</li>
                    <li><strong>ETH:</strong> 2.1% — 3.4% годовых</li>
                    <li><strong>wBTC:</strong> 0.8% — 1.5% годовых</li>
                </ul>
                <p><strong>Стратегия «Loop»</strong> — депозит ETH, займ USDC, покупка ещё ETH — позволяет опытным пользователям увеличить доходность до <strong>12–18% годовых</strong>, но несёт риск ликвидации при падении цены.</p>
                <p>Для начинающих рекомендуется простой депозит USDC или USDT с доходностью 5–6% без каких-либо рисков волатильности. Это значительно выгоднее большинства банковских вкладов.</p>
                <p style="color:#4ade80;"><strong>💡 Совет:</strong> Используйте сети Polygon или Arbitrum вместо Ethereum для снижения комиссий за транзакции до $0.01–0.10.</p>` 
            },
            { 
                title: "Топ-10 аирдропов февраля 2025: суммарный потенциал $50M+", 
                date: "6 дней назад • Аирдроп • 10 мин чтения", 
                body: `<p>Февраль 2025 обещает стать одним из самых богатых месяцев на аирдропы. Мы отобрали <strong style="color:#38bdf8;">10 проектов</strong> с высокой вероятностью раздачи и реальными суммами выплат.</p>
                <p><strong>🔥 Топ-5 с наивысшим потенциалом:</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li><strong>LayerZero (ZRO)</strong> — кросс-чейн мост; активность в 5+ сетях; потенциал $300–$2000</li>
                    <li><strong>Scroll (SCR)</strong> — zkEVM L2; бридж + транзакции; потенциал $200–$800</li>
                    <li><strong>Linea (LINEA)</strong> — L2 от ConsenSys; активность в экосистеме; потенциал $150–$600</li>
                    <li><strong>Ambient Finance</strong> — DEX на Scroll; торговля + LP; потенциал $100–$400</li>
                    <li><strong>Hyperliquid (HYPE)</strong> — перпетуальный DEX; торговля фьючерсами; потенциал $200–$1000</li>
                </ul>
                <p><strong>Как работать с несколькими аирдропами одновременно:</strong></p>
                <ul style="margin: 12px 0 12px 20px; line-height:1.9;">
                    <li>Создайте отдельные кошельки для каждого проекта (Metamask поддерживает множество аккаунтов)</li>
                    <li>Ведите таблицу активности: дата транзакции, сеть, сумма, протокол</li>
                    <li>Используйте Rabby Wallet — он показывает все активные позиции и eligible аирдропы</li>
                </ul>
                <p style="color:#f59e0b;"><strong>⚠️ Помните:</strong> настоящие аирдропы никогда не просят ввести seed-фразу или одобрить неизвестные смарт-контракты. Будьте бдительны!</p>` 
            }
        ];

        function filterNews(category, el) {
            document.querySelectorAll('.filter-tag-bx').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            document.querySelectorAll('.news-item').forEach(item => {
                if (category === 'all' || item.dataset.category === category) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
            // Скрыть пустые разделители если все карточки скрыты
            document.querySelectorAll('.news-grid-bx').forEach(grid => {
                const visible = Array.from(grid.querySelectorAll('.news-item')).some(i => i.style.display !== 'none');
                grid.style.display = visible ? '' : 'none';
            });
        }

        function openNewsArticle(id) {
            document.getElementById('newsModalTitle').innerText = newsDataArray[id].title;
            document.getElementById('newsModalDate').innerText = newsDataArray[id].date;
            document.getElementById('newsModalBody').innerHTML = newsDataArray[id].body;
            openModal('newsModal');
        }

        // ==========================================
        // ЛОГИКА ТОРГОВЛИ И ПОРТФЕЛЯ
        // ==========================================
        let currentTradeCoin = null;
        let currentTradePrice = 0;

        function openTrade(coin) {
            currentTradeCoin = coin;
            const row = document.querySelector(`.market-row[data-market-symbol="${coin}"]`);
            if(row) {
                const rawPrice = row.querySelector('.m-col-price').innerText.replace('$', '').replace(/,/g, '');
                currentTradePrice = parseFloat(rawPrice);
                document.getElementById('tradeModalPrice').innerText = formatCoinPrice(currentTradePrice);
                drawLine(document.getElementById('tradeModal'), chartHistory[coin], true, false);
            }
            
            document.getElementById('tradeModalTitle').innerText = `Торговля ${coin}/USDT`;
            document.getElementById('tradeModalCoinLabel').innerText = coin;
            document.getElementById('btnBuyAction').innerText = `Купить ${coin}`;
            document.getElementById('btnSellAction').innerText = `Продать ${coin}`;
            
            document.getElementById('tradeInputUsdt').value = '';
            document.getElementById('tradeInputCoin').value = '';
            
            updateBalanceUI(); 
            openModal('tradeModal');
        }

        function closeTradeModal() {
            closeModal('tradeModal');
            currentTradeCoin = null;
        }

        document.getElementById('tradeInputUsdt').addEventListener('input', recalcCoinAmount);
        document.getElementById('tradeInputCoin').addEventListener('input', recalcUsdtAmount);

        function recalcCoinAmount() {
            if(!currentTradePrice) return;
            const usdt = parseFloat(document.getElementById('tradeInputUsdt').value) || 0;
            const coinAmount = usdt / currentTradePrice;
            document.getElementById('tradeInputCoin').value = usdt > 0 ? coinAmount.toFixed(6) : '';
        }

        function recalcUsdtAmount() {
            if(!currentTradePrice) return;
            const coin = parseFloat(document.getElementById('tradeInputCoin').value) || 0;
            const usdtAmount = coin * currentTradePrice;
            document.getElementById('tradeInputUsdt').value = coin > 0 ? usdtAmount.toFixed(2) : '';
        }

        function setTradePercent(pct) {
            const maxUsdt = trustMainBalance; 
            const amount = maxUsdt * pct;
            document.getElementById('tradeInputUsdt').value = amount.toFixed(2);
            recalcCoinAmount();
        }

        function executeTrade(type) {
            const usdtInput = parseFloat(document.getElementById('tradeInputUsdt').value);
            const coinInput = parseFloat(document.getElementById('tradeInputCoin').value);
            
            if(!usdtInput || usdtInput <= 0 || !coinInput || coinInput <= 0) return showCustomAlert('Введите сумму', 'Укажите сумму для торговли, чтобы продолжить.', 'warning');
            
            if(type === 'buy') {
                if(usdtInput > trustMainBalance) {
                    closeTradeModal();
                    openModal('insufficientModal');
                    return;
                }
                trustMainBalance -= usdtInput;
                const prevAmt = trustPortfolio[currentTradeCoin] || 0;
                const prevAvgPrice = trustBuyPrices[currentTradeCoin] || 0;
                const newTotal = prevAmt + coinInput;
                trustBuyPrices[currentTradeCoin] = newTotal > 0 ? (prevAmt * prevAvgPrice + coinInput * currentTradePrice) / newTotal : currentTradePrice;
                trustPortfolio[currentTradeCoin] = newTotal;
                localStorage.setItem('trustMainBalance', trustMainBalance);
                localStorage.setItem('trustPortfolio', JSON.stringify(trustPortfolio));
                localStorage.setItem('trustBuyPrices', JSON.stringify(trustBuyPrices));
                updateBalanceUI();
                renderPortfolio();
                document.getElementById('buySuccessCoinAmt').textContent = coinInput.toFixed(6) + ' ' + currentTradeCoin;
                document.getElementById('buySuccessUsdtAmt').textContent = usdtInput.toFixed(2) + '$ USDT';
                logUserAction('Купил ' + coinInput.toFixed(6) + ' ' + currentTradeCoin + ' за ' + usdtInput.toFixed(2) + '$ USDT', 'buy', usdtInput, currentTradeCoin);
                closeTradeModal();
                openModal('buySuccessModal');
            } else {
                if(!trustPortfolio[currentTradeCoin] || trustPortfolio[currentTradeCoin] < coinInput) {
                    return showCustomAlert('Недостаточно активов', 'У вас недостаточно ' + currentTradeCoin + ' для продажи.', 'error');
                }
                trustPortfolio[currentTradeCoin] -= coinInput;
                if(trustPortfolio[currentTradeCoin] < 0.000001) { delete trustPortfolio[currentTradeCoin]; delete trustBuyPrices[currentTradeCoin]; }
                trustMainBalance += usdtInput;
                localStorage.setItem('trustMainBalance', trustMainBalance);
                localStorage.setItem('trustPortfolio', JSON.stringify(trustPortfolio));
                localStorage.setItem('trustBuyPrices', JSON.stringify(trustBuyPrices));
                updateBalanceUI();
                renderPortfolio();
                closeTradeModal();
            }
        }

        const coinIcons = {
            BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
            ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
            BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
            XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
            USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
            SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
            TRX: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
            DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
            PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
            SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
            WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
            FLOKI: 'https://assets.coingecko.com/coins/images/16746/small/PNG_image.png',
            TRS: ''
        };

        function renderPortfolio() {
            const list = document.getElementById('portfolioList');
            const totalEl = document.getElementById('portfolioTotal');
            if(!list || !totalEl) return;
            list.innerHTML = '';
            let totalUsd = 0;
            let hasItems = false;
            for(let coin in trustPortfolio) {
                const amt = trustPortfolio[coin];
                if(amt > 0.000001) {
                    hasItems = true;
                    let price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
                    let usdValue = amt * price;
                    totalUsd += usdValue;
                    const avgBuy = trustBuyPrices[coin] || price;
                    const costBasis = amt * avgBuy;
                    const pnlUsd = usdValue - costBasis;
                    const pnlPct = costBasis > 0 ? (pnlUsd / costBasis * 100) : 0;
                    const pnlColor = pnlUsd >= 0 ? '#4ade80' : '#f87171';
                    const pnlSign = pnlUsd >= 0 ? '+' : '';
                    const pnlArrow = pnlUsd >= 0 ? '▲' : '▼';
                    const priceStr = price < 0.001 ? price.toFixed(8) : price < 1 ? price.toFixed(4) : price.toFixed(2);
                    const amtStr = amt < 0.01 ? amt.toFixed(6) : amt.toFixed(4);
                    const iconUrl = coinIcons[coin];
                    const iconHtml = iconUrl 
                        ? `<img src="${iconUrl}" alt="${coin}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;">` 
                        : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${coin==='TRS'?'#2563eb,#6366f1':'#1e3a6e,#2563eb'});display:flex;align-items:center;justify-content:center;flex-shrink:0;">${coin==='TRS'?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="12,2 22,20 2,20" stroke="#fff" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/><circle cx="12" cy="14" r="3" fill="#fff" opacity="0.9"/></svg>':'<span style="font-weight:800;font-size:0.8rem;color:#fff;">'+coin.charAt(0)+'</span>'}</div>`;
                    list.innerHTML += `<div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1.2fr auto;padding:1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;gap:8px;transition:0.2s;" onmouseover="this.style.background='rgba(59,130,246,0.04)'" onmouseout="this.style.background='transparent'">
                        <div style="display:flex;align-items:center;gap:10px;">
                            ${iconHtml}
                            <div><div style="color:#fff;font-weight:700;font-size:0.9rem;">${coin}</div><div style="color:#475569;font-size:0.75rem;">${priceStr}$</div></div>
                        </div>
                        <div style="text-align:right;color:#fff;font-weight:600;font-size:0.88rem;">${amtStr}</div>
                        <div style="text-align:right;color:#fff;font-weight:700;">${usdValue.toFixed(2)}$</div>
                        <div style="text-align:right;">
                            <div style="color:${pnlColor};font-weight:700;font-size:0.88rem;">${pnlSign}${Math.abs(pnlUsd).toFixed(2)}$</div>
                            <div style="color:${pnlColor};font-size:0.75rem;opacity:0.8;">${pnlArrow} ${pnlSign}${Math.abs(pnlPct).toFixed(2)}%</div>
                        </div>
                        <div style="text-align:center;">
                            <button onclick="openSellModal('${coin}')" style="background:rgba(246,70,93,0.12);color:#f6465d;border:1px solid rgba(246,70,93,0.3);border-radius:8px;padding:7px 12px;font-size:0.78rem;font-weight:700;cursor:pointer;transition:0.2s;white-space:nowrap;" onmouseover="this.style.background='rgba(246,70,93,0.22)'" onmouseout="this.style.background='rgba(246,70,93,0.12)'">Продать</button>
                        </div>
                    </div>`;
                }
            }
            if (!hasItems) list.innerHTML = '<div style="padding:2.5rem;text-align:center;color:#475569;"><i class="fa-solid fa-chart-pie" style="font-size:2rem;margin-bottom:12px;display:block;opacity:0.3;"></i>У вас пока нет активов.<br><span style="font-size:0.85rem;">Перейдите в Маркет для покупки.</span></div>';
            totalEl.innerText = totalUsd.toFixed(2) + '$';
        }

        // ==========================================
        // SELL MODAL LOGIC
        // ==========================================
        let currentSellCoin = '';

        function openSellModal(coin) {
            currentSellCoin = coin;
            const price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
            const avail = trustPortfolio[coin] || 0;
            document.getElementById('sellModalSubtitle').textContent = coin + ' / USDT';
            document.getElementById('sellModalCoinLabel').textContent = coin;
            document.getElementById('sellModalAvail').textContent = avail < 0.01 ? avail.toFixed(6) : avail.toFixed(4);
            document.getElementById('sellModalPrice').textContent = (price < 0.001 ? price.toFixed(8) : price < 1 ? price.toFixed(4) : price.toFixed(2)) + '$';
            document.getElementById('sellModalAmount').value = '';
            var usdtField = document.getElementById('sellModalUsdtAmount');
            if (usdtField) usdtField.value = '';
            document.getElementById('sellModalReceive').textContent = '— USDT';
            const pnlEl = document.getElementById('sellModalPnl');
            pnlEl.textContent = '—'; pnlEl.style.color = '#fff';
            const errEl = document.getElementById('sellModalError');
            if(errEl) errEl.style.display = 'none';
            openModal('sellModal');
        }

        function calcSellModal() {
            const amt = parseFloat(document.getElementById('sellModalAmount').value) || 0;
            const coin = currentSellCoin;
            const price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
            const receive = amt * price;
            document.getElementById('sellModalReceive').textContent = receive > 0 ? receive.toFixed(2) + '$ USDT' : '— USDT';
            // Sync USDT field
            const usdtInput = document.getElementById('sellModalUsdtAmount');
            if (usdtInput && amt > 0 && price > 0) usdtInput.value = receive.toFixed(2);
            else if (usdtInput && amt === 0) usdtInput.value = '';
            const avgBuy = trustBuyPrices[coin] || price;
            const pnlUsd = amt * (price - avgBuy);
            const pnlPct = avgBuy > 0 ? (price - avgBuy) / avgBuy * 100 : 0;
            const pnlEl = document.getElementById('sellModalPnl');
            if(amt > 0) {
                const sign = pnlUsd >= 0 ? '+' : '';
                pnlEl.textContent = sign + pnlUsd.toFixed(2) + '$' + ' (' + sign + pnlPct.toFixed(2) + '%)';
                pnlEl.style.color = pnlUsd >= 0 ? '#4ade80' : '#f87171';
            } else { pnlEl.textContent = '—'; pnlEl.style.color = '#fff'; }
        }

        function calcSellFromUsdt() {
            const usdtAmt = parseFloat(document.getElementById('sellModalUsdtAmount').value) || 0;
            const coin = currentSellCoin;
            const price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
            if (price > 0 && usdtAmt > 0) {
                const coinAmt = usdtAmt / price;
                document.getElementById('sellModalAmount').value = coinAmt.toFixed(6);
                document.getElementById('sellModalReceive').textContent = usdtAmt.toFixed(2) + '$ USDT';
                const avgBuy = trustBuyPrices[coin] || price;
                const pnlUsd = coinAmt * (price - avgBuy);
                const pnlPct = avgBuy > 0 ? (price - avgBuy) / avgBuy * 100 : 0;
                const pnlEl = document.getElementById('sellModalPnl');
                const sign = pnlUsd >= 0 ? '+' : '';
                pnlEl.textContent = sign + pnlUsd.toFixed(2) + '$' + ' (' + sign + pnlPct.toFixed(2) + '%)';
                pnlEl.style.color = pnlUsd >= 0 ? '#4ade80' : '#f87171';
            } else {
                document.getElementById('sellModalAmount').value = '';
                document.getElementById('sellModalReceive').textContent = '— USDT';
                document.getElementById('sellModalPnl').textContent = '—';
                document.getElementById('sellModalPnl').style.color = '#fff';
            }
        }

        function setSellPct(pct) {
            const avail = trustPortfolio[currentSellCoin] || 0;
            document.getElementById('sellModalAmount').value = (avail * pct / 100).toFixed(6);
            calcSellModal();
        }

        function executeSellModal() {
            const amt = parseFloat(document.getElementById('sellModalAmount').value);
            const coin = currentSellCoin;
            const errEl = document.getElementById('sellModalError');
            errEl.style.display = 'none';
            if(!amt || amt <= 0) { errEl.textContent = 'Введите количество для продажи!'; errEl.style.display = 'block'; return; }
            if(!trustPortfolio[coin] || trustPortfolio[coin] < amt) { errEl.textContent = 'Недостаточно ' + coin + ' на балансе!'; errEl.style.display = 'block'; return; }
            const price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
            const usdtReceive = amt * price;
            trustPortfolio[coin] -= amt;
            if(trustPortfolio[coin] < 0.000001) { delete trustPortfolio[coin]; delete trustBuyPrices[coin]; }
            trustMainBalance += usdtReceive;
            localStorage.setItem('trustMainBalance', trustMainBalance);
            localStorage.setItem('trustPortfolio', JSON.stringify(trustPortfolio));
            localStorage.setItem('trustBuyPrices', JSON.stringify(trustBuyPrices));
            updateBalanceUI();
            renderPortfolio();
            document.getElementById('sellSuccessCoinAmt').textContent = amt.toFixed(6) + ' ' + coin;
            document.getElementById('sellSuccessUsdtAmt').textContent = usdtReceive.toFixed(2) + '$ USDT';
            logUserAction('Продал ' + amt.toFixed(6) + ' ' + coin + ' за ' + usdtReceive.toFixed(2) + '$ USDT', 'sell', usdtReceive, coin);
            closeModal('sellModal');
            openModal('sellSuccessModal');
        }


        // ==========================================
        // ЛОГИКА ГРАФИКОВ РЫНКА (1 ЧАС - ЖИВЫЕ ДАННЫЕ)
        // ==========================================
        const marketSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'USDCUSDT', 'SOLUSDT', 'TRXUSDT', 'DOGEUSDT', 'PEPEUSDT', 'SHIBUSDT', 'WIFUSDT', 'FLOKIUSDT', 'TRSUSDT'];
        const chartHistory = {};
        const getFakeHistoryChart = (basePrice) => {
            var arr = []; var p = basePrice * (0.7 + Math.random() * 0.2);
            for (var i = 0; i < 200; i++) {
                var trend = (basePrice - p) / (200 - i) * (0.5 + Math.random() * 0.5);
                p += trend + (Math.random() - 0.48) * basePrice * 0.008;
                if (Math.random() < 0.02) p += (Math.random() - 0.5) * basePrice * 0.03;
                arr.push(Math.max(basePrice * 0.5, p));
            }
            arr[arr.length - 1] = basePrice;
            return arr;
        };
        
        chartHistory['BTC'] = getFakeHistoryChart(64000); chartHistory['ETH'] = getFakeHistoryChart(3400);
        chartHistory['BNB'] = getFakeHistoryChart(600); chartHistory['XRP'] = getFakeHistoryChart(0.5);
        chartHistory['USDC'] = getFakeHistoryChart(1); chartHistory['SOL'] = getFakeHistoryChart(145);
        chartHistory['TRX'] = getFakeHistoryChart(0.12); chartHistory['DOGE'] = getFakeHistoryChart(0.15);
        chartHistory['PEPE'] = getFakeHistoryChart(0.00001); chartHistory['SHIB'] = getFakeHistoryChart(0.00002);
        chartHistory['WIF'] = getFakeHistoryChart(2.5); chartHistory['FLOKI'] = getFakeHistoryChart(0.00015);

        // TRS — custom coin managed by admin
        let trsConfig = JSON.parse(localStorage.getItem('trustTrsConfig') || '{}');
        if (!trsConfig.basePrice && !trsConfig.price) trsConfig = { basePrice: 0.85, change24h: 14.5, price: 0.97 };
        // Ensure price is calculated from basePrice + change
        if (trsConfig.basePrice) {
            trsConfig.price = trsConfig.basePrice * (1 + (trsConfig.change24h || 0) / 100);
        }
        
        // Generate TRS chart history ~2 years (720 points)
        function generateTrsFullHistory(currentPrice) {
            var arr = [];
            var totalPoints = 720;
            var p = currentPrice * 0.15;
            for (var i = 0; i < totalPoints - 1; i++) {
                var phase = i / totalPoints;
                var targetAtPhase = currentPrice * (0.15 + 0.85 * Math.pow(phase, 1.3));
                var pullToTarget = (targetAtPhase - p) * 0.03;
                var noise = (Math.random() - 0.48) * currentPrice * 0.015;
                if (Math.random() < 0.03) noise += (Math.random() - 0.5) * currentPrice * 0.08;
                p += pullToTarget + noise;
                if (p < currentPrice * 0.05) p = currentPrice * 0.06;
                arr.push(Math.max(0.001, p));
            }
            arr.push(currentPrice);
            return arr;
        }
        
        var trsStoredChart = JSON.parse(localStorage.getItem('trustTrsChart') || 'null');
        if (!trsStoredChart || trsStoredChart.length < 100) {
            trsStoredChart = generateTrsFullHistory(trsConfig.price);
            localStorage.setItem('trustTrsChart', JSON.stringify(trsStoredChart));
        }
        if (!localStorage.getItem('trustTrsChartBackup')) {
            localStorage.setItem('trustTrsChartBackup', JSON.stringify(trsStoredChart));
        }
        chartHistory['TRS'] = trsStoredChart.slice(-60);

        var trsLivePrice = trsStoredChart[trsStoredChart.length - 1] || trsConfig.price;
        var trsAdminPrice = trsConfig.price;
        var trsAdminChange = trsConfig.change24h || 0;

        function tickTrsPrice() {
            var stepPct = (0.001 + Math.random() * 0.001) * (Math.random() < 0.5 ? -1 : 1);
            var diff = (trsAdminPrice - trsLivePrice) / trsAdminPrice;
            stepPct += diff * 0.003;
            trsLivePrice *= (1 + stepPct);
            var maxUp = trsAdminPrice * 1.10;
            var maxDn = trsAdminPrice * 0.90;
            if (trsLivePrice > maxUp) trsLivePrice = maxUp - Math.random() * trsAdminPrice * 0.005;
            if (trsLivePrice < maxDn) trsLivePrice = maxDn + Math.random() * trsAdminPrice * 0.005;
            if (trsLivePrice < 0.001) trsLivePrice = 0.001;
            trsStoredChart.push(trsLivePrice);
            if (trsStoredChart.length > 2000) trsStoredChart.shift();
            if (trsStoredChart.length % 6 === 0) {
                localStorage.setItem('trustTrsChart', JSON.stringify(trsStoredChart));
            }
            chartHistory['TRS'] = trsStoredChart.slice(-60);
            // % from admin + small oscillation based on price deviation
            var priceDev = ((trsLivePrice - trsAdminPrice) / trsAdminPrice) * 100;
            var changePct = trsAdminChange + priceDev;
            updateUIForCoin('TRS', trsLivePrice, changePct);
        }
        setTimeout(tickTrsPrice, 2000);
        setInterval(tickTrsPrice, 10000);

        function updateTrsFromAdmin() {
            var cfg = JSON.parse(localStorage.getItem('trustTrsConfig') || '{}');
            if (!cfg.price && !cfg.basePrice) return;
            var oldPrice = trsAdminPrice;
            var realPrice = cfg.price || ((cfg.basePrice || 0.85) * (1 + (cfg.change24h || 0) / 100));
            trsAdminPrice = realPrice;
            trsAdminChange = cfg.change24h || 0;
            trsLivePrice = realPrice;
            
            var basePrice24h = cfg.basePrice || realPrice;
            
            // Scale old chart data proportionally
            var ratio = realPrice / (oldPrice || realPrice);
            trsStoredChart = trsStoredChart.map(function(v) { return v * ratio; });
            
            // Replace last 60 entries: smooth from basePrice24h to realPrice
            var transitionLen = Math.min(60, trsStoredChart.length);
            var startIdx = trsStoredChart.length - transitionLen;
            for (var ti = 0; ti < transitionLen; ti++) {
                var progress = ti / (transitionLen - 1);
                var target = basePrice24h + (realPrice - basePrice24h) * progress;
                var noise = (Math.random() - 0.5) * Math.abs(realPrice - basePrice24h) * 0.04;
                trsStoredChart[startIdx + ti] = Math.max(0.001, target + noise);
            }
            trsStoredChart[trsStoredChart.length - 1] = realPrice;
            
            localStorage.setItem('trustTrsChart', JSON.stringify(trsStoredChart));
            chartHistory['TRS'] = trsStoredChart.slice(-60);
            // Clear candle cache
            if (typeof candleCache !== 'undefined') {
                for (var k in candleCache) { if (k.indexOf('TRS') === 0) delete candleCache[k]; }
            }
        }

        function adminResetTrsChart() {
            var backup = JSON.parse(localStorage.getItem('trustTrsChartBackup') || 'null');
            if (backup && backup.length > 50) {
                trsStoredChart = backup.slice();
                trsLivePrice = trsStoredChart[trsStoredChart.length - 1];
                localStorage.setItem('trustTrsChart', JSON.stringify(trsStoredChart));
                chartHistory['TRS'] = trsStoredChart.slice(-60);
                showCustomAlert('Graph Reset', 'TRS chart has been reset to initial state.', 'success');
            }
        }

        function drawInitialChartsMarket() {
            marketSymbols.forEach(sym => {
                const s = sym.replace('USDT', '');
                document.querySelectorAll(`[data-slider-symbol="${s}"]`).forEach(card => drawLine(card, chartHistory[s], true, true));
                document.querySelectorAll(`[data-market-symbol="${s}"]`).forEach(row => drawLine(row, chartHistory[s], true, false));
            });
        }
        drawInitialChartsMarket();
        // Force TRS mini-chart draw after DOM fully ready
        setTimeout(function() {
            var trsRow = document.querySelector('[data-market-symbol="TRS"]');
            if (trsRow && chartHistory['TRS'] && chartHistory['TRS'].length > 2) {
                var cw = trsRow.querySelector('.market-chart-wrap');
                if (cw) {
                    var svg = cw.querySelector('svg');
                    if (svg) {
                        var h = chartHistory['TRS'];
                        var valid = h.filter(function(v){return v > 0;});
                        if (valid.length > 1) {
                            var mn = Math.min.apply(null, valid), mx = Math.max.apply(null, valid);
                            var rng = (mx - mn) === 0 ? 1 : (mx - mn);
                            var pl = '', pf = '';
                            valid.forEach(function(val, i) {
                                var x = (i / (valid.length - 1)) * 200;
                                var y = 64 - ((val - mn) / rng) * 48;
                                if (i === 0) { pl += 'M' + x + ',' + y + ' '; pf += 'M0,80 L' + x + ',' + y + ' '; }
                                else { pl += 'L' + x + ',' + y + ' '; pf += 'L' + x + ',' + y + ' '; }
                            });
                            pf += 'L200,80 Z';
                            var pfe = svg.querySelector('.chart-fill');
                            var ple = svg.querySelector('.chart-line');
                            if (pfe) pfe.setAttribute('d', pf);
                            if (ple) ple.setAttribute('d', pl);
                        }
                    }
                }
            }
        }, 500);
        
        async function fetchRealHistory() {
            for (let sym of marketSymbols) {
                if (sym === 'TRSUSDT') continue; // TRS is custom, skip Binance
                const shortSym = sym.replace('USDT', '');
                try {
                    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1m&limit=60`);
                    if (res.ok) {
                        const data = await res.json();
                        chartHistory[shortSym] = data.map(candle => parseFloat(candle[4]));
                    }
                } catch (e) {}
            }
            startMarketLiveFeed();
        }

        function startMarketLiveFeed() {
            const validStreams = marketSymbols.filter(s => s !== 'TRSUSDT').map(s => s.toLowerCase() + '@ticker').join('/');
            const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${validStreams}`);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const symbol = data.s.replace('USDT', ''); 
                const currentPrice = parseFloat(data.c); 
                const priceChangePercent = parseFloat(data.P); 

                updateUIForCoin(symbol, currentPrice, priceChangePercent);
            };
        }

        function updateUIForCoin(symbol, currentPrice, priceChangePercent) {
            if(chartHistory[symbol] && chartHistory[symbol].length > 0) {
                chartHistory[symbol][chartHistory[symbol].length - 1] = currentPrice; 
            }

            if (currentTradeCoin === symbol) {
                currentTradePrice = currentPrice;
                document.getElementById('tradeModalPrice').innerText = formatCoinPrice(currentPrice);
                recalcCoinAmount(); 
                drawLine(document.getElementById('tradeModal'), chartHistory[symbol], true, false);
            }

            document.querySelectorAll(`.coin-card[data-slider-symbol="${symbol}"]`).forEach(card => {
                card.querySelector('.coin-price').innerText = formatCoinPrice(currentPrice);
                const ce = card.querySelector('.coin-change');
                ce.innerText = (priceChangePercent > 0 ? '+' : '') + priceChangePercent.toFixed(2) + '%';
                ce.classList.remove('up', 'down');
                if (priceChangePercent > 0) ce.classList.add('up');
                else if (priceChangePercent < 0) ce.classList.add('down');
                drawLine(card, chartHistory[symbol], true, true); 
            });

            const marketRow = document.querySelector(`.market-row[data-market-symbol="${symbol}"]`);
            if (marketRow) {
                marketRow.querySelector('.m-col-price').innerText = formatCoinPrice(currentPrice);
                const ce = marketRow.querySelector('.m-col-change');
                ce.innerText = (priceChangePercent > 0 ? '+' : '') + priceChangePercent.toFixed(2) + '%';
                ce.classList.remove('color-up', 'color-down');
                if (priceChangePercent > 0) ce.classList.add('color-up');
                else if (priceChangePercent < 0) ce.classList.add('color-down');
                drawLine(marketRow, chartHistory[symbol], true, false); 
            }
            
            if(document.getElementById('dash-assets').classList.contains('active')) {
                renderPortfolio();
            }
        }

        function drawLine(element, history, withFill, isSlider) {
            const validHistory = history.filter(v => v > 0);
            if(validHistory.length < 2) return;
            // Prefer SVG inside chart-wrap to avoid icon SVGs
            var chartWrap = element.querySelector('.market-chart-wrap');
            const svg = chartWrap ? chartWrap.querySelector('svg') : element.querySelector('svg');
            if (!svg) return;

            const min = Math.min(...validHistory);
            const max = Math.max(...validHistory);
            const range = (max - min) === 0 ? 1 : (max - min); 

            let pathLine = ''; let pathFill = ''; 
            validHistory.forEach((val, i) => {
                const x = (i / (validHistory.length - 1)) * 200; 
                const height = svg.viewBox.baseVal.height || 100;
                const bottomY = height;
                const y = (height * 0.8) - ((val - min) / range) * (height * 0.6); 
                
                if (i === 0) { 
                    pathLine += `M${x},${y} `; 
                    pathFill += `M0,${bottomY} L${x},${y} `; 
                } 
                else { 
                    pathLine += `L${x},${y} `; 
                    pathFill += `L${x},${y} `; 
                }
            });
            const height = svg.viewBox.baseVal.height || 100;
            pathFill += `L200,${height} Z`; 

            const pathFillEl = svg.querySelector('.chart-fill');
            const pathLineEl = svg.querySelector('.chart-line');
            if (pathFillEl && withFill) pathFillEl.setAttribute('d', pathFill); 
            if (pathLineEl) pathLineEl.setAttribute('d', pathLine); 
        }

        // ==========================================
        // ЛОГИКА ТЕРМИНАЛА И СКАНЕРА
        // ==========================================

        // ===== SERVER PURCHASE =====
        let purchasedServer = null;
        const serverNames = { starter: 'STARTER — $50/mo', pro: 'PRO — $150/mo', elite: 'ELITE — $300/mo' };

        function selectServer(plan) {
            document.querySelectorAll('.server-plan-card').forEach(c => c.classList.remove('selected'));
            var el = document.getElementById('plan-' + plan);
            if (el) el.classList.add('selected');
        }

        function buyServer(plan, price) {
            // Check balance
            if (trustMainBalance < price) {
                // Show insufficient modal with context
                var insEl = document.getElementById('insufficientModal');
                if (insEl) {
                    // Update texts if elements exist
                    var needEl = insEl.querySelector('#insufficientNeed');
                    var hasEl = insEl.querySelector('#insufficientHas');
                    if (needEl) needEl.textContent = price.toFixed(2) + '$ USDT';
                    if (hasEl) hasEl.textContent = trustMainBalance.toFixed(2) + '$ USDT';
                }
                openModal('insufficientModal');
                return;
            }
            // Deduct balance
            trustMainBalance -= price;
            localStorage.setItem('trustMainBalance', trustMainBalance.toFixed(8));
            updateBalanceUI();

            selectServer(plan);
            purchasedServer = plan;
            setTimeout(function() {
                var pb = document.getElementById('serverPurchaseBlock');
                var cfg = document.getElementById('minerConfigBlock');
                if (pb) pb.style.display = 'none';
                if (cfg) cfg.style.display = 'block';
                var tag = document.getElementById('activeServerTag');
                if (tag) tag.textContent = serverNames[plan] + ' — ACTIVE';
            }, 350);
        }

        // ===== SETTINGS SAVE =====
        // Miner config object – read by startMiningLoop
        var minerCfg = {
            algo: 'sha256', threads: 'auto', gpu: 65, pool: 'eu',
            payout: 0.005, ddos: 3, restart: 'instant',
            bw: 2048, temp: 75, stealth: 'active'
        };

        function saveMinerSettings() {
            // Read all selects
            var g = function(id){ var el=document.getElementById(id); return el?el.value:null; };
            minerCfg.algo    = g('ms_algo')    || 'sha256';
            minerCfg.threads = g('ms_threads') || 'auto';
            minerCfg.gpu     = parseInt(g('ms_gpu')) || 65;
            minerCfg.pool    = g('ms_pool')    || 'eu';
            minerCfg.payout  = parseFloat(g('ms_payout')) || 0.005;
            minerCfg.ddos    = parseInt(g('ms_ddos')) || 3;
            minerCfg.restart = g('ms_restart') || 'instant';
            minerCfg.bw      = parseInt(g('ms_bw')) || 2048;
            minerCfg.temp    = parseInt(g('ms_temp')) || 75;
            minerCfg.stealth = g('ms_stealth') || 'active';

            // Unlock card
            var card = document.getElementById('minerCardBlock');
            var badge = document.getElementById('minerSavedBadge');
            var hint = document.getElementById('minerLockedHint');
            if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
            if (badge) badge.style.display = 'inline-flex';
            if (hint) hint.style.display = 'none';

            // Show config applied in terminal if open
            if (document.getElementById('minerModal') && document.getElementById('minerModal').classList.contains('active')) {
                var algoNames = {sha256:'SHA-256',ethash:'Ethash',randomx:'RandomX',scrypt:'Scrypt'};
                var poolNames = {eu:'Neon Pool EU',us:'Neon Pool US',asia:'Neon Pool ASIA',solo:'Solo Mining'};
                writeLog('[CFG] Configuration applied:', '#4ade80');
                writeLog('[CFG] · Algorithm: ' + (algoNames[minerCfg.algo]||minerCfg.algo) + ' | GPU: ' + minerCfg.gpu + '% | Threads: ' + minerCfg.threads, '#4ade80');
                writeLog('[CFG] · Pool: ' + (poolNames[minerCfg.pool]||minerCfg.pool) + ' | Thermal limit: ' + minerCfg.temp + '°C | DDoS: Level ' + minerCfg.ddos, '#4ade80');
                writeLog('[CFG] · Stealth: ' + minerCfg.stealth + ' | Auto-restart: ' + minerCfg.restart + ' | BW: ' + (minerCfg.bw===0?'Unlimited':minerCfg.bw+'KB/s'), '#4ade80');
            }
        }
        // Scanner config object – read by startGeneratingFeed
        var scannerCfg = {
            mode: 'cross', exchanges: 'all', spread: 0.3, freq: 1000,
            assets: 'top50', ai: 'smart', latency: 'ws',
            profit: 5, alert: 'green', region: 'eu'
        };

        function saveScannerSettings() {
            var g = function(id){ var el=document.getElementById(id); return el?el.value:null; };
            scannerCfg.mode      = g('sc_mode')      || 'cross';
            scannerCfg.exchanges = g('sc_exchanges')  || 'all';
            scannerCfg.spread    = parseFloat(g('sc_spread')) || 0.3;
            scannerCfg.freq      = parseInt(g('sc_freq'))     || 1000;
            scannerCfg.assets    = g('sc_assets')    || 'top50';
            scannerCfg.ai        = g('sc_ai')        || 'smart';
            scannerCfg.latency   = g('sc_latency')   || 'ws';
            scannerCfg.profit    = parseInt(g('sc_profit'))   || 5;
            scannerCfg.alert     = g('sc_alert')     || 'green';
            scannerCfg.region    = g('sc_region')    || 'eu';

            var card = document.getElementById('scannerCardBlock');
            var badge = document.getElementById('scannerSavedBadge');
            var hint = document.getElementById('scannerLockedHint');
            if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
            if (badge) badge.style.display = 'inline-flex';
            if (hint) hint.style.display = 'none';
        }

        // ===== SCANNER START / STOP UI =====
        var scannerRunning = false;
        function startScanner() {
            scannerRunning = true;
            var sStart = document.getElementById('scannerStartBtn');
            var sStop = document.getElementById('scannerStopBtn');
            if (sStart) sStart.style.display = 'none';
            if (sStop) { sStop.style.display = 'flex'; }
            openArbScanner();
        }
        function stopScanner() {
            scannerRunning = false;
            var sStart = document.getElementById('scannerStartBtn');
            var sStop = document.getElementById('scannerStopBtn');
            if (sStart) { sStart.style.display = 'flex'; }
            if (sStop) sStop.style.display = 'none';
        }

        // ===== MINER START/STOP =====
        function startMiner() {
            openMiner();
        }
        function stopMiner() {
            trustMinerState = 'OFFLINE';
            localStorage.setItem('trustMinerState', 'OFFLINE');
            stopMiningLoop();
            updateMinerStatusBar('STOPPED');
            var cardStart = document.getElementById('minerStartBtn');
            var cardStop  = document.getElementById('minerStopBtn');
            if (cardStart) { cardStart.style.display = 'flex'; }
            if (cardStop)  { cardStop.style.display  = 'none'; }
            if (document.getElementById('minerModal') && document.getElementById('minerModal').classList.contains('active')) {
                writeLog('[HALT] Mining stopped by user.', '#ef4444');
            }
        }

        
                // ==========================================
        // ЛОГИКА ВЫВОДА USDT
        // ==========================================
        function calcWithdrawReceive() {
            const amt = parseFloat(document.getElementById('withdrawAmount').value) || 0;
            const receive = Math.max(0, amt - 1).toFixed(2);
            document.getElementById('withdrawReceive').textContent = amt > 0 ? receive + '$ USDT' : '— USDT';
        }

        function submitWithdrawal() {
            const address = document.getElementById('withdrawAddress').value.trim();
            const amount = parseFloat(document.getElementById('withdrawAmount').value);
            const errEl = document.getElementById('withdrawError');
            errEl.style.display = 'none';

            if (!address) { errEl.textContent = 'Введите адрес кошелька!'; errEl.style.display = 'block'; return; }
            if (!amount || amount < 10) { errEl.textContent = 'Минимальная сумма вывода — 10 USDT!'; errEl.style.display = 'block'; return; }
            if (amount > trustMainBalance) { errEl.textContent = 'Недостаточно средств на балансе!'; errEl.style.display = 'block'; return; }

            // Show success modal
            logUserAction('Вывод ' + amount.toFixed(2) + ' USDT на кошелёк ' + address.slice(0,8) + '...', 'withdraw', amount, address.slice(0,12) + '...');
            document.getElementById('wsModalAmount').textContent = amount.toFixed(2) + '$ USDT';
            openModal('withdrawSuccessModal');
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawAddress').value = '';
            document.getElementById('withdrawReceive').textContent = '— USDT';
        }

        // ==========================================
        // ВЫВОД USDT — ДИЗАЙНЕРСКОЕ МОДАЛЬНОЕ ОКНО
        // ==========================================
        // ==========================================
        // СЕТЬ ВЫВОДА — КАСТОМНЫЙ SELECTOR
        // ==========================================
        let selectedWNetwork = 'TRC20';

        function selectWNetwork(net, el) {
            selectedWNetwork = net;
            document.getElementById('wModalNetwork').value = net;
            const colors = {TRC20:'rgba(255,58,20,0.15)',ERC20:'rgba(98,126,234,0.15)',BEP20:'rgba(243,186,47,0.15)'};
            const borders = {TRC20:'rgba(255,58,20,0.6)',ERC20:'rgba(98,126,234,0.6)',BEP20:'rgba(243,186,47,0.6)'};
            document.querySelectorAll('.wnet-opt').forEach(opt => {
                opt.style.background = 'rgba(15,23,42,0.6)';
                opt.style.border = '1.5px solid rgba(59,130,246,0.15)';
            });
            el.style.background = colors[net];
            el.style.border = '1.5px solid ' + borders[net];
            ['TRC20','ERC20','BEP20'].forEach(n => {
                const ch = document.getElementById('wnet-check-'+n);
                if(ch) ch.style.display = n === net ? 'flex' : 'none';
            });
        }

        // ==========================================
        // НАСТРОЙКИ ПРОФИЛЯ + АВАТАР
        // ==========================================
        function initSettings() {
            const savedName = localStorage.getItem('trustUserName') || '';
            const parts = savedName.trim().split(/\s+/);
            const fnEl = document.getElementById('settingsFirstNameVal');
            const lnEl = document.getElementById('settingsLastNameVal');
            if (fnEl) fnEl.textContent = parts[0] || '—';
            if (lnEl) lnEl.textContent = parts.slice(1).join(' ') || '—';
            const trustId = localStorage.getItem('trustUserId') || '—';
            const tidEl = document.getElementById('settingsTrustIdFull');
            if (tidEl) tidEl.textContent = 'Trust ID: ' + trustId;
            const emailEl = document.getElementById('settingsEmailVal');
            if (emailEl) emailEl.textContent = localStorage.getItem('trustUserEmail') || '—';
            // Verification badge
            const isVerified = localStorage.getItem('trustUserVerified') === 'true';
            const vBadge = document.getElementById('verificationBadge');
            const nvBadge = document.getElementById('notVerifiedBadge');
            if (vBadge) vBadge.style.display = isVerified ? 'flex' : 'none';
            if (nvBadge) nvBadge.style.display = isVerified ? 'none' : 'flex';
            refreshSettingsAvatar();
        }

        function togglePasswordForm() {
            const form = document.getElementById('passwordForm');
            const chevron = document.getElementById('pwChevron');
            const open = form.style.display === 'none';
            form.style.display = open ? 'block' : 'none';
            if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function changePassword() {
            const oldPass = document.getElementById('settingsOldPass').value;
            const newPass = document.getElementById('settingsNewPass').value;
            const newPass2 = document.getElementById('settingsNewPass2').value;
            const msg = document.getElementById('pwChangeMsg');
            const storedPass = localStorage.getItem('trustUserPass') || '';
            if (!oldPass || !newPass || !newPass2) { msg.textContent = '✗ Заполните все поля'; msg.style.color = '#f87171'; msg.style.display = 'inline'; return; }
            if (oldPass !== storedPass) { msg.textContent = '✗ Неверный текущий пароль'; msg.style.color = '#f87171'; msg.style.display = 'inline'; return; }
            if (newPass.length < 6) { msg.textContent = '✗ Минимум 6 символов'; msg.style.color = '#f87171'; msg.style.display = 'inline'; return; }
            if (newPass !== newPass2) { msg.textContent = '✗ Пароли не совпадают'; msg.style.color = '#f87171'; msg.style.display = 'inline'; return; }
            localStorage.setItem('trustUserPass', newPass);
            msg.textContent = '✓ Пароль изменён!'; msg.style.color = '#4ade80'; msg.style.display = 'inline';
            document.getElementById('settingsOldPass').value = '';
            document.getElementById('settingsNewPass').value = '';
            document.getElementById('settingsNewPass2').value = '';
            setTimeout(() => { msg.style.display = 'none'; togglePasswordForm(); }, 2000);
            logUserAction('Изменил пароль');
        }

        function refreshSettingsAvatar() {
            const preview = document.getElementById('settingsAvatarPreview');
            if (!preview) return;
            const savedAvatar = localStorage.getItem('trustUserAvatar');
            if (savedAvatar) {
                preview.style.background = 'none';
                preview.innerHTML = `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                preview.style.background = 'linear-gradient(135deg,#2563eb,#4f46e5)';
                const name = localStorage.getItem('trustUserName') || 'ИИ';
                const parts = name.trim().split(/\s+/);
                const initials = parts.length >= 2 ? (parts[0][0]+parts[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
                preview.innerHTML = initials;
            }
            // Update header avatar too
            updateHeaderAvatar();
        }

        function updateHeaderAvatar() {
            const av = document.getElementById('profileAvatar');
            if (!av) return;
            const savedAvatar = localStorage.getItem('trustUserAvatar');
            if (savedAvatar) {
                av.style.background = 'none';
                av.style.overflow = 'hidden';
                av.innerHTML = `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                av.style.background = 'linear-gradient(135deg,#2563eb,#4f46e5)';
                av.style.overflow = '';
                const name = localStorage.getItem('trustUserName') || 'ИИ';
                const parts = name.trim().split(/\s+/);
                av.textContent = parts.length >= 2 ? (parts[0][0]+parts[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
            }
        }

        function handleAvatarUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { showCustomAlert('Файл слишком большой', 'Максимальный размер файла — 5MB.', 'error'); return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                localStorage.setItem('trustUserAvatar', e.target.result);
                refreshSettingsAvatar();
                logUserAction('Обновил аватар');
            };
            reader.readAsDataURL(file);
        }

        function removeAvatar() {
            localStorage.removeItem('trustUserAvatar');
            refreshSettingsAvatar();
            logUserAction('Удалил аватар');
        }

        function saveProfileSettings() {
            // Name is locked after registration - function kept for compatibility
            const msg = document.getElementById('settingsSaveMsg');
            if (msg) { msg.textContent = '✓ Сохранено!'; msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
        }

        // Init settings when tab opens
        const _origSwitchDashTab = window.switchDashTab;

        // ==========================================
        // USER ACTION LOGGING
        // ==========================================
        function logUserAction(action, type, amount, extra) {
            let logs = JSON.parse(localStorage.getItem('trustUserLogs') || '[]');
            logs.unshift({ time: new Date().toISOString(), action, type: type || 'other', amount: amount || null, extra: extra || null });
            if (logs.length > 200) logs = logs.slice(0, 200);
            localStorage.setItem('trustUserLogs', JSON.stringify(logs));
        }

        // ==========================================
        // ИСТОРИЯ ТРАНЗАКЦИЙ
        // ==========================================
        let histCurrentFilter = 'all';

        function renderHistory() {
            const logs = JSON.parse(localStorage.getItem('trustUserLogs') || '[]');
            const txTypes = ['deposit','withdraw','buy','sell','mining','airdrop'];
            const txLogs = logs.filter(l => txTypes.includes(l.type));

            // Stats
            let totalDeposit = 0, totalWithdraw = 0, tradeCount = 0, totalMining = 0;
            txLogs.forEach(l => {
                if (l.type === 'deposit') totalDeposit += l.amount || 0;
                if (l.type === 'withdraw') totalWithdraw += l.amount || 0;
                if (l.type === 'buy' || l.type === 'sell') tradeCount++;
                if (l.type === 'mining') totalMining += l.amount || 0;
            });
            const sd = document.getElementById('histStatDeposit');
            const sw = document.getElementById('histStatWithdraw');
            const st = document.getElementById('histStatTrade');
            const sm = document.getElementById('histStatMining');
            if (sd) sd.textContent = totalDeposit.toFixed(2) + '$';
            if (sw) sw.textContent = totalWithdraw.toFixed(2) + '$';
            if (st) st.textContent = tradeCount;
            if (sm) sm.textContent = totalMining.toFixed(4) + '$';

            // Filter
            const filtered = histCurrentFilter === 'all' ? txLogs : txLogs.filter(l => l.type === histCurrentFilter);

            const body = document.getElementById('historyTableBody');
            if (!body) return;

            if (filtered.length === 0) {
                body.innerHTML = '<div style="padding:50px 20px;text-align:center;"><i class="fa-solid fa-clock-rotate-left" style="font-size:2.5rem;color:#1e293b;display:block;margin-bottom:14px;"></i><div style="color:#475569;font-size:0.9rem;">Нет транзакций в этой категории</div></div>';
                return;
            }

            const typeConfig = {
                deposit:  { icon: 'fa-arrow-down',           color: '#4ade80',  label: 'Пополнение',  bg: 'rgba(74,222,128,0.1)',  sign: '+' },
                withdraw: { icon: 'fa-arrow-up-right-from-square', color: '#f87171',  label: 'Вывод',       bg: 'rgba(248,113,113,0.1)', sign: '-' },
                buy:      { icon: 'fa-cart-shopping',        color: '#38bdf8',  label: 'Покупка',     bg: 'rgba(56,189,248,0.1)',  sign: '-' },
                sell:     { icon: 'fa-hand-holding-dollar',  color: '#fbbf24',  label: 'Продажа',     bg: 'rgba(251,191,36,0.1)',  sign: '+' },
                mining:   { icon: 'fa-microchip',            color: '#a855f7',  label: 'Майнинг',     bg: 'rgba(168,85,247,0.1)',  sign: '+' },
                airdrop:  { icon: 'fa-parachute-box',        color: '#818cf8',  label: 'Аирдроп',     bg: 'rgba(129,140,248,0.1)', sign: '+' },
                other:    { icon: 'fa-circle-dot',           color: '#64748b',  label: 'Прочее',      bg: 'rgba(100,116,139,0.1)', sign: '' }
            };

            body.innerHTML = filtered.map((tx, i) => {
                let cfg = typeConfig[tx.type] || typeConfig.other;
                const date = new Date(tx.time);
                const dateStr = date.toLocaleDateString('ru-RU', { day:'2-digit', month:'short', year:'2-digit' });
                const timeStr = date.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
                const amountStr = tx.amount ? (cfg.sign + tx.amount.toFixed(tx.type === 'mining' ? 4 : 2) + '$') : '—';
                const amountColor = cfg.sign === '+' ? '#4ade80' : cfg.sign === '-' ? '#f87171' : '#94a3b8';
                // Check real withdraw status
                var wdStatus = 'done';
                if (tx.type === 'withdraw') {
                    if (tx.decided) {
                        wdStatus = tx.decided; // already decided inline
                    } else {
                        var wdReqs = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
                        var matchReq = null;
                        for (var wi = wdReqs.length - 1; wi >= 0; wi--) {
                            if (tx.amount && Math.abs((wdReqs[wi].amount || 0) - (tx.amount || 0)) < 0.01) { matchReq = wdReqs[wi]; break; }
                        }
                        wdStatus = matchReq ? matchReq.status : 'pending';
                    }
                }
                var statusBadge;
                if (tx.type === 'withdraw') {
                    if (wdStatus === 'approved') statusBadge = '<span style="background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2);border-radius:6px;padding:2px 8px;font-size:0.68rem;font-weight:700;">Выполнено</span>';
                    else if (wdStatus === 'rejected') statusBadge = '<span style="background:rgba(248,113,113,0.1);color:#f87171;border:1px solid rgba(248,113,113,0.2);border-radius:6px;padding:2px 8px;font-size:0.68rem;font-weight:700;">Отклонён</span>';
                    else statusBadge = '<span style="background:rgba(148,163,184,0.1);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);border-radius:6px;padding:2px 8px;font-size:0.68rem;font-weight:700;">На проверке</span>';
                    // Override icon to gray for pending
                    if (wdStatus === 'pending') { cfg = Object.assign({}, cfg, { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }); }
                } else {
                    statusBadge = '<span style="background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2);border-radius:6px;padding:2px 8px;font-size:0.68rem;font-weight:700;">Выполнено</span>';
                }

                const isEven = i % 2 === 0;
                return `<div class="hist-row" style="display:grid;grid-template-columns:40px 1fr 140px 120px 100px;gap:0;padding:13px 20px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;background:${isEven ? 'transparent' : 'rgba(255,255,255,0.01)'};transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='${isEven ? 'transparent' : 'rgba(255,255,255,0.01)'}'">
                    <div style="width:30px;height:30px;border-radius:8px;background:${cfg.bg};border:1px solid ${cfg.color}22;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid ${cfg.icon}" style="color:${cfg.color};font-size:0.75rem;"></i>
                    </div>
                    <div style="min-width:0;padding-right:12px;">
                        <div style="color:#fff;font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tx.action}</div>
                        <div style="color:#475569;font-size:0.7rem;margin-top:2px;">${cfg.label}${tx.extra ? ' · ' + tx.extra : ''}</div>
                    </div>
                    <div style="color:${tx.amount ? amountColor : '#475569'};font-weight:${tx.amount ? '800' : '400'};font-size:0.88rem;">${amountStr}</div>
                    <div>
                        <div style="color:#94a3b8;font-size:0.8rem;">${dateStr}</div>
                        <div style="color:#475569;font-size:0.7rem;">${timeStr}</div>
                    </div>
                    <div>${statusBadge}</div>
                </div>`;
            }).join('');
        }

        function histSetFilter(type, btn) {
            histCurrentFilter = type;
            document.querySelectorAll('[id^="histFilter-"]').forEach(b => {
                b.style.background = 'rgba(100,116,139,0.1)';
                b.style.color = '#64748b';
                b.style.borderColor = 'rgba(100,116,139,0.2)';
            });
            if (btn) {
                btn.style.background = 'rgba(56,189,248,0.15)';
                btn.style.color = '#38bdf8';
                btn.style.borderColor = 'rgba(56,189,248,0.35)';
            }
            renderHistory();
        }

        function histClear() {
            showCustomAlert('Недоступно', 'Очистка истории транзакций запрещена.', 'warning');
        }

        function openWithdrawModal() {
            const avail = document.getElementById('wModalAvail');
            if (avail) avail.textContent = trustMainBalance.toFixed(2) + '$ USDT';
            document.getElementById('wModalAmount').value = '';
            document.getElementById('wModalAddress').value = '';
            document.getElementById('wModalReceive').textContent = '— USDT';
            const errEl = document.getElementById('wModalError');
            if (errEl) errEl.style.display = 'none';
            openModal('withdrawModal');
        }

        function calcWModal() {
            const amt = parseFloat(document.getElementById('wModalAmount').value) || 0;
            const receive = Math.max(0, amt - 1).toFixed(2);
            document.getElementById('wModalReceive').textContent = amt > 0 ? receive + '$ USDT' : '— USDT';
        }

        function submitWModal() {
            const address = document.getElementById('wModalAddress').value.trim();
            const amount = parseFloat(document.getElementById('wModalAmount').value);
            const network = document.getElementById('wModalNetwork').value;
            const errEl = document.getElementById('wModalError');
            errEl.style.display = 'none';

            if (!address || address.length < 20) { errEl.textContent = 'Введите корректный адрес кошелька (мин. 20 символов)!'; errEl.style.display = 'block'; return; }
            // Validate wallet address format
            var validAddr = false;
            if (network === 'TRC20' && /^T[a-zA-Z0-9]{33}$/.test(address)) validAddr = true;
            else if (network === 'ERC20' && /^0x[a-fA-F0-9]{40}$/.test(address)) validAddr = true;
            else if (network === 'BEP20' && /^0x[a-fA-F0-9]{40}$/.test(address)) validAddr = true;
            else if (address.length >= 20) validAddr = true; // fallback
            if (!validAddr) { errEl.textContent = 'Неверный формат адреса для сети ' + network + '!'; errEl.style.display = 'block'; return; }
            if (!amount || amount < 10) { errEl.textContent = 'Минимальная сумма вывода — 10 USDT!'; errEl.style.display = 'block'; return; }
            if (amount > trustMainBalance) { errEl.textContent = 'Недостаточно средств на балансе!'; errEl.style.display = 'block'; return; }

            // Save withdrawal request for admin approval
            var requests = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
            requests.push({
                id: Date.now(),
                userId: localStorage.getItem('trustUserId') || '?',
                userName: localStorage.getItem('trustUserName') || 'User',
                address: address,
                network: network,
                amount: amount,
                fee: 1,
                receive: Math.max(0, amount - 1),
                status: 'pending',
                createdAt: new Date().toLocaleString('ru-RU')
            });
            localStorage.setItem('trustWithdrawRequests', JSON.stringify(requests));

            // Deduct balance immediately (hold)
            trustMainBalance -= amount;
            localStorage.setItem('trustMainBalance', trustMainBalance.toFixed(8));
            updateBalanceUI();

            closeModal('withdrawModal');
            logUserAction('Запрос вывода ' + amount.toFixed(2) + ' USDT на ' + address.slice(0,8) + '... (' + network + ')', 'withdraw', amount, address.slice(0,12) + '...');
            showCustomAlert('Заявка отправлена', 'Ваш запрос на вывод ' + amount.toFixed(2) + ' USDT отправлен на обработку. Ожидайте подтверждения администратором.', 'success');
        }

        // ==========================================
        // ADMIN PANEL MODAL
        // ==========================================
        let adminBalanceLog = [];
        let adminSysLog = [];
        let adminWelcomeEnabled = true;
        let adminMaintEnabled = false;
        let adminWithdrawCount = 0;

        function openAdminPanelModal() {
            refreshAdminStats();
            renderAdminModalTasks();
            switchAdminTab('users');
            adminRenderKyc();
            openModal('adminPanelModal');
        }

        function refreshAdminStats() {
            const balEl = document.getElementById('adminStatBalance');
            const tasksEl = document.getElementById('adminStatTasks');
            const statMiner = document.getElementById('adminStatMiner');
            const statW = document.getElementById('adminStatWithdrawals');
            const userNameEl = document.getElementById('adminUserName');
            const userTrustEl = document.getElementById('adminUserTrustId');
            const userBalEl = document.getElementById('adminUserBalance');
            const adminStatBal = document.getElementById('adminStatBalance');

            if (balEl) balEl.textContent = trustMainBalance.toFixed(2) + '$ USDT';
            if (adminStatBal) adminStatBal.textContent = trustMainBalance.toFixed(2);
            if (statMiner) statMiner.textContent = (typeof trustMinerState !== 'undefined' && trustMinerState === 'ONLINE') ? 'ON' : 'OFF';
            var wdRequests = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
            var wdPending = wdRequests.filter(function(r) { return r.status === 'pending'; });
            if (statW) statW.textContent = wdPending.length;
            var wdTabBadge = document.getElementById('wdTabBadge');
            if (wdTabBadge) { wdTabBadge.style.display = wdPending.length > 0 ? 'flex' : 'none'; wdTabBadge.textContent = wdPending.length; }
            if (userNameEl) userNameEl.textContent = document.getElementById('displayUserName')?.textContent || '—';
            if (userTrustEl) userTrustEl.textContent = document.getElementById('displayTrustId')?.textContent || '—';
            if (userBalEl) userBalEl.textContent = trustMainBalance.toFixed(2) + '$ USDT';

            let pending = 0;
            if (typeof userTasks !== 'undefined') {
                for (const [id, data] of Object.entries(userTasks)) {
                    if (data.status === 'moderation') pending++;
                }
            }
            if (tasksEl) tasksEl.textContent = pending;
        }

        function switchAdminTab(tab) {
            ['balance','tasks','users','user','system','kyc','withdrawals','trs','support'].forEach(t => {
                const sec = document.getElementById('admin-section-' + t);
                const btn = document.getElementById('atab-' + t);
                if (sec) sec.classList.remove('active');
                if (btn) btn.classList.remove('active-admin-tab');
            });
            const active = document.getElementById('admin-section-' + tab);
            const activeBtn = document.getElementById('atab-' + tab);
            if (active) active.classList.add('active');
            if (activeBtn) activeBtn.classList.add('active-admin-tab');
            if (tab === 'tasks') renderAdminModalTasks();
            if (tab === 'users') renderAdminUsers();
            if (tab === 'user') refreshAdminStats();
            if (tab === 'kyc') adminRenderKyc();
            if (tab === 'withdrawals') adminRenderWithdrawals();
            if (tab === 'trs') adminInitTrs();
            if (tab === 'support') adminRenderSupport();
        }

        function adminLog(msg, type = 'green') {
            const colors = { green: '#4ade80', blue: '#4ade80', red: '#f87171', yellow: '#f87171' };
            const time = new Date().toLocaleTimeString('ru');
            const line = `<p style="color:${colors[type] || '#4ade80'};">[${time}] ${msg}</p>`;
            adminBalanceLog.unshift(line);
            const el = document.getElementById('adminBalanceLog');
            if (el) el.innerHTML = adminBalanceLog.slice(0,20).join('');
            adminSysLogAdd(msg, type);
        }

        function adminSysLogAdd(msg, type = 'green') {
            const colors = { green: '#4ade80', blue: '#4ade80', red: '#f87171', yellow: '#f87171' };
            const time = new Date().toLocaleTimeString('ru');
            const line = `<p style="color:${colors[type] || '#4ade80'};">[${time}] ${msg}</p>`;
            adminSysLog.unshift(line);
            const el = document.getElementById('adminSysLog');
            if (el) el.innerHTML = adminSysLog.slice(0,30).join('');
        }

        function adminAddBalance() {
            const val = parseFloat(document.getElementById('adminAddAmount').value);
            if (!val || val <= 0) { adminLog('Ошибка: введите сумму > 0', 'red'); return; }
            trustMainBalance += val;
            localStorage.setItem('trustMainBalance', trustMainBalance);
            updateBalanceUI();
            refreshAdminStats();
            adminLog(`Пополнение на ${val.toFixed(2)} USDT. Новый баланс: ${trustMainBalance.toFixed(2)} USDT`, 'green');
            logUserAction('Пополнение баланса на ' + val.toFixed(2) + '$ USDT', 'deposit', val, 'Администратор');
            document.getElementById('adminAddAmount').value = '';
        }

        function adminSetQuick(val) {
            document.getElementById('adminAddAmount').value = val;
            adminAddBalance();
        }

        function adminSubBalance() {
            const val = parseFloat(document.getElementById('adminSubAmount').value);
            if (!val || val <= 0) { adminLog('Ошибка: введите сумму > 0', 'red'); return; }
            if (val > trustMainBalance) { adminLog('Ошибка: сумма списания > баланса', 'red'); return; }
            trustMainBalance -= val;
            localStorage.setItem('trustMainBalance', trustMainBalance);
            updateBalanceUI();
            refreshAdminStats();
            adminLog(`Списание ${val.toFixed(2)} USDT. Новый баланс: ${trustMainBalance.toFixed(2)} USDT`, 'yellow');
            document.getElementById('adminSubAmount').value = '';
        }

        function adminSetBalance() {
            const val = parseFloat(document.getElementById('adminSetAmount').value);
            if (val === undefined || isNaN(val) || val < 0) { adminLog('Ошибка: некорректное значение', 'red'); return; }
            trustMainBalance = val;
            localStorage.setItem('trustMainBalance', trustMainBalance);
            updateBalanceUI();
            refreshAdminStats();
            adminLog(`Баланс установлен: ${val.toFixed(2)} USDT`, 'blue');
            document.getElementById('adminSetAmount').value = '';
        }

        function adminResetBalance() {
            if (!confirm('Обнулить баланс пользователя?')) return;
            trustMainBalance = 0;
            localStorage.setItem('trustMainBalance', 0);
            updateBalanceUI();
            refreshAdminStats();
            adminLog('Баланс обнулён', 'red');
        }

        function adminFullReset() {
            if (!confirm('ПОЛНЫЙ СБРОС: удалить все данные пользователя? Это действие необратимо!')) return;
            localStorage.clear();
            adminLog('Полный сброс выполнен. Перезагрузка...', 'red');
            setTimeout(() => location.reload(), 1200);
        }

        function adminResetTasks() {
            if (!confirm('Сбросить все задания пользователя?')) return;
            if (typeof userTasks !== 'undefined') {
                for (const id in userTasks) { userTasks[id].status = 'new'; }
                localStorage.setItem('trustUserTasks', JSON.stringify(userTasks));
            }
            refreshAdminStats();
            renderAdminModalTasks();
            adminLog('Все задания сброшены', 'yellow');
        }

        function renderAdminModalTasks() {
            const list = document.getElementById('adminModalTasksList');
            if (!list) return;
            list.innerHTML = '';
            let hasPending = false;
            if (typeof userTasks !== 'undefined' && typeof airdropsData !== 'undefined') {
                for (const [id, data] of Object.entries(airdropsData)) {
                    if (userTasks[id] && userTasks[id].status === 'moderation') {
                        hasPending = true;
                        list.innerHTML += `
                            <div style="background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.2); border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                                <div>
                                    <div style="color:#fff; font-weight:700; font-size:0.9rem;">${data.title}</div>
                                    <div style="color:#64748b; font-size:0.8rem; margin-top:3px;">Пользователь: ${document.getElementById('displayUserName')?.textContent || '—'}</div>
                                    <div style="color:#64748b; font-size:0.8rem;">Файл: ${userTasks[id].file}</div>
                                </div>
                                <button style="background:linear-gradient(135deg,#10b981,#059669); color:#fff; border:none; border-radius:10px; padding:10px 18px; font-weight:800; cursor:pointer; font-size:0.85rem; white-space:nowrap;" onclick="adminApproveTaskModal('${id}')">✓ +${data.reward}$</button>
                            </div>
                        `;
                    }
                }
            }
            if (!hasPending) {
                list.innerHTML = '<p style="color:#475569; text-align:center; padding:20px 0;">Нет заданий, ожидающих проверки.</p>';
            }
            refreshAdminStats();
        }

        function adminApproveTaskModal(id) {
            if (typeof userTasks !== 'undefined' && typeof airdropsData !== 'undefined') {
                userTasks[id].status = 'completed';
                localStorage.setItem('trustUserTasks', JSON.stringify(userTasks));
                trustMainBalance += airdropsData[id].reward;
                localStorage.setItem('trustMainBalance', trustMainBalance);
                updateBalanceUI();
                adminLog(`Задание "${airdropsData[id].title}" одобрено. Начислено ${airdropsData[id].reward} USDT`, 'green');
                logUserAction('Аирдроп: ' + airdropsData[id].title + ' — получено ' + airdropsData[id].reward + ' USDT', 'airdrop', airdropsData[id].reward, airdropsData[id].title);
                renderAdminModalTasks();
                if (typeof renderAirdropsUI === 'function') renderAirdropsUI();
            }
        }

        function adminSetName() {
            const newName = document.getElementById('adminNewName').value.trim();
            if (!newName) return;
            const nameEl = document.getElementById('displayUserName');
            if (nameEl) nameEl.textContent = newName;
            localStorage.setItem('trustUserName', newName);
            refreshAdminStats();
            adminLog(`Имя изменено на "${newName}"`, 'blue');
            document.getElementById('adminNewName').value = '';
        }

        function adminMinerOn() {
            if (typeof trustMinerState !== 'undefined') {
                trustMinerState = 'ONLINE';
                localStorage.setItem('trustMinerState', 'ONLINE');
            }
            refreshAdminStats();
            adminSysLogAdd('Майнер запущен администратором', 'green');
        }

        function adminMinerOff() {
            if (typeof trustMinerState !== 'undefined') {
                trustMinerState = 'OFFLINE';
                localStorage.setItem('trustMinerState', 'OFFLINE');
            }
            refreshAdminStats();
            adminSysLogAdd('Майнер остановлен администратором', 'red');
        }

        function adminSetMinedVal() {
            const val = parseFloat(document.getElementById('adminSetMined').value);
            if (isNaN(val) || val < 0) return;
            if (typeof trustSessionMined !== 'undefined') {
                trustSessionMined = val;
                localStorage.setItem('trustSessionMined', val);
            }
            adminSysLogAdd(`Намайнено установлено: ${val.toFixed(4)}`, 'blue');
        }

        function adminToggleWelcome() {
            adminWelcomeEnabled = !adminWelcomeEnabled;
            const btn = document.getElementById('adminToggleWelcome');
            if (btn) {
                btn.textContent = adminWelcomeEnabled ? 'ВКЛ' : 'ВЫКЛ';
                btn.style.color = adminWelcomeEnabled ? '#4ade80' : '#94a3b8';
            }
            adminSysLogAdd(`Приветствие: ${adminWelcomeEnabled ? 'включено' : 'выключено'}`, adminWelcomeEnabled ? 'green' : 'yellow');
        }

        function adminToggleMaint() {
            adminMaintEnabled = !adminMaintEnabled;
            const btn = document.getElementById('adminToggleMaintenance');
            if (btn) {
                btn.textContent = adminMaintEnabled ? 'ВКЛ' : 'ВЫКЛ';
                btn.style.color = adminMaintEnabled ? '#f87171' : '#94a3b8';
                btn.style.background = adminMaintEnabled ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)';
            }
            adminSysLogAdd(`Режим обслуживания: ${adminMaintEnabled ? 'включён' : 'выключен'}`, 'red');
        }

        function adminClearLog() {
            adminSysLog = [];
            const el = document.getElementById('adminSysLog');
            if (el) el.innerHTML = '<p style="color:#38bdf8;">// Лог очищен администратором</p>';
        }

        // ==========================================
        // ADMIN — USERS DATABASE
        // ==========================================
        function getAdminUserData() {
            // Current user data from localStorage (single-user mode)
            const userId = localStorage.getItem('trustUserId') || '00000';
            const userName = localStorage.getItem('trustUserName') || 'Пользователь';
            const avatar = localStorage.getItem('trustUserAvatar') || null;
            const balance = parseFloat(localStorage.getItem('trustMainBalance')) || 0;
            const portfolio = JSON.parse(localStorage.getItem('trustPortfolio') || '{}');
            const tasks = JSON.parse(localStorage.getItem('trustUserTasks') || '{}');
            const logs = JSON.parse(localStorage.getItem('trustUserLogs') || '[]');
            const minerState = localStorage.getItem('trustMinerState') || 'OFFLINE';
            const ip = localStorage.getItem('trustUserIP') || 'Неизвестен';
            const lastSeen = localStorage.getItem('trustLastSeen') || new Date().toISOString();

            const completedAirdrops = Object.values(tasks).filter(t => t.status === 'completed').length;
            const pendingAirdrops = Object.values(tasks).filter(t => t.status === 'moderation').length;
            const portfolioCoins = Object.keys(portfolio).filter(c => portfolio[c] > 0.000001).length;

            return [{
                id: userId, name: userName, avatar,
                balance, portfolio, portfolioCoins,
                completedAirdrops, pendingAirdrops, tasks,
                logs, minerState, ip, lastSeen,
                isOnline: localStorage.getItem('trustIsAuth') === 'true',
                isVerified: localStorage.getItem('trustUserVerified') === 'true'
            }];
        }

        let _quickEditField = null;
        let _quickEditUserId = null;

        function openQuickEdit(field) {
            _quickEditField = field;
            const u = getAdminUserData()[0];
            const modal = document.getElementById('adminQuickModal');
            const title = document.getElementById('quickModalTitle');
            const input = document.getElementById('quickModalInput');
            if (field === 'balance') {
                title.textContent = '💰 Изменить баланс USDT';
                input.type = 'number'; input.step = '0.01';
                input.value = u.balance.toFixed(2);
            } else if (field === 'miner') {
                title.textContent = '⛏ Статус майнера (1 = ONLINE, 0 = OFFLINE)';
                input.type = 'number'; input.step = '1'; input.min = '0'; input.max = '1';
                input.value = u.minerState === 'ONLINE' ? 1 : 0;
            } else if (field === 'assets') {
                title.textContent = '📦 Редактировать портфель (JSON)';
                input.type = 'text'; input.step = null;
                input.value = JSON.stringify(u.portfolio);
            }
            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 50);
        }

        function closeQuickModal() {
            document.getElementById('adminQuickModal').style.display = 'none';
            _quickEditField = null;
        }

        function saveQuickEdit() {
            const val = document.getElementById('quickModalInput').value;
            if (_quickEditField === 'balance') {
                const n = parseFloat(val);
                if (isNaN(n)) return;
                localStorage.setItem('trustMainBalance', n.toFixed(2));
                logAdminAction('Баланс изменён на ' + n.toFixed(2) + '$ USDT');
            } else if (_quickEditField === 'miner') {
                const st = parseInt(val) === 1 ? 'ONLINE' : 'OFFLINE';
                localStorage.setItem('trustMinerState', st);
                logAdminAction('Майнер переключён: ' + st);
            } else if (_quickEditField === 'assets') {
                try { const obj = JSON.parse(val); localStorage.setItem('trustPortfolio', JSON.stringify(obj)); logAdminAction('Портфель обновлён'); } catch(e) { showCustomAlert('Ошибка', 'Некорректный формат JSON.', 'error'); return; }
            }
            closeQuickModal();
            renderAdminUsers();
            if (document.getElementById('adminUserDetail').style.display !== 'none') showAdminUserDetail('current');
        }

        function toggleAdminVerify() {
            const cur = localStorage.getItem('trustUserVerified') === 'true';
            localStorage.setItem('trustUserVerified', (!cur).toString());
            logAdminAction(cur ? 'Верификация снята' : 'Пользователь верифицирован');
            showAdminUserDetail('current');
            renderAdminUsers();
        }

        function copyAdminDetailId() {
            const id = localStorage.getItem('trustUserId') || '';
            navigator.clipboard.writeText(id).then(() => {
                const el = document.getElementById('adminDetailId');
                const orig = el.textContent;
                el.textContent = '✓ Скопировано!';
                setTimeout(() => el.textContent = orig, 1500);
            });
        }

        function logAdminAction(action) {
            logUserAction('[ADMIN] ' + action);
        }

        function showAdminUserAssets() {
            var portfolio = JSON.parse(localStorage.getItem('trustPortfolio') || '{}');
            var coins = Object.keys(portfolio).filter(function(c) { return portfolio[c] > 0.000001; });
            if (!coins.length) {
                showCustomAlert('Активы пользователя', 'У пользователя нет активов в портфеле.', 'warning');
                return;
            }
            var html = coins.map(function(c) {
                var price = (chartHistory[c] && chartHistory[c].length > 0) ? chartHistory[c][chartHistory[c].length-1] : 0;
                var val = (portfolio[c] * price).toFixed(2);
                var amt = portfolio[c] < 0.01 ? portfolio[c].toFixed(6) : portfolio[c].toFixed(4);
                var iconUrl = coinIcons[c] || '';
                var iconHtml = iconUrl ? '<img src="' + iconUrl + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">' : '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1e3a6e,#2563eb);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.7rem;color:#fff;">' + c.charAt(0) + '</div>';
                return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(0,0,0,0.25);border-radius:10px;border:1px solid rgba(255,255,255,0.04);">' + iconHtml + '<div style="flex:1;"><div style="color:#fff;font-weight:700;font-size:0.9rem;">' + c + '</div><div style="color:#64748b;font-size:0.75rem;">' + amt + ' монет</div></div><div style="text-align:right;"><div style="color:#4ade80;font-weight:700;">$' + val + '</div></div></div>';
            }).join('');
            var existing = document.getElementById('adminAssetsPopup');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'adminAssetsPopup';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
            modal.innerHTML = '<div style="background:linear-gradient(160deg,#0b1628,#060e1c);border:1px solid rgba(56,189,248,0.25);border-radius:20px;padding:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="color:#fff;font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-chart-pie" style="color:#38bdf8;"></i>Активы пользователя</h3><button onclick="this.closest(\'#adminAssetsPopup\').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark"></i></button></div><div style="display:flex;flex-direction:column;gap:8px;">' + html + '</div></div>';
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        }

        function showAdminUserAirdrops() {
            var tasks = JSON.parse(localStorage.getItem('trustUserTasks') || '{}');
            var completed = [];
            for (var id in tasks) {
                if (tasks[id] === 'completed' || tasks[id] === 'approved') {
                    var ad = typeof airdropsData !== 'undefined' && airdropsData[parseInt(id)] ? airdropsData[parseInt(id)] : null;
                    completed.push({ id: id, title: ad ? ad.title : 'Аирдроп #' + id, reward: ad ? ad.reward : '?', icon: ad ? ad.icon : '🪂' });
                }
            }
            if (!completed.length) {
                showCustomAlert('Аирдропы пользователя', 'У пользователя нет завершённых аирдропов.', 'warning');
                return;
            }
            var html = completed.map(function(a) {
                return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(0,0,0,0.25);border-radius:10px;border:1px solid rgba(255,255,255,0.04);"><div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(99,102,241,0.15));display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">' + a.icon + '</div><div style="flex:1;"><div style="color:#fff;font-weight:700;font-size:0.88rem;">' + a.title + '</div><div style="color:#64748b;font-size:0.72rem;">ID: ' + a.id + '</div></div><div style="color:#4ade80;font-weight:800;font-size:0.9rem;">+$' + a.reward + '</div></div>';
            }).join('');
            var existing = document.getElementById('adminAirdropsPopup');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'adminAirdropsPopup';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
            modal.innerHTML = '<div style="background:linear-gradient(160deg,#0b1628,#060e1c);border:1px solid rgba(168,85,247,0.25);border-radius:20px;padding:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="color:#fff;font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-parachute-box" style="color:#a855f7;"></i>Аирдропы пользователя</h3><button onclick="this.closest(\'#adminAirdropsPopup\').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark"></i></button></div><div style="display:flex;flex-direction:column;gap:8px;">' + html + '</div></div>';
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        }

        function renderAdminUsers() {
            const list = document.getElementById('adminUsersList');
            if (!list) return;
            const search = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();
            const users = getAdminUserData().filter(u =>
                !search || u.id.toString().includes(search) || u.name.toLowerCase().includes(search)
            );
            const countEl = document.getElementById('adminUsersCount');
            if (countEl) countEl.textContent = users.length;

            if (!users.length) {
                list.innerHTML = '<div style="padding:30px;text-align:center;color:#475569;">Пользователи не найдены</div>';
                return;
            }

            list.innerHTML = users.map(u => {
                const avatarHtml = u.avatar
                    ? `<img src="${u.avatar}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
                    : `<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#4f46e5);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.82rem;color:#fff;flex-shrink:0;">${u.name.slice(0,2).toUpperCase()}</div>`;
                const onlineDot = u.isOnline
                    ? `<span style="width:8px;height:8px;background:#4ade80;border-radius:50%;display:inline-block;box-shadow:0 0 5px #4ade80;flex-shrink:0;"></span>`
                    : `<span style="width:8px;height:8px;background:#334155;border-radius:50%;display:inline-block;flex-shrink:0;"></span>`;
                const lastSeenStr = u.lastSeen ? new Date(u.lastSeen).toLocaleString('ru', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
                const verBadge = u.isVerified ? `<span style="background:rgba(74,222,128,0.12);color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:10px;padding:1px 6px;font-size:0.65rem;font-weight:700;">✔ Верф.</span>` : '';
                const minerColor = u.minerState === 'ONLINE' ? '#fbbf24' : '#475569';

                return `<div style="display:grid;grid-template-columns:42px 1fr 110px 110px 110px 90px 90px 80px;align-items:center;gap:0;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.03);transition:0.15s;" onmouseover="this.style.background='rgba(168,85,247,0.04)'" onmouseout="this.style.background='transparent'">
                    <!-- Avatar - click = full detail -->
                    <div onclick="showAdminUserDetail('${u.id}')" style="cursor:pointer;" title="Открыть профиль">
                        ${avatarHtml}
                    </div>
                    <!-- Name/ID - click = full detail -->
                    <div onclick="showAdminUserDetail('${u.id}')" style="padding-left:10px;cursor:pointer;min-width:0;" title="Открыть профиль">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${onlineDot}<span style="color:#fff;font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</span>${verBadge}</div>
                        <div style="color:#38bdf8;font-size:0.72rem;font-weight:700;margin-top:1px;">ID: ${u.id}</div>
                    </div>
                    <!-- Balance - click = quick edit -->
                    <div onclick="openQuickEdit('balance')" style="text-align:right;cursor:pointer;padding:6px 8px;border-radius:8px;transition:0.15s;" title="Нажмите для редактирования" onmouseover="this.style.background='rgba(74,222,128,0.08)'" onmouseout="this.style.background='transparent'">
                        <div style="color:#4ade80;font-weight:800;font-size:0.9rem;">${u.balance.toFixed(2)}</div>
                        <div style="color:#475569;font-size:0.68rem;">USDT <i class="fa-solid fa-pen-to-square" style="opacity:0.4;"></i></div>
                    </div>
                    <!-- Assets -->
                    <div onclick="showAdminUserAssets()" style="text-align:right;cursor:pointer;padding:6px 8px;border-radius:8px;transition:0.15s;" title="Нажмите чтобы посмотреть активы" onmouseover="this.style.background='rgba(56,189,248,0.08)'" onmouseout="this.style.background='transparent'">
                        <div style="color:#38bdf8;font-weight:800;font-size:0.9rem;">${u.portfolioCoins}</div>
                        <div style="color:#475569;font-size:0.68rem;">монет <i class="fa-solid fa-eye" style="opacity:0.4;"></i></div>
                    </div>
                    <!-- Airdrops -->
                    <div onclick="${u.completedAirdrops > 0 ? 'showAdminUserAirdrops()' : ''}" style="text-align:right;padding:6px 8px;${u.completedAirdrops > 0 ? 'cursor:pointer;border-radius:8px;transition:0.15s;' : ''}" ${u.completedAirdrops > 0 ? 'title="Нажмите чтобы посмотреть аирдропы" onmouseover="this.style.background=\'rgba(168,85,247,0.08)\'" onmouseout="this.style.background=\'transparent\'"' : ''}>
                        <div style="color:#a855f7;font-weight:800;font-size:0.9rem;">${u.completedAirdrops}</div>
                        <div style="color:#475569;font-size:0.68rem;">выполн.${u.completedAirdrops > 0 ? ' <i class="fa-solid fa-eye" style="opacity:0.4;"></i>' : ''}</div>
                    </div>
                    <!-- Miner - click = quick edit -->
                    <div onclick="openQuickEdit('miner')" style="text-align:center;cursor:pointer;padding:6px 8px;border-radius:8px;transition:0.15s;" title="Нажмите для редактирования" onmouseover="this.style.background='rgba(251,191,36,0.08)'" onmouseout="this.style.background='transparent'">
                        <div style="color:${minerColor};font-weight:800;font-size:0.85rem;">${u.minerState === 'ONLINE' ? 'ON' : 'OFF'} <i class="fa-solid fa-pen-to-square" style="opacity:0.4;font-size:0.65rem;"></i></div>
                    </div>
                    <!-- Last seen -->
                    <div style="text-align:center;padding:6px 4px;">
                        <div style="color:#64748b;font-size:0.7rem;">${lastSeenStr}</div>
                    </div>
                    <!-- Status -->
                    <div style="text-align:center;">
                        <span style="display:inline-block;background:${u.isOnline?'rgba(74,222,128,0.1)':'rgba(71,85,105,0.2)'};color:${u.isOnline?'#4ade80':'#64748b'};border:1px solid ${u.isOnline?'rgba(74,222,128,0.25)':'rgba(71,85,105,0.3)'};border-radius:7px;padding:3px 8px;font-size:0.7rem;font-weight:700;">${u.isOnline?'Online':'Offline'}</span>
                    </div>
                </div>`;
            }).join('');
        }

        function showAdminUserDetail(userId) {
            const users = getAdminUserData();
            const u = users[0]; // single-user mode
            if (!u) return;

            document.getElementById('adminUserDetail').style.display = 'block';

            const avatarEl = document.getElementById('adminDetailAvatar');
            if (u.avatar) { avatarEl.innerHTML = `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">`; }
            else { avatarEl.style.background = 'linear-gradient(135deg,#2563eb,#4f46e5)'; avatarEl.textContent = u.name.slice(0,2).toUpperCase(); }

            document.getElementById('adminDetailName').textContent = u.name;
            const idEl = document.getElementById('adminDetailId');
            idEl.textContent = 'Trust ID: ' + u.id + ' · IP: ' + u.ip + ' (нажмите чтобы скопировать)';

            const emailEl = document.getElementById('adminDetailEmail');
            if (emailEl) emailEl.textContent = localStorage.getItem('trustUserEmail') || '';

            const statusEl = document.getElementById('adminDetailStatus');
            statusEl.textContent = u.isOnline ? '● Online' : '○ Offline';
            statusEl.style.background = u.isOnline ? 'rgba(74,222,128,0.1)' : 'rgba(71,85,105,0.15)';
            statusEl.style.color = u.isOnline ? '#4ade80' : '#64748b';
            statusEl.style.border = u.isOnline ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(71,85,105,0.3)';

            // Verify badge
            const isVerified = u.isVerified;
            const vBadge = document.getElementById('adminDetailVerBadge');
            if (vBadge) vBadge.style.display = isVerified ? 'flex' : 'none';
            const verBtn = document.getElementById('adminVerifyBtn');
            if (verBtn) {
                verBtn.textContent = isVerified ? '✗ Снять верификацию' : '✔ Верифицировать';
                verBtn.style.background = isVerified ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)';
                verBtn.style.color = isVerified ? '#f87171' : '#4ade80';
                verBtn.style.border = isVerified ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(74,222,128,0.25)';
            }

            document.getElementById('adminDetailBalance').textContent = u.balance.toFixed(2) + '$ USDT';
            document.getElementById('adminDetailPortfolio').textContent = u.portfolioCoins;
            document.getElementById('adminDetailAirdrops').textContent = u.completedAirdrops + ' завершено / ' + u.pendingAirdrops + ' ожид.';
            const minerEl = document.getElementById('adminDetailMiner');
            minerEl.textContent = u.minerState;
            minerEl.style.color = u.minerState === 'ONLINE' ? '#fbbf24' : '#475569';

            const metaEl = document.getElementById('adminDetailMeta');
            if (metaEl) {
                const ls = u.lastSeen ? new Date(u.lastSeen).toLocaleString('ru') : '—';
                metaEl.innerHTML = `${u.ip}<br>${ls}`;
            }

            // Assets
            const assetsList = document.getElementById('adminDetailAssets');
            const coins = Object.keys(u.portfolio).filter(c => u.portfolio[c] > 0.000001);
            if (coins.length) {
                assetsList.innerHTML = coins.map(c => {
                    const price = (chartHistory[c] && chartHistory[c].length > 0) ? chartHistory[c][chartHistory[c].length-1] : 0;
                    const val = (u.portfolio[c] * price).toFixed(2);
                    return `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:5px 10px;margin:3px;font-size:0.82rem;color:#fff;"><b>${c}</b> <span style="color:#64748b;">${u.portfolio[c] < 0.01 ? u.portfolio[c].toFixed(6) : u.portfolio[c].toFixed(4)}</span> <span style="color:#4ade80;">≈ $${val}</span></span>`;
                }).join('');
            } else {
                assetsList.innerHTML = '<span style="color:#475569;">Нет активов в портфеле</span>';
            }

            // Logs
            const logsEl = document.getElementById('adminDetailLogs');
            if (u.logs.length) {
                logsEl.innerHTML = u.logs.slice(0, 50).map(l => {
                    const t = new Date(l.time).toLocaleString('ru', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
                    const isAdmin = l.action.startsWith('[ADMIN]');
                    return `<p style="color:${isAdmin?'#f59e0b':'#4ade80'};margin-bottom:3px;">[${t}] ${l.action}</p>`;
                }).join('');
            } else {
                logsEl.innerHTML = '<p style="color:#475569;">История действий пуста</p>';
            }

            document.getElementById('adminUserDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }


        let userTasks = JSON.parse(localStorage.getItem('trustUserTasks')) || {};


        const mwxFullArticle = `
            <h2>🚀 Airdrop: MWX Loyalty Program</h2>
            <p><strong>💰 Пул наград:</strong> $100,000 Prize pool</p>
            <p><strong>📅 Дата окончания:</strong> 12 Марта 2026</p>
            <p><strong>📃 Информация:</strong> Mwx — это первый децентрализованный ИИ-маркетплейс для готовых бизнес-решений.</p>
            <h2>📖 Пошаговое руководство:</h2>
            <ul>
                <li>Перейдите на страницу Airdrop по кнопке "Сайт проекта".</li>
                <li>Подключите свой Web3 кошелек.</li>
                <li>Подключите свой аккаунт X (Twitter).</li>
                <li>Выполняйте ежедневные задания.</li>
                <li>Зарабатывайте до 70 $MWX Points в день за выполнение всех заданий.</li>
            </ul>
        `;
        const wowFullArticle = `
            <h2>🚀 Airdrop: WOW Exchange</h2>
            <p><strong>💰 Награда:</strong> 30 WOW бонус за регистрацию + 10 WOW за реферала</p>
            <p><strong>📅 Дата окончания:</strong> Будет объявлена командой WOW</p>
            <p><strong>📃 Информация:</strong> WOW Exchange — это готовящаяся к запуску криптовалютная биржа следующего поколения.</p>
            <h2>📖 Пошаговое руководство:</h2>
            <ul>
                <li>Перейдите на страницу Airdrop по кнопке "Сайт проекта".</li>
                <li>Создайте аккаунт и получите 30 WOW в качестве бонуса за регистрацию.</li>
                <li>Приглашайте друзей и получайте 10 WOW за каждого реферала.</li>
            </ul>
        `;
        const kovaFullArticle = `
            <h2>🚀 Airdrop: Kova Network</h2>
            <p><strong>💰 Награда:</strong> $10,000</p>
            <p><strong>🏆 Победители:</strong> 25 лучших участников</p>
            <p><strong>📅 Дата окончания:</strong> 22 Февраля 2026</p>
            <p><strong>📃 Информация:</strong> Kova — это децентрализованный вычислительный слой для получения мгновенной, масштабируемой и доступной мощности.</p>
            <h2>📖 Пошаговое руководство:</h2>
            <ul>
                <li>Перейдите на страницу Airdrop по кнопке "Сайт проекта".</li>
                <li>Зарегистрируйтесь с помощью вашего X (Twitter) и подайте заявку на кампанию.</li>
                <li>Используйте инвайт-код: <strong>FT941W54</strong> и заработайте 100 Pulse.</li>
            </ul>
        `;
        const nexiraFullArticle = `
            <h2>🚀 Airdrop: Nexira</h2>
            <p><strong>💰 Награда:</strong> Locked Ruby (конвертируются в токены NEXI)</p>
            <p><strong>📅 Дата окончания:</strong> TBA</p>
            <p><strong>📃 Информация:</strong> Nexira революционизирует кросс-игровую совместимость в Nexira DAEP.</p>
            <h2>📖 Пошаговое руководство:</h2>
            <ul>
                <li>Перейдите на страницу Airdrop по кнопке "Сайт проекта".</li>
                <li>Нажмите "CONNECT TO CLAIM YOUR REWARDS".</li>
                <li>Подключитесь, используя свой аккаунт Google или Apple.</li>
                <li>Привяжите свои аккаунты X, Telegram и Discord.</li>
                <li>Выполняйте задания, чтобы заработать Gold Boxes, Diamond Boxes и VIP Boxes.</li>
            </ul>
        `;
        const mercuryFullArticle = `
            <h2>🚀 Airdrop: Mercury Quests Campaign</h2>
            <p><strong>💰 Награда:</strong> $35,000 общий пул + 1 месяц Pro подписки для всех</p>
            <p><strong>📅 Дата окончания:</strong> 1 Февраля 2026</p>
            <p><strong>📃 Информация:</strong> Mercury — это инструменты анализа и управления данными на базе ИИ.</p>
            <h2>📖 Пошаговое руководство:</h2>
            <ul>
                <li>Перейдите на страницу Airdrop по кнопке "Сайт проекта".</li>
                <li>Подключите свой Web3 кошелек.</li>
                <li>Подключите X (Twitter) и введите свой username из Telegram.</li>
                <li>Сделайте твит о раздаче и скачайте приложение.</li>
            </ul>
            <p style="color: #f59e0b;"><strong>Распределение наград:</strong> 10 победителей × $750, 35 победителей × $500, 42 победителя × $250. Все получают 1 месяц Pro trial!</p>
        `;

        const airdropsData = {
            'mwx': {
                title: 'MWX Loyalty Program',
                icon: 'M',
                iconUrl: 'https://pbs.twimg.com/profile_images/1823020971813543936/IEzxFUOG_400x400.jpg',
                color: 'linear-gradient(135deg, #0369a1, #1e40af)',
                invest: '$100k Pool',
                time: 'До 12 Мар 2026',
                desc: 'Первый децентрализованный <b style="color:#38bdf8">ИИ-маркетплейс</b> готовых бизнес-решений. Призовой пул <b style="color:#38bdf8">$100,000</b> среди активных участников.',
                link: 'https://community.mwxtoken.ai/loyalty?referral_code=AFROLITE',
                reward: 3.50,
                fullArticle: mwxFullArticle,
                steps: [],
                bannerUrl: 'image_2312db.png'
            },
            'wow': {
                title: 'WOW Exchange',
                icon: 'W',
                iconUrl: 'https://pbs.twimg.com/profile_images/1835238971649769472/5mMfqHsN_400x400.jpg',
                color: 'linear-gradient(135deg, #0284c7, #0369a1)',
                invest: '30 WOW / user',
                time: 'Скоро листинг',
                desc: 'Биржа нового поколения с нулевыми комиссиями. <b style="color:#38bdf8">30 WOW</b> за регистрацию + <b style="color:#38bdf8">10 WOW</b> за каждого приглашённого друга.',
                link: 'https://wow-exchange.zendesk.com/hc/en-us/articles/47632708862227',
                reward: 2.00,
                fullArticle: wowFullArticle,
                steps: [],
                bannerUrl: 'image_222d3e.jpg'
            },
            'kova': {
                title: 'Kova Network',
                icon: 'K',
                iconUrl: 'https://pbs.twimg.com/profile_images/1793649578925105152/m6K4HFHZ_400x400.jpg',
                color: 'linear-gradient(135deg, #10b981, #047857)',
                invest: '$10,000 Pool',
                time: 'До 22 Фев 2026',
                desc: 'Децентрализованный вычислительный слой нового поколения. <b style="color:#38bdf8">Мгновенная, масштабируемая</b> и доступная вычислительная мощность для всех.',
                link: 'https://myfanforce.com/onboarding?ref=FT941W54',
                reward: 3.00,
                fullArticle: kovaFullArticle,
                steps: [],
                bannerUrl: 'image_222a5b.jpg'
            },
            'nexira': {
                title: 'Nexira',
                icon: 'N',
                iconUrl: 'https://pbs.twimg.com/profile_images/1826537390553993216/dYf4DNHM_400x400.jpg',
                color: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                invest: 'Locked Ruby',
                time: 'TBA',
                desc: 'Революция кросс-игровой совместимости DAEP. Собирай боксы, получай <b style="color:#38bdf8">Locked Ruby</b> и участвуй в распределении наград TGE.',
                link: 'https://www.nexira.ai/airdrops?refid=9usUIoEb',
                reward: 2.50,
                fullArticle: nexiraFullArticle,
                steps: [],
                bannerUrl: 'image_2229f8.jpg'
            },
            'mercury': {
                title: 'Mercury Quests',
                icon: 'M',
                iconUrl: 'https://pbs.twimg.com/profile_images/1683178732611072001/9Q0YOQRE_400x400.jpg',
                color: 'linear-gradient(135deg, #64748b, #334155)',
                invest: '$35,000 Pool',
                time: 'До 1 Фев 2026',
                desc: 'ИИ-платформа анализа данных с реальными денежными выплатами. <b style="color:#38bdf8">$35,000</b> призового пула + <b style="color:#38bdf8">1 месяц Pro</b> за простые задания.',
                link: 'https://mercury-airdrop.org/',
                reward: 4.00,
                fullArticle: mercuryFullArticle,
                steps: [],
                bannerUrl: 'image_22297e.png'
            }
        };

        let currentActiveDropId = null;
        let selectedFileName = null;

        function renderAirdropsUI() {
            const grid = document.getElementById('mainAirdropsGrid');
            if(!grid) return;
            grid.innerHTML = '';

            for (const [id, data] of Object.entries(airdropsData)) {
                let taskStatus = userTasks[id]?.status || null;
                let btnHtml = '';
                
                let badgeClass = 'status-new';
                let badgeText = 'New';

                if (taskStatus === 'in_progress') { badgeClass = 'status-hot'; badgeText = 'В работе'; }
                else if (taskStatus === 'moderation') { badgeClass = 'status-moderation'; badgeText = 'На модерации'; }
                else if (taskStatus === 'completed') { badgeClass = 'status-completed'; badgeText = 'Выполнено'; }
                else { 
                    if(id === 'mwx' || id === 'wow') { badgeClass = 'status-hot'; badgeText = 'Hot'; }
                }

                if (!isAuth) {
                    btnHtml = `<button class="btn-primary btn-alert" onclick="openLoginModal()">Необходима авторизация</button>`;
                } else if (!taskStatus) {
                    btnHtml = `<button class="btn-primary" onclick="openAirdropDetails('${id}')">Открыть задание</button>`;
                } else if (taskStatus === 'in_progress') {
                    btnHtml = `<button class="btn-secondary" style="color:#f59e0b; border-color:#f59e0b;" onclick="openAirdropDetails('${id}')">В работе (Продолжить)</button>`;
                } else if (taskStatus === 'moderation') {
                    btnHtml = `<button class="btn-secondary" style="color:#a855f7; border-color:#a855f7;" onclick="openAirdropDetails('${id}')">⏳ На проверке</button>`;
                } else if (taskStatus === 'completed') {
                    btnHtml = `<button class="btn-secondary" style="color:#38bdf8; border-color:#38bdf8;" onclick="openAirdropDetails('${id}')">✅ Выполнено</button>`;
                }

                grid.innerHTML += `
                    <div class="airdrop-list-card" onclick="openAirdropDetails('${id}')">
                        <div class="airdrop-img-wrapper">
                            <img src="${data.bannerUrl}" class="airdrop-banner-img" alt="${data.title}" onerror="this.src='https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=900&auto=format&fit=crop';">
                            <div class="airdrop-img-overlay">
                                <button class="airdrop-open-btn" onclick="event.stopPropagation(); openAirdropDetails('${id}')">Открыть задание</button>
                            </div>
                            <div style="position:absolute;top:10px;right:10px;">
                                <span class="airdrop-status ${badgeClass}">${badgeText}</span>
                            </div>
                        </div>
                        <div class="airdrop-card-content">
                            <div class="airdrop-header">
                                <div class="airdrop-title">${data.title}</div>
                            </div>
                            <div class="airdrop-desc">${data.desc}</div>
                            <div class="airdrop-stats">
                                <div class="stat-item"><span class="stat-label">Пул / Награда</span><span class="stat-value">${data.invest}</span></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        function openAirdropDetails(id) {
            if(!isAuth) return openLoginModal();
            currentActiveDropId = id;
            selectedFileName = null;
            document.getElementById('fileNameDisplay').textContent = '';

            const data = airdropsData[id];
            const taskStatus = userTasks[id]?.status || null;

            document.getElementById('adModalIcon').textContent = data.iconUrl ? '' : data.icon;
            document.getElementById('adModalIcon').style.background = data.color;
            if (data.iconUrl) {
                document.getElementById('adModalIcon').innerHTML = `<img src="${data.iconUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.textContent='${data.icon}'">`;
            }
            document.getElementById('adModalTitle').textContent = data.title;
            document.getElementById('adModalDesc').innerHTML = data.desc;

            const stepsContainer = document.getElementById('adModalSteps');
            stepsContainer.innerHTML = ''; 

            if (data.fullArticle) {
                stepsContainer.innerHTML = `<div style="line-height: 1.7; color: #cbd5e1;">${data.fullArticle}</div>`;
            } else if(data.steps && data.steps.length > 0) {
                stepsContainer.innerHTML = '<h3 style="color: #fff; margin-bottom: 15px; font-size: 1.2rem;">Пошаговая инструкция:</h3>';
                data.steps.forEach((stepText, index) => {
                    stepsContainer.innerHTML += `
                        <div class="instruction-step">
                            <div class="step-number">${index + 1}</div>
                            <div class="step-text">${stepText}</div>
                        </div>
                    `;
                });
            }

            const uploadZone = document.getElementById('uploadZone');
            const actionsBlock = document.getElementById('adModalActions');
            const statusLabel = document.getElementById('adModalStatus');
            actionsBlock.innerHTML = '';

            if (!taskStatus) {
                statusLabel.textContent = "Доступно к выполнению";
                statusLabel.style.color = "#38bdf8";
                uploadZone.style.display = 'none';
                actionsBlock.innerHTML = `<button class="btn-primary" style="flex: 1;" onclick="takeTask('${id}')">Взять в работу</button>`;
            } else if (taskStatus === 'in_progress') {
                statusLabel.textContent = "В работе";
                statusLabel.style.color = "#f59e0b";
                uploadZone.style.display = 'block'; 
                actionsBlock.innerHTML = `
                    <button class="btn-secondary" style="flex: 1;" onclick="window.open('${data.link}', '_blank')">Сайт проекта <i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                    <button class="btn-success" style="flex: 1;" onclick="submitTask('${id}')">Отправить на проверку</button>
                `;
            } else if (taskStatus === 'moderation') {
                statusLabel.textContent = "Ожидает модерации";
                statusLabel.style.color = "#a855f7";
                uploadZone.style.display = 'none';
                actionsBlock.innerHTML = `<button class="btn-secondary" style="flex: 1; cursor: default;">Ваш скриншот проверяется администратором...</button>`;
            } else if (taskStatus === 'completed') {
                statusLabel.textContent = "Успешно выполнено";
                statusLabel.style.color = "#4ade80";
                uploadZone.style.display = 'none';
                actionsBlock.innerHTML = `<button class="btn-secondary" style="flex: 1; color:#4ade80; border-color:#4ade80; cursor: default;">Задание завершено. Награда начислена!</button>`;
            }

            openModal('airdropDetailModal');
        }

        function closeAirdropModal() { closeModal('airdropDetailModal'); }

        function takeTask(id) {
            userTasks[id] = { status: 'in_progress' };
            localStorage.setItem('trustUserTasks', JSON.stringify(userTasks));
            openAirdropDetails(id); 
            renderAirdropsUI();
        }

        function handleFileSelect(event) {
            const file = event.target.files[0];
            if(file) {
                selectedFileName = file.name;
                document.getElementById('fileNameDisplay').textContent = `✅ Файл прикреплен: ${selectedFileName}`;
            }
        }

        function submitTask(id) {
            if(!selectedFileName) {
                showCustomAlert('Прикрепите скриншот', 'Пожалуйста, прикрепите скриншот подтверждения перед отправкой.', 'warning');
                return;
            }
            userTasks[id] = { status: 'moderation', file: selectedFileName };
            localStorage.setItem('trustUserTasks', JSON.stringify(userTasks));
            showCustomAlert('Скриншот отправлен', 'Ожидайте проверки модератором.', 'success');
            openAirdropDetails(id); 
            renderAirdropsUI();
        }

        function renderMyAirdrops() {
            const grid = document.getElementById('myAirdropsGrid');
            if(!grid) return;
            grid.innerHTML = '';
            let hasTasks = false;

            for (const [id, data] of Object.entries(airdropsData)) {
                if (userTasks[id]) {
                    hasTasks = true;
                    const status = userTasks[id].status;
                    let badgeClass, badgeText;
                    if (status === 'in_progress') { badgeClass = 'status-hot'; badgeText = 'В работе'; }
                    else if (status === 'moderation') { badgeClass = 'status-moderation'; badgeText = 'На модерации'; }
                    else if (status === 'completed') { badgeClass = 'status-completed'; badgeText = 'Выполнено'; }

                    grid.innerHTML += `
                        <div class="airdrop-card" style="border-color: rgba(59, 130, 246, 0.4);">
                            <div class="airdrop-header">
                                <div class="airdrop-title" style="font-size: 1.2rem; margin-bottom: 0;">${data.title}</div>
                                <span class="airdrop-status ${badgeClass}">${badgeText}</span>
                            </div>
                            <button class="btn-secondary" style="margin-top: 10px;" onclick="openAirdropDetails('${id}')">Детали задания</button>
                        </div>
                    `;
                }
            }

            if(!hasTasks) {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: rgba(0,0,0,0.3); border-radius: 1.5rem; grid-column: 1 / -1; border: 1px dashed rgba(59,130,246,0.3);">
                        <h3 style="font-size: 1.2rem; color: #fff;">У вас пока нет взятых заданий</h3>
                        <button class="item-button" style="margin-top: 15px;" onclick="switchMainTab('airdrops', document.querySelectorAll('.nav-item')[0])">В каталог</button>
                    </div>
                `;
            }
        }

        function renderAdminPanel() {
            const list = document.getElementById('adminTasksList');
            if(!list) return;
            list.innerHTML = '';
            let hasPending = false;

            for (const [id, data] of Object.entries(airdropsData)) {
                if (userTasks[id] && userTasks[id].status === 'moderation') {
                    hasPending = true;
                    list.innerHTML += `
                        <div class="admin-task-row">
                            <div class="admin-task-info">
                                <strong>Юзер: ${document.getElementById('displayUserName').textContent}</strong>
                                <span>Проект: ${data.title}</span><br>
                                <span>Прикреплен скриншот: <i>${userTasks[id].file}</i></span>
                            </div>
                            <button class="btn-success" style="width: auto; padding: 10px 20px; font-size: 0.9rem;" onclick="adminApproveTask('${id}')">Подтвердить (+${data.reward}$)</button>
                        </div>
                    `;
                }
            }

            if(!hasPending) {
                list.innerHTML = '<p style="color: #64748b; text-align: center;">Нет заданий, ожидающих проверки.</p>';
            }
        }

        function adminApproveTask(id) {
            userTasks[id].status = 'completed';
            localStorage.setItem('trustUserTasks', JSON.stringify(userTasks));
            trustMainBalance += airdropsData[id].reward;
            localStorage.setItem('trustMainBalance', trustMainBalance);
            updateBalanceUI();
            showCustomAlert("Задание подтверждено", "Юзеру начислено $" + airdropsData[id].reward, "success");
            renderAdminPanel(); 
            renderAirdropsUI();
        }

        renderAirdropsUI();

        // Track last seen & init avatar on load
        if(isAuth) {
            localStorage.setItem('trustLastSeen', new Date().toISOString());
            setTimeout(updateHeaderAvatar, 100);
        }

        // ==========================================
        // ЛОГИКА NEON CLOUD MINER
        // ==========================================
        let trustMinerState = localStorage.getItem('trustMinerState') || 'OFFLINE';
        let trustSessionMined = parseFloat(localStorage.getItem('trustSessionMined')) || 0;
        let trustActiveError = JSON.parse(localStorage.getItem('trustActiveError')) || null;
        let minerInterval = null;
        let errorInterval = null;
        let minerActive = false;
        let currentInitStep = parseInt(localStorage.getItem('trustInitStep')) || 0;

        const initSequence = ['connect node', 'auth key', 'bypass sec', 'start miner'];
        const minerErrors = [
            { code: 'ERR-001', msg: 'Connection timeout — pool unreachable', fix: 'net.reconnect --force --pool auto' },
            { code: 'ERR-002', msg: 'GPU driver crash — compute unit offline', fix: 'gpu.reload --driver latest --reset' },
            { code: 'ERR-003', msg: 'Nonce collision in share submission queue', fix: 'miner.flush --nonce-queue --rebuild' },
            { code: 'ERR-004', msg: 'DAG file corrupted — ethash computation failed', fix: 'dag.rebuild --clean --epoch current' },
            { code: 'ERR-005', msg: 'Thread deadlock on worker #3 — CPU stall', fix: 'threads.kill 3 && threads.spawn --replace' },
            { code: 'ERR-006', msg: 'Thermal limit exceeded — core throttled to 40%', fix: 'thermal.override --target 72 --fan max' },
            { code: 'ERR-007', msg: 'RPC endpoint returned 403 — API key rejected', fix: 'auth.rotate --rpc --refresh-token' },
            { code: 'ERR-008', msg: 'Memory overflow in share buffer — OOM kill', fix: 'mem.clear --share-buf && miner.restart' },
            { code: 'ERR-009', msg: 'Stratum handshake failed — protocol mismatch', fix: 'stratum.reinit --protocol v2 --retry 5' },
            { code: 'ERR-010', msg: 'Clock sync error — timestamp drift exceeds 30s', fix: 'sys.sync --ntp pool.ntp.org --force' }
        ];

        const termOut = document.getElementById('termOut');
        const termIn = document.getElementById('termIn');

        function writeLog(text, color = '#4ade80') {
            if(!termOut) return;
            const p = document.createElement('p');
            p.innerHTML = text;
            p.style.color = color;
            termOut.appendChild(p);
            termOut.scrollTop = termOut.scrollHeight;
        }

        // Track which initial errors have been fixed
        var initErrorsFixed = JSON.parse(localStorage.getItem('trustInitErrorsFixed') || '[]');

        function renderErrorLog() {
            var list = document.getElementById('errorLogList');
            if (!list) return;
            list.innerHTML = '';

            // Mode A: initial setup — show all 10, user must fix all to unlock
            if (!minerInitComplete()) {
                var remaining = minerErrors.filter(function(e) {
                    return initErrorsFixed.indexOf(e.code) === -1;
                });
                var fixed = minerErrors.filter(function(e) {
                    return initErrorsFixed.indexOf(e.code) !== -1;
                });
                list.innerHTML = '<div style="color:#f59e0b;font-family:monospace;font-size:0.7rem;font-weight:700;letter-spacing:1px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(245,158,11,0.15);">' +
                    'SYSTEM CHECK — FIX ALL ERRORS TO LAUNCH<br>' +
                    '<span style="color:#64748b;font-weight:400;">' + fixed.length + '/10 fixed</span></div>';
                minerErrors.forEach(function(e, i) {
                    var isFixed = initErrorsFixed.indexOf(e.code) !== -1;
                    list.innerHTML +=
                        '<div class="error-item' + (isFixed ? ' resolved' : '') + '" id="errItem'+i+'">' +
                            '<div class="error-code">' + e.code + '</div>' +
                            '<div class="error-desc">' + e.msg + '</div>' +
                            '<button class="error-fix-btn" id="fixBtn'+i+'" onclick="applyInitFix('+i+')"' + (isFixed ? ' disabled' : '') + '>' +
                                (isFixed ? 'FIXED ✓' : '$ ' + e.fix) +
                            '</button>' +
                        '</div>';
                });
                return;
            }

            // Mode B: runtime — show active error or clean state
            if (!trustActiveError) {
                list.innerHTML = '<div style="color:rgba(16,185,129,0.6);font-family:monospace;font-size:0.72rem;text-align:center;padding:20px 0;">' +
                    '<div style="font-size:1.4rem;margin-bottom:6px;">✓</div>' +
                    'NO ACTIVE ERRORS<br><span style="color:#334155;font-size:0.65rem;">System nominal</span>' +
                    '</div>';
                return;
            }
            // Single runtime error
            var e = trustActiveError;
            var idx = minerErrors.findIndex(function(x){ return x.code === e.code; });
            list.innerHTML =
                '<div style="color:#f87171;font-family:monospace;font-size:0.7rem;font-weight:700;letter-spacing:2px;margin-bottom:8px;">RUNTIME ERROR — MINING HALTED</div>' +
                '<div class="error-item" id="errItemActive" style="border-color:rgba(239,68,68,0.5);">' +
                    '<div class="error-code" style="font-size:0.85rem;">' + e.code + '</div>' +
                    '<div class="error-desc" style="color:#e2e8f0;margin:6px 0 10px;">' + e.msg + '</div>' +
                    '<button class="error-fix-btn" id="fixBtnActive" onclick="applyFix('+idx+')" ' +
                        'style="width:100%;padding:8px;font-size:0.78rem;background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.5);color:#10b981;">' +
                        '▶ APPLY FIX<br><span style="font-size:0.65rem;opacity:0.7;">$ ' + e.fix + '</span>' +
                    '</button>' +
                '</div>';
        }

        function minerInitComplete() {
            return initErrorsFixed.length >= minerErrors.length;
        }

        function applyInitFix(i) {
            var e = minerErrors[i];
            if (initErrorsFixed.indexOf(e.code) !== -1) return;
            writeLog('[FIX] $ ' + e.fix, '#4ade80');
            writeLog('[OK] ' + e.code + ' — resolved', '#4ade80');
            initErrorsFixed.push(e.code);
            localStorage.setItem('trustInitErrorsFixed', JSON.stringify(initErrorsFixed));
            renderErrorLog();
            // All fixed — auto-boot mining
            if (minerInitComplete()) {
                writeLog('[SYSTEM] All system checks passed. Initializing node...', '#4ade80');
                setTimeout(function() { bootMiner(); }, 600);
            }
        }

        function applyFix(i) {
            var e = minerErrors[i];
            writeLog('[CMD] $ ' + e.fix, '#4ade80');
            setTimeout(function() {
                writeLog('[OK] ' + e.code + ' resolved — system stabilized', '#4ade80');
                var item = document.getElementById('errItem'+i);
                var btn = document.getElementById('fixBtn'+i);
                if (item) item.classList.add('resolved');
                if (btn) { btn.textContent = 'FIXED ✓'; btn.disabled = true; }
                // Only resume if this was the active error
                if (trustActiveError && trustActiveError.code === e.code) {
                    trustActiveError = null;
                    localStorage.removeItem('trustActiveError');
                    setTimeout(function() {
                        writeLog('[SYSTEM] Error cleared. Resuming mining...', '#4ade80');
                        renderErrorLog();
                        trustMinerState = 'MINING';
                        localStorage.setItem('trustMinerState', 'MINING');
                        updateMinerStatusBar('RUNNING');
                        // Sync card buttons
                        var cardStart = document.getElementById('minerStartBtn');
                        var cardStop  = document.getElementById('minerStopBtn');
                        if (cardStart) cardStart.style.display = 'none';
                        if (cardStop)  { cardStop.style.display = 'flex'; }
                        // Refresh error panel to show clean state
                        renderErrorLog();
                        // Restart mining loop (will also schedule next error)
                        startMiningLoop();
                    }, 800);
                }
            }, 600);
        }

        function updateMinerStatusBar(status) {
            var dot = document.getElementById('minerStatusDot');
            var txt = document.getElementById('minerStatusText');
            var mStart = document.getElementById('modalStartBtn');
            var mStop = document.getElementById('modalStopBtn');
            if (status === 'RUNNING') {
                if (dot) dot.style.background = '#38bdf8';
                if (txt) txt.textContent = 'STATUS: RUNNING';
                if (mStart) mStart.style.display = 'none';
                if (mStop) mStop.style.display = 'inline-block';
            } else {
                if (dot) dot.style.background = '#ef4444';
                if (txt) txt.textContent = 'STATUS: STOPPED';
                if (mStart) mStart.style.display = 'inline-block';
                if (mStop) mStop.style.display = 'none';
            }
        }

        function updateServerBuyButtons() {
            var plans = [
                { plan: 'starter', price: 50 },
                { plan: 'pro',     price: 150 },
                { plan: 'elite',   price: 300 }
            ];
            plans.forEach(function(p) {
                var card = document.getElementById('plan-' + p.plan);
                if (!card) return;
                var btn = card.querySelector('.server-buy-btn');
                if (!btn) return;
                if (trustMainBalance < p.price) {
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                    btn.style.cursor = 'not-allowed';
                    btn.style.filter = 'grayscale(0.6)';
                    btn.title = 'Недостаточно средств';
                    if (!btn.querySelector('.btn-insufficient')) {
                        var hint = document.createElement('span');
                        hint.className = 'btn-insufficient';
                        hint.style.cssText = 'display:block;font-size:0.65rem;font-weight:600;opacity:0.8;margin-top:2px;';
                        hint.textContent = '⚠ Недостаточно средств';
                        btn.appendChild(hint);
                    }
                } else {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.style.filter = 'none';
                    btn.title = '';
                    var hint = btn.querySelector('.btn-insufficient');
                    if (hint) hint.remove();
                }
            });
        }

        function openMiner() {
            openModal('minerModal');
            updateServerBuyButtons();
            renderErrorLog();
            if (trustMinerState === 'MINING') {
                updateMinerStatusBar('RUNNING');
                writeLog('[SYSTEM] Node re-connected. Mining in progress...', '#4ade80');
                startMiningLoop();
            } else if (trustMinerState === 'ERROR') {
                updateMinerStatusBar('STOPPED');
                writeLog('[CRITICAL] ' + (trustActiveError ? trustActiveError.msg : 'Unknown error'), '#f87171');
                writeLog('[SYSTEM] Fix the error in the right panel to resume.', '#4ade80');
            } else if (!minerInitComplete()) {
                // First launch — show all 10 errors, require fixing them all
                updateMinerStatusBar('STOPPED');
                writeLog('[SYSTEM] Neon Cloud Miner v3.2.1', '#4ade80');
                writeLog('[SYSTEM] System diagnostic found 10 errors. Fix all to launch.', '#f87171');
                writeLog('[INFO] Click each fix button in the right panel →', '#4ade80');
            } else {
                // Init done but not running — boot
                bootMiner();
            }
        }

        function bootMiner() {
            updateMinerStatusBar('STOPPED');
            writeLog('[BOOT] Neon Cloud Miner v3.2.1 initializing...', '#4ade80');
            setTimeout(function() { writeLog('[BOOT] Loading kernel modules... OK', '#4ade80'); }, 300);
            setTimeout(function() { writeLog('[BOOT] Detecting hardware... OK', '#4ade80'); }, 700);
            setTimeout(function() {
                var algoNames = {sha256:'SHA-256',ethash:'Ethash',randomx:'RandomX',scrypt:'Scrypt'};
                var poolNames = {eu:'Neon Pool EU',us:'Neon Pool US',asia:'Neon Pool ASIA',solo:'Solo Mining'};
                var algo = (minerCfg && minerCfg.algo) || 'sha256';
                var pool = (minerCfg && minerCfg.pool) || 'eu';
                var gpu  = (minerCfg && minerCfg.gpu)  || 65;
                var temp = (minerCfg && minerCfg.temp) || 75;
                writeLog('[BOOT] Config: ' + (algoNames[algo]||algo) + ' | GPU ' + gpu + '% | ' + (poolNames[pool]||pool) + ' | ' + temp + '°C', '#4ade80');
            }, 1100);
            setTimeout(function() {
                writeLog('[BOOT] Connecting to pool... OK', '#4ade80');
                writeLog('[BOOT] Auth OK. Launching workers...', '#4ade80');
            }, 1600);
            setTimeout(function() {
                trustMinerState = 'MINING';
                localStorage.setItem('trustMinerState', 'MINING');
                writeLog('[SYSTEM] Mining started. Workers active.', '#4ade80');
                updateMinerStatusBar('RUNNING');
                startMiningLoop();
                var cardStart = document.getElementById('minerStartBtn');
                var cardStop  = document.getElementById('minerStopBtn');
                if (cardStart) cardStart.style.display = 'none';
                if (cardStop)  { cardStop.style.display = 'flex'; }
            }, 2200);
        }

        function closeMiner() {
            // Stop loop immediately
            stopMiningLoop();
            closeModal('minerModal');
            // Reset state — mining only works while console is open
            trustMinerState = 'OFFLINE';
            localStorage.setItem('trustMinerState', 'OFFLINE');
            // Sync card buttons to START
            var cardStart = document.getElementById('minerStartBtn');
            var cardStop  = document.getElementById('minerStopBtn');
            if (cardStart) { cardStart.style.display = 'flex'; }
            if (cardStop)  { cardStop.style.display  = 'none'; }
        }

        if (termIn) {
            termIn.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const cmd = this.value.trim().toLowerCase();
                    this.value = '';
                    if(!cmd) return;
                    writeLog(`root@trustnode:~# ${cmd}`, '#4ade80');
                    processCommand(cmd);
                }
            });
        }

        function processCommand(cmd) {
            if (cmd === 'help') {
                if (trustMinerState === 'ERROR') {
                    writeLog(`[HELP] To fix ${trustActiveError.code}, enter: ${trustActiveError.fix}`, '#4ade80');
                } else if (trustMinerState === 'OFFLINE' || trustMinerState === 'INIT') {
                    writeLog(`[HELP] Next init command: ${initSequence[currentInitStep]}`, '#4ade80');
                } else if (trustMinerState === 'MINING') {
                    writeLog(`[HELP] System is running normally. Mining in progress.`, '#4ade80');
                }
                return;
            }
            if (trustMinerState === 'ERROR') {
                if (cmd === trustActiveError.fix) {
                    writeLog('[SYSTEM] Error resolved. Resuming mining...', '#4ade80');
                    trustMinerState = 'MINING';
                    trustActiveError = null;
                    localStorage.setItem('trustMinerState', 'MINING');
                    localStorage.removeItem('trustActiveError');
                    startMiningLoop();
                } else {
                    writeLog('[ERROR] Invalid fix command. Type "help".', '#f87171');
                }
                return;
            }
            if (trustMinerState === 'OFFLINE' || trustMinerState === 'INIT') {
                if (cmd === initSequence[currentInitStep]) {
                    writeLog(`[SYSTEM] Command accepted: ${cmd}`, '#4ade80');
                    currentInitStep++;
                    localStorage.setItem('trustInitStep', currentInitStep);
                    trustMinerState = 'INIT';
                    localStorage.setItem('trustMinerState', 'INIT');
                    if (currentInitStep >= initSequence.length) {
                        writeLog('[SYSTEM] Initialization complete. MINING STARTED.', '#4ade80');
                        trustMinerState = 'MINING';
                        localStorage.setItem('trustMinerState', 'MINING');
                        updateMinerStatusBar('RUNNING');
                        startMiningLoop();
                        var cardStart = document.getElementById('minerStartBtn');
                        var cardStop  = document.getElementById('minerStopBtn');
                        if (cardStart) cardStart.style.display = 'none';
                        if (cardStop)  { cardStop.style.display = 'flex'; }
                    }
                } else {
                    writeLog('[ERROR] Invalid sequence. Type "help".', '#f87171');
                }
                return;
            }
            if (trustMinerState === 'MINING') {
                writeLog(`[SYSTEM] Command not found or not permitted during mining.`, '#4ade80');
            }
        }


        // Direct start from modal START button
        function startMinerDirect() {
            if (trustMinerState === 'MINING') return;
            if (trustMinerState === 'ERROR') {
                writeLog('[ERROR] Fix the active error in the panel on the right.', '#f87171');
                return;
            }
            if (!minerInitComplete()) {
                writeLog('[ERROR] Fix all 10 system errors first (right panel).', '#f87171');
                return;
            }
            bootMiner();
        }

        function startMiningLoop() {
            if (minerInterval) clearInterval(minerInterval);
            if (errorInterval) clearInterval(errorInterval);

            // Compute effective hashrate from server plan + GPU intensity
            var baseHash = { starter: 120, pro: 480, elite: 1200 }[purchasedServer || 'starter'] || 120;
            var gpuMult = ((minerCfg && minerCfg.gpu) || 65) / 100;
            var threadBonus = minerCfg && minerCfg.threads === '16' ? 1.15 : minerCfg && minerCfg.threads === '8' ? 1.08 : minerCfg && minerCfg.threads === '4' ? 1.03 : 1.0;
            var effectiveHash = baseHash * gpuMult * threadBonus;

            // Earnings per tick depend on algo and hashrate
            var algoMultiplier = { sha256: 1.0, ethash: 0.85, randomx: 0.6, scrypt: 0.75 }[(minerCfg && minerCfg.algo) || 'sha256'] || 1.0;
            var earningsPerTick = (effectiveHash / 120) * 0.0005 * algoMultiplier; // ~$0.0005/sec per 120MH/s

            // Pool latency affects share acceptance rate
            var poolAcceptRate = { eu: 0.22, us: 0.18, asia: 0.15, solo: 0.05 }[(minerCfg && minerCfg.pool) || 'eu'] || 0.22;

            // Stealth affects terminal log verbosity
            var stealthMode = (minerCfg && minerCfg.stealth) || 'active';

            var algoNames = { sha256:'SHA-256', ethash:'Ethash', randomx:'RandomX', scrypt:'Scrypt' };
            var poolNames = { eu:'Neon Pool EU (12ms)', us:'Neon Pool US (68ms)', asia:'Neon Pool ASIA (120ms)', solo:'Solo (no pool)' };

            writeLog('[NODE] Applying configuration to kernel...', '#4ade80');
            writeLog('[NODE] · Algo: ' + (algoNames[(minerCfg&&minerCfg.algo)||'sha256']) + ' | Hashrate: ~' + effectiveHash.toFixed(0) + ' MH/s | Pool: ' + (poolNames[(minerCfg&&minerCfg.pool)||'eu']), '#4ade80');
            writeLog('[NODE] · GPU: ' + ((minerCfg&&minerCfg.gpu)||65) + '% | Temp limit: ' + ((minerCfg&&minerCfg.temp)||75) + '°C | DDoS: Level ' + ((minerCfg&&minerCfg.ddos)||3), '#4ade80');
            if (stealthMode === 'active') writeLog('[STEALTH] Process masked as svchost.exe ✓', '#4ade80');

            var shares = 0;
            var sessionEarned = 0;
            var ticks = 0;
            minerActive = true;
            minerInterval = setInterval(() => {
                // Hard stop — both state and flag must be active
                if (!minerActive || trustMinerState !== 'MINING') {
                    clearInterval(minerInterval);
                    minerInterval = null;
                    return;
                }

                trustMainBalance += earningsPerTick;
                trustSessionMined += earningsPerTick;
                sessionEarned += earningsPerTick;
                localStorage.setItem('trustMainBalance', trustMainBalance.toFixed(8));
                localStorage.setItem('trustSessionMined', trustSessionMined.toFixed(8));
                updateBalanceUI();

                // Update hashrate display in modal
                var hEl = document.getElementById('minerHashDisplay');
                var jitter = (Math.random() * 8 - 4);
                if (hEl) hEl.textContent = (effectiveHash + jitter).toFixed(1) + ' MH/s';

                // Update uptime counter
                var uEl = document.getElementById('minerUptime');
                if (uEl) {
                    var secs = parseInt(uEl.getAttribute('data-secs') || 0) + 1;
                    uEl.setAttribute('data-secs', secs);
                    var h = String(Math.floor(secs/3600)).padStart(2,'0');
                    var m = String(Math.floor((secs%3600)/60)).padStart(2,'0');
                    var s = String(secs%60).padStart(2,'0');
                    uEl.textContent = h+':'+m+':'+s;
                }

                ticks++;
                var sEl = document.getElementById('minerSharesDisplay');

                // Log mining earnings to history every 60 ticks (60 sec)
                if (ticks % 60 === 0 && sessionEarned > 0.0001) {
                    logUserAction('Майнинг: +' + sessionEarned.toFixed(6) + '$ за сессию', 'mining', sessionEarned);
                }

                // Every 3 ticks: show mining activity line
                if (ticks % 3 === 0) {
                    var hashNow = (effectiveHash + (Math.random()*8-4)).toFixed(1);
                    var algoShort = {sha256:'SHA-256',ethash:'Ethash',randomx:'RandomX',scrypt:'Scrypt'}[(minerCfg&&minerCfg.algo)||'sha256'] || 'SHA-256';
                    var poolShort = {eu:'EU-POOL',us:'US-POOL',asia:'ASIA-POOL',solo:'SOLO'}[(minerCfg&&minerCfg.pool)||'eu'] || 'EU-POOL';
                    writeLog('[MINING] ' + algoShort + ' | ' + hashNow + ' MH/s | ' + poolShort + ' | +' + (earningsPerTick*3).toFixed(6) + ' USDT | BAL: ' + trustMainBalance.toFixed(4), '#4ade80');
                }

                if (Math.random() < poolAcceptRate) {
                    shares++;
                    if (sEl) sEl.textContent = shares;
                    // Share accepted log every 5 shares
                    if (shares % 5 === 0) {
                        writeLog('[SHARE] Batch x5 accepted · cumulative +' + (earningsPerTick * shares).toFixed(6) + ' USDT', '#4ade80');
                    }
                }
            }, 1000);

            // Schedule ONE random error between 20–60 minutes from now
            function scheduleNextError() {
                var delayMs = (10 + Math.random() * 20) * 60 * 1000; // 10–30 min random
                errorInterval = setTimeout(function() {
                    // Only trigger if still mining
                    if (trustMinerState !== 'MINING') return;
                    // Pick a random error
                    var e = minerErrors[Math.floor(Math.random() * minerErrors.length)];
                    // Set flag FIRST so any in-flight tick sees it immediately
                    minerActive = false;
                    trustMinerState = 'ERROR';
                    trustActiveError = e;
                    localStorage.setItem('trustMinerState', 'ERROR');
                    localStorage.setItem('trustActiveError', JSON.stringify(e));
                    // Kill the interval
                    if (minerInterval) { clearInterval(minerInterval); minerInterval = null; }
                    // Log error
                    writeLog('', '#4ade80');
                    writeLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#ef4444');
                    writeLog('[CRITICAL ERROR] ' + e.code + ': ' + e.msg, '#f87171');
                    writeLog('[SYSTEM] MINING STOPPED — fix the error to resume.', '#f87171');
                    writeLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#ef4444');
                    // Update status bar and card buttons
                    updateMinerStatusBar('STOPPED');
                    var cStart = document.getElementById('minerStartBtn');
                    var cStop  = document.getElementById('minerStopBtn');
                    if (cStart) { cStart.style.display = 'flex'; }
                    if (cStop)  { cStop.style.display  = 'none'; }
                    // Show the error in right panel
                    renderErrorLog();
                }, delayMs);
            }
            scheduleNextError();
        }

        function stopMiningLoop() {
            minerActive = false;
            if (minerInterval) { clearInterval(minerInterval); minerInterval = null; }
            if (errorInterval) { clearTimeout(errorInterval); clearInterval(errorInterval); errorInterval = null; }
        }

        // ==========================================
        // ЛОГИКА ARBITRAGE SCANNER v1.0
        // ==========================================
        let arbInterval;
        let activeGreenCodes = [];
        let savedArbDatabase = JSON.parse(localStorage.getItem('trustArbDatabase')) || [];
        const arbExchanges = ["BINANCE", "BYBIT", "MEXC", "OKX", "KUCOIN", "HTX", "GATE.IO"];
        const arbCoins = ["BTC", "ETH", "SOL", "ARB", "DOGE", "SUI", "TON", "XRP", "ADA"];

        function openArbScanner() {
            openModal('arbModal');
            renderArbHistory();
            startGeneratingFeed();
        }

        function closeArbScanner() {
            closeModal('arbModal');
            clearInterval(arbInterval);
        }

        function startGeneratingFeed() {
            const feed = document.getElementById('arbFeed');
            if(!feed) return;
            if (arbInterval) clearInterval(arbInterval);

            // Read scanner config
            var cfg = (typeof scannerCfg !== 'undefined') ? scannerCfg : {};
            var freq      = cfg.freq      || 1000;
            var spread    = cfg.spread    || 0.3;
            var minProfit = cfg.profit    || 5;
            var aiMode    = cfg.ai        || 'smart';
            var region    = cfg.region    || 'eu';
            var latency   = cfg.latency   || 'ws';
            var alertMode = cfg.alert     || 'green';
            var assetMode = cfg.assets    || 'top50';
            var exMode    = cfg.exchanges || 'all';

            // Exchange pool depends on setting
            var exPool = arbExchanges;
            if (exMode === 'binance-okx')   exPool = ['BINANCE','OKX'];
            if (exMode === 'binance-bybit') exPool = ['BINANCE','BYBIT'];
            if (exMode === 'okx-kucoin')    exPool = ['OKX','KUCOIN'];

            // Asset pool depends on setting
            var coinPool = arbCoins;
            if (assetMode === 'stable')  coinPool = ['USDT','USDC','DAI','BUSD'];
            if (assetMode === 'btceth')  coinPool = ['BTC','ETH'];
            if (assetMode === 'defi')    coinPool = ['UNI','AAVE','CRV','COMP','SNX','1INCH'];

            // Green signal probability: lower spread threshold = more greens
            var greenChance = spread <= 0.1 ? 0.12 : spread <= 0.3 ? 0.07 : spread <= 0.5 ? 0.05 : 0.03;
            // AI filter: conservative = fewer greens but higher quality
            if (aiMode === 'conservative') greenChance *= 0.5;
            if (aiMode === 'aggressive')   greenChance *= 1.8;

            // Latency label for feed header
            var latLabel = {ws:'WS ~5ms', rest:'REST ~200ms', std:'STD ~500ms'}[latency] || 'WS ~5ms';
            var regionLabel = {eu:'EU-WEST',us:'US-EAST',asia:'SG-ASIA',auto:'AUTO'}[region] || 'EU-WEST';

            // Show config in feed header
            feed.innerHTML = '';
            var header = document.createElement('div');
            header.style.cssText = 'color:#38bdf8;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(56,189,248,0.15);font-size:0.78rem;';
            header.innerHTML = '[SYSTEM] Scanner online · Region: <b>' + regionLabel + '</b> · Latency: <b>' + latLabel + '</b> · Min spread: <b>+' + spread + '%</b> · AI: <b>' + aiMode.toUpperCase() + '</b>';
            feed.appendChild(header);

            // Play alert sound helper
            function playAlert() {
                try {
                    var ctx = new (window.AudioContext || window.webkitAudioContext)();
                    var o = ctx.createOscillator();
                    var g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.frequency.value = 880;
                    g.gain.setValueAtTime(0.3, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    o.start(); o.stop(ctx.currentTime + 0.3);
                } catch(e){}
            }

            arbInterval = setInterval(() => {
                var ex1 = exPool[Math.floor(Math.random() * exPool.length)];
                var ex2 = exPool[Math.floor(Math.random() * exPool.length)];
                while(ex1 === ex2 && exPool.length > 1) ex2 = exPool[Math.floor(Math.random() * exPool.length)];

                var coin = coinPool[Math.floor(Math.random() * coinPool.length)];
                var chance = Math.random();
                var type, htmlText;
                var time = new Date().toLocaleTimeString('ru-RU', { hour12: false });

                if (chance < greenChance) {
                    // Green signal – spread must exceed threshold
                    var profit = (spread + Math.random() * (5.0 - spread)).toFixed(2);
                    var estUsd = (parseFloat(profit) * (minProfit * 2)).toFixed(0);
                    // Skip if estimated USD profit below min
                    if (parseInt(estUsd) < minProfit && aiMode !== 'aggressive') {
                        var tiny = (Math.random() * spread * 0.8).toFixed(2);
                        htmlText = '[' + time + '] [' + ex1 + ' ➔ ' + ex2 + '] | ' + coin + '/USDT | Spread: +' + tiny + '% | STATUS: BELOW THRESHOLD';
                        type = 'scan-grey';
                    } else {
                        var code = coin + '-' + Math.floor(100 + Math.random() * 900) + 'X';
                        activeGreenCodes.push(code);
                        htmlText = '[' + time + '] [' + ex1 + ' ➔ ' + ex2 + '] | ' + coin + '/USDT | Spread: +' + profit + '% | Est: ~$' + estUsd + ' | <b>CODE: ' + code + '</b>';
                        type = 'scan-green';
                        if (alertMode === 'green' || alertMode === 'all') playAlert();
                    }
                } else if (chance < 0.30) {
                    // Red — negative spread
                    var loss = (Math.random() * (3.0 - 0.1) + 0.1).toFixed(2);
                    var reason = aiMode === 'smart' ? ' | REASON: fees+slippage' : '';
                    htmlText = '[' + time + '] [' + ex1 + ' ➔ ' + ex2 + '] | ' + coin + '/USDT | Spread: -' + loss + '%' + reason + ' | STATUS: SKIP';
                    type = 'scan-red';
                    if (alertMode === 'all') playAlert();
                } else {
                    // Grey — below threshold noise
                    var tiny2 = (Math.random() * spread * 0.9).toFixed(2);
                    var reason2 = aiMode === 'smart' ? ' (filtered by AI)' : '';
                    htmlText = '[' + time + '] [' + ex1 + ' ➔ ' + ex2 + '] | ' + coin + '/USDT | Spread: +' + tiny2 + '% | STATUS: IGNORE' + reason2;
                    type = 'scan-grey';
                }

                var p = document.createElement('div');
                p.className = 'scan-line ' + type;
                p.innerHTML = htmlText;
                if(type === 'scan-green') {
                    p.style.cursor = 'pointer';
                    p.onclick = function() {
                        var m = p.innerHTML.match(/CODE: (.*?)(<|$)/);
                        if(m && m[1]) document.getElementById('arbCodeInput').value = m[1].trim();
                    };
                }
                feed.appendChild(p);
                if (feed.children.length > 50) feed.removeChild(feed.children[1]); // keep header
                feed.scrollTop = feed.scrollHeight;
            }, freq);
        }

        function saveArbCode() {
            const inputEl = document.getElementById('arbCodeInput');
            let code = inputEl.value.trim().toUpperCase();
            if (!code) { showArbStatus("Введите код!", "#f87171"); return; }
            if (activeGreenCodes.includes(code)) {
                activeGreenCodes = activeGreenCodes.filter(c => c !== code);
                let time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
                savedArbDatabase.unshift({ code: code, time: time });
                localStorage.setItem('trustArbDatabase', JSON.stringify(savedArbDatabase));
                inputEl.value = '';
                showArbStatus("✅ Сохранено! Скопируйте в чат.", "#4ade80");
                renderArbHistory();
            } else {
                showArbStatus("❌ Недействительный код или убыточная связка!", "#f87171");
                inputEl.value = '';
            }
        }

        function showArbStatus(msg, color) {
            const statusEl = document.getElementById('arbStatusMsg');
            if(!statusEl) return;
            statusEl.textContent = msg;
            statusEl.style.color = color;
            setTimeout(() => statusEl.textContent = '', 3000);
        }

        function renderArbHistory() {
            const list = document.getElementById('arbHistoryList');
            if(!list) return;
            list.innerHTML = '';
            if (savedArbDatabase.length === 0) {
                list.innerHTML = '<div style="text-align:center; color:#64748b; margin-top:20px;">База пуста</div>';
                return;
            }
            savedArbDatabase.forEach((item) => {
                let div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
                    <div>
                        <span style="color:#64748b; font-size:0.8rem;">[${item.time}]</span><br>
                        <strong>${item.code}</strong>
                    </div>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${item.code}').then(()=>showArbStatus('Код ${item.code} скопирован!','#38bdf8'))">Копировать</button>
                `;
                list.appendChild(div);
            });
        }

        // Инициализация
        updateCryptoAddress();
        fetchRealHistory();


        // ===== KYC VERIFICATION =====
        var kycCurrentStep = 1;
        var kycSelectedDoc = 'passport';
        var kycUploaded = { front: false, back: false, selfie: false };
        var kycPhotoData = { front: null, back: null, selfie: null };
        var kycAgeConfirmed = false;

        function kycInit() {
            const status = localStorage.getItem('trustKycStatus'); // null | 'pending' | 'approved' | 'rejected'
            const notVerEl = document.getElementById('kycStatusNotVerified');
            const pendEl   = document.getElementById('kycStatusPending');
            const verEl    = document.getElementById('kycStatusVerified');
            if (notVerEl) notVerEl.style.display = (!status || status === 'rejected') ? 'block' : 'none';
            if (pendEl)   pendEl.style.display   = status === 'pending'  ? 'block' : 'none';
            if (verEl)    verEl.style.display     = status === 'approved' ? 'block' : 'none';
        }

        function kycToggleAge() {
            kycAgeConfirmed = !kycAgeConfirmed;
            var box = document.getElementById('kycAgeBox');
            var lbl = document.getElementById('kycAgeLabel');
            if (!box) return;
            if (kycAgeConfirmed) {
                box.style.background = '#fbbf24';
                box.style.border = 'none';
                box.innerHTML = '<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="#000" stroke-width="2.2" stroke-linecap="round"/></svg>';
                lbl.style.borderColor = 'rgba(251,191,36,0.4)';
                lbl.style.background  = 'rgba(251,191,36,0.08)';
            } else {
                box.style.background = 'rgba(100,116,139,0.2)';
                box.style.border = '2px solid rgba(100,116,139,0.4)';
                box.innerHTML = '';
                lbl.style.borderColor = 'rgba(251,191,36,0.2)';
                lbl.style.background  = 'rgba(251,191,36,0.06)';
            }
        }

        function kycSelectDoc(type, el) {
            kycSelectedDoc = type;
            ['passport','idcard','drivelic'].forEach(function(d) {
                var card  = document.getElementById('kycDoc' + d.charAt(0).toUpperCase() + d.slice(1));
                var check = document.getElementById('kycDocCheck-' + d);
                if (!card || !check) return;
                if (d === type) {
                    card.style.background   = 'rgba(59,130,246,0.08)';
                    card.style.borderColor  = 'rgba(59,130,246,0.4)';
                    card.querySelector('i').style.color = '#38bdf8';
                    check.style.background  = '#3b82f6';
                    check.style.border      = 'none';
                    check.innerHTML = '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
                } else {
                    card.style.background   = 'rgba(100,116,139,0.05)';
                    card.style.borderColor  = 'rgba(100,116,139,0.2)';
                    card.querySelector('i').style.color = '#94a3b8';
                    check.style.background  = 'rgba(100,116,139,0.2)';
                    check.style.border      = '1.5px solid rgba(100,116,139,0.3)';
                    check.innerHTML = '';
                }
            });
        }

        function kycNextStep(step) {
            for (var i = 1; i <= 4; i++) {
                var el = document.getElementById('kycStep' + i);
                if (el) el.style.display = 'none';
            }
            var target = document.getElementById('kycStep' + step);
            if (target) target.style.display = 'block';
            kycCurrentStep = step;
            for (var i = 1; i <= 4; i++) {
                var dot  = document.getElementById('kycDot' + i);
                var line = document.getElementById('kycLine' + i);
                if (!dot) continue;
                if (i < step) {
                    dot.style.background  = 'linear-gradient(135deg,#4ade80,#22c55e)';
                    dot.style.border      = 'none';
                    dot.style.color       = '#fff';
                    dot.style.boxShadow   = '0 0 10px rgba(74,222,128,0.4)';
                    dot.innerHTML = '<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>';
                } else if (i === step) {
                    dot.style.background  = 'linear-gradient(135deg,#3b82f6,#6366f1)';
                    dot.style.border      = 'none';
                    dot.style.color       = '#fff';
                    dot.style.boxShadow   = '0 0 12px rgba(99,102,241,0.5)';
                    dot.innerHTML = i;
                } else {
                    dot.style.background  = 'rgba(100,116,139,0.2)';
                    dot.style.border      = '2px solid rgba(100,116,139,0.3)';
                    dot.style.color       = '#64748b';
                    dot.style.boxShadow   = 'none';
                    dot.innerHTML = i;
                }
                if (line) {
                    line.style.background = i < step
                        ? 'linear-gradient(90deg,#4ade80,#22c55e)'
                        : i === step
                            ? 'linear-gradient(90deg,#6366f1,rgba(100,116,139,0.3))'
                            : 'rgba(100,116,139,0.3)';
                }
            }
        }

        function kycValidateStep2() {
            var ln      = (document.getElementById('kycLastName')  || {}).value || '';
            var fn      = (document.getElementById('kycFirstName') || {}).value || '';
            var dob     = (document.getElementById('kycDob')       || {}).value || '';
            if (!ln.trim() || !fn.trim() || !dob) {
                [document.getElementById('kycLastName'), document.getElementById('kycFirstName'), document.getElementById('kycDob')].forEach(function(f) {
                    if (f && !f.value.trim()) {
                        f.style.borderColor = '#f87171';
                        f.style.boxShadow = '0 0 8px rgba(248,113,113,0.2)';
                        setTimeout(function() { if(f){ f.style.borderColor='rgba(100,116,139,0.3)'; f.style.boxShadow='none'; } }, 2000);
                    }
                });
                return;
            }
            // 18+ check
            if (!kycAgeConfirmed) {
                var lbl = document.getElementById('kycAgeLabel');
                if (lbl) {
                    lbl.style.borderColor = '#f87171';
                    lbl.style.background = 'rgba(248,113,113,0.06)';
                    setTimeout(function() { if(lbl){ lbl.style.borderColor='rgba(251,191,36,0.2)'; lbl.style.background='rgba(251,191,36,0.06)'; } }, 2000);
                }
                return;
            }
            // Age 18+ date check
            var birthDate = new Date(dob);
            var today = new Date();
            var age = today.getFullYear() - birthDate.getFullYear();
            var m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            if (age < 18) {
                var dobEl = document.getElementById('kycDob');
                if (dobEl) { dobEl.style.borderColor='#f87171'; dobEl.style.boxShadow='0 0 8px rgba(248,113,113,0.2)'; }
                showCustomAlert('Ограничение возраста', 'Вам должно быть не менее 18 лет для прохождения верификации.', 'error');
                return;
            }
            kycNextStep(3);
        }

        function kycHandleFile(type, input) {
            if (!input.files || !input.files[0]) return;
            var file = input.files[0];
            var reader = new FileReader();
            reader.onload = function(e) {
                var dataUrl = e.target.result;
                kycPhotoData[type] = dataUrl;
                kycUploaded[type] = true;

                var capType = type.charAt(0).toUpperCase() + type.slice(1);
                var box     = document.getElementById('kycUpload' + capType);
                var icon    = document.getElementById('kycIcon' + capType);
                var label   = document.getElementById('kycLabel' + capType);
                var prevWrap= document.getElementById('kycPreview' + capType + 'Wrap');
                var prevImg = document.getElementById('kycPreview' + capType);

                if (prevImg)  prevImg.src = dataUrl;
                if (prevWrap) prevWrap.style.display = 'block';
                if (icon)     { icon.style.display = 'none'; }
                if (label)    { label.textContent = '✓ Фото загружено'; label.style.color = '#4ade80'; }
                if (box) {
                    box.style.borderColor = 'rgba(74,222,128,0.5)';
                    box.style.background  = 'rgba(74,222,128,0.05)';
                }
            };
            reader.readAsDataURL(file);
        }

        function kycSubmit() {
            if (!kycUploaded.front || !kycUploaded.back || !kycUploaded.selfie) {
                var errEl = document.getElementById('kycUploadError');
                if (errEl) { errEl.style.display = 'block'; setTimeout(function() { errEl.style.display = 'none'; }, 3000); }
                return;
            }
            kycNextStep(4);

            // Animate checklist steps
            var steps = [
                { id:'kycCheck1', delay:1200, okText:'Файлы получены ✓' },
                { id:'kycCheck2', delay:2600, okText:'Данные записаны ✓' },
                { id:'kycCheck3', delay:3800, okText:'Передано администратору ✓' }
            ];
            steps.forEach(function(s, idx) {
                setTimeout(function() {
                    var el = document.getElementById(s.id);
                    if (!el) return;
                    el.style.opacity = '1';
                    el.style.borderColor = 'rgba(74,222,128,0.3)';
                    el.style.background  = 'rgba(74,222,128,0.06)';
                    el.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#4ade80;font-size:0.9rem;"></i><span style="color:#4ade80;font-size:0.82rem;font-weight:600;">' + s.okText + '</span>';
                    // Start spinner on next if exists
                    if (idx + 1 < steps.length) {
                        var next = document.getElementById(steps[idx+1].id);
                        if (next) {
                            next.style.opacity = '1';
                            next.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="color:#6366f1;font-size:0.9rem;"></i><span style="color:#94a3b8;font-size:0.82rem;">' + (['Сохранение данных...','Проверка формата...','Отправка заявки...'][idx+1] || '...') + '</span>';
                        }
                    }
                }, s.delay);
            });

            // Show success + save to localStorage
            setTimeout(function() {
                var proc = document.getElementById('kycProcessingView');
                var succ = document.getElementById('kycSuccessView');
                if (proc) proc.style.display = 'none';
                if (succ) succ.style.display  = 'block';

                // Save KYC data to localStorage (as pending)
                var kycData = {
                    id:        Date.now(),
                    userId:    localStorage.getItem('trustUserId') || 'unknown',
                    userName:  localStorage.getItem('trustUserName') || 'Аноним',
                    email:     localStorage.getItem('trustUserEmail') || '—',
                    docType:   kycSelectedDoc,
                    lastName:  document.getElementById('kycLastName')  ? document.getElementById('kycLastName').value  : '',
                    firstName: document.getElementById('kycFirstName') ? document.getElementById('kycFirstName').value : '',
                    dob:       document.getElementById('kycDob')       ? document.getElementById('kycDob').value       : '',
                    photoFront:  kycPhotoData.front,
                    photoBack:   kycPhotoData.back,
                    photoSelfie: kycPhotoData.selfie,
                    status:    'pending',
                    submittedAt: new Date().toLocaleString('ru-RU')
                };
                // Save to pending list
                var pendingList = JSON.parse(localStorage.getItem('trustKycRequests') || '[]');
                pendingList.push(kycData);
                localStorage.setItem('trustKycRequests', JSON.stringify(pendingList));
                localStorage.setItem('trustKycStatus', 'pending');

                // Show pending block after animation
                setTimeout(function() {
                    var notVerEl = document.getElementById('kycStatusNotVerified');
                    var pendEl   = document.getElementById('kycStatusPending');
                    if (notVerEl) notVerEl.style.display = 'none';
                    if (pendEl)   pendEl.style.display   = 'block';
                    // Update admin badge
                    adminRenderKyc();
                }, 2500);
            }, 5000);
        }

        // ===== ADMIN KYC =====
        var kycShowProcessed = false;

        function toggleKycProcessed() {
            kycShowProcessed = !kycShowProcessed;
            var btn = document.getElementById('kycToggleProcessedBtn');
            if (btn) {
                if (kycShowProcessed) {
                    btn.innerHTML = '<i class="fa-solid fa-eye-slash" style="margin-right:5px;"></i>Скрыть обработанные';
                    btn.style.background = 'rgba(248,113,113,0.08)';
                    btn.style.color = '#f87171';
                    btn.style.borderColor = 'rgba(248,113,113,0.2)';
                } else {
                    btn.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:5px;"></i>Посмотреть обработанные';
                    btn.style.background = 'rgba(168,85,247,0.08)';
                    btn.style.color = '#a855f7';
                    btn.style.borderColor = 'rgba(168,85,247,0.2)';
                }
            }
            adminRenderKyc();
        }

        function adminRenderKyc() {
            var list = JSON.parse(localStorage.getItem('trustKycRequests') || '[]');
            var pending = list.filter(function(r) { return r.status === 'pending'; });
            ['kycPendingBadge'].forEach(function(id) {
                var b = document.getElementById(id);
                if (b) b.textContent = pending.length;
            });
            var tabBadge = document.getElementById('kycTabBadge');
            if (tabBadge) {
                tabBadge.textContent = pending.length;
                tabBadge.style.display = pending.length > 0 ? 'inline-flex' : 'none';
            }

            var container = document.getElementById('adminKycList');
            if (!container) return;

            var displayList = kycShowProcessed ? list : list.filter(function(r) { return r.status === 'pending'; });

            if (displayList.length === 0) {
                container.innerHTML = '<div style="color:#475569;font-size:0.85rem;text-align:center;padding:20px;">' + (kycShowProcessed ? 'Нет заявок на верификацию' : 'Нет необработанных заявок') + '</div>';
                return;
            }
            var docNames = { passport:'Паспорт', idcard:'ID-карта', drivelic:'Вод. права' };
            container.innerHTML = displayList.slice().reverse().map(function(r, idx) {
                var realIdx = list.indexOf(r);
                var isProcessed = r.status !== 'pending';
                var cardStyle = isProcessed 
                    ? 'background:rgba(9,14,28,0.4);border:1px solid rgba(255,255,255,0.03);border-radius:14px;padding:18px;transition:0.2s;opacity:0.55;' 
                    : 'background:rgba(9,14,28,0.7);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px;transition:0.2s;';
                var statusBadge = r.status === 'pending'
                    ? '<span style="background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700;">⏳ На проверке</span>'
                    : r.status === 'approved'
                    ? '<span style="background:rgba(74,222,128,0.12);color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700;">✔ Одобрено</span>'
                    : '<span style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700;">✗ Отклонено</span>';
                var processedLabel = isProcessed && r.decidedAt ? '<div style="color:#334155;font-size:0.68rem;margin-top:4px;">Обработано: ' + r.decidedAt + '</div>' : '';
                var btns = r.status === 'pending'
                    ? '<div style="display:flex;gap:8px;margin-top:14px;">'
                      + '<button onclick="adminKycDecide(' + realIdx + ',\'approved\')" style="flex:1;background:linear-gradient(135deg,rgba(74,222,128,0.15),rgba(16,185,129,0.1));color:#4ade80;border:1px solid rgba(74,222,128,0.35);border-radius:10px;padding:9px;font-weight:800;font-size:0.82rem;cursor:pointer;transition:0.2s;" onmouseover="this.style.background=\'rgba(74,222,128,0.25)\'" onmouseout="this.style.background=\'rgba(74,222,128,0.15)\'"><i class="fa-solid fa-check" style="margin-right:5px;"></i>Верифицировать</button>'
                      + '<button onclick="adminKycDecide(' + realIdx + ',\'rejected\')" style="flex:1;background:rgba(248,113,113,0.1);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:9px;font-weight:800;font-size:0.82rem;cursor:pointer;transition:0.2s;" onmouseover="this.style.background=\'rgba(248,113,113,0.2)\'" onmouseout="this.style.background=\'rgba(248,113,113,0.1)\'"><i class="fa-solid fa-xmark" style="margin-right:5px;"></i>Отклонить</button>'
                      + '</div>'
                    : '';
                return '<div style="' + cardStyle + '">'
                    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
                    +   '<div>'
                    +     '<div style="color:#fff;font-weight:700;font-size:0.95rem;">' + (r.lastName||'') + ' ' + (r.firstName||'') + '</div>'
                    +     '<div style="color:#64748b;font-size:0.75rem;margin-top:2px;">' + r.email + ' · ID: ' + r.userId + '</div>'
                    +     '<div style="color:#94a3b8;font-size:0.75rem;margin-top:2px;">Документ: <b style="color:#fff;">' + (docNames[r.docType]||r.docType) + '</b> · ДР: ' + r.dob + '</div>'
                    +     '<div style="color:#475569;font-size:0.72rem;margin-top:2px;">' + r.submittedAt + '</div>'
                    +     processedLabel
                    +   '</div>'
                    +   '<div>' + statusBadge + '</div>'
                    + '</div>'
                    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px;">'
                    +   kycAdminPhoto(r.photoFront,  'Лицевая')
                    +   kycAdminPhoto(r.photoBack,   'Обратная')
                    +   kycAdminPhoto(r.photoSelfie, 'Селфи')
                    + '</div>'
                    + btns
                    + '</div>';
            }).join('');
        }

        function kycAdminPhoto(src, label) {
            if (!src) return '<div style="background:rgba(100,116,139,0.08);border:1px dashed rgba(100,116,139,0.2);border-radius:10px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.72rem;">' + label + '</div>';
            return '<div style="border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);position:relative;aspect-ratio:4/3;cursor:pointer;" onclick="openKycPhotoFull(\'' + src + '\')" title="Открыть полностью">'
                 + '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block;">'
                 + '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:0.65rem;font-weight:600;text-align:center;padding:3px;">' + label + ' <i class="fa-solid fa-up-right-and-down-left-from-center" style="font-size:0.55rem;opacity:0.7;"></i></div>'
                 + '</div>';
        }

        function openKycPhotoFull(src) {
            var existing = document.getElementById('kycPhotoFullModal');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'kycPhotoFullModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px;box-sizing:border-box;';
            modal.onclick = function(){ modal.remove(); };
            var img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain;border-radius:12px;box-shadow:0 0 40px rgba(0,0,0,0.8);';
            modal.appendChild(img);
            var closeBtn = document.createElement('div');
            closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            closeBtn.style.cssText = 'position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.2rem;';
            modal.appendChild(closeBtn);
            document.body.appendChild(modal);
        }

        function adminKycDecide(idx, decision) {
            var list = JSON.parse(localStorage.getItem('trustKycRequests') || '[]');
            if (!list[idx]) return;
            list[idx].status = decision;
            list[idx].decidedAt = new Date().toLocaleString('ru-RU');
            localStorage.setItem('trustKycRequests', JSON.stringify(list));

            // If it's the current user's request — update their verified status
            var myId = localStorage.getItem('trustUserId');
            if (list[idx].userId === myId) {
                if (decision === 'approved') {
                    localStorage.setItem('trustUserVerified', 'true');
                    localStorage.setItem('trustKycStatus', 'approved');
                    // Update profile badges
                    var vBadge  = document.getElementById('verificationBadge');
                    var nvBadge = document.getElementById('notVerifiedBadge');
                    if (vBadge)  vBadge.style.display  = 'flex';
                    if (nvBadge) nvBadge.style.display  = 'none';
                    updateHeaderVerBadge();
                    kycInit();
                } else {
                    localStorage.setItem('trustKycStatus', 'rejected');
                    kycInit();
                }
            }
            adminSysLogAdd('[KYC] Заявка ' + list[idx].userName + ': ' + (decision === 'approved' ? 'ОДОБРЕНА' : 'ОТКЛОНЕНА'), decision === 'approved' ? 'green' : 'red');
            adminRenderKyc();
        }

        function adminClearKycHistory() {
            var list = JSON.parse(localStorage.getItem('trustKycRequests') || '[]');
            var filtered = list.filter(function(r) { return r.status === 'pending'; });
            localStorage.setItem('trustKycRequests', JSON.stringify(filtered));
            adminRenderKyc();
            adminSysLogAdd('[KYC] Обработанные заявки скрыты', 'yellow');
        }

        // ==========================================
        // ADMIN: WITHDRAWALS
        // ==========================================
        var showProcessedWithdrawals = false;

        function adminRenderWithdrawals() {
            var list = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
            var container = document.getElementById('adminWithdrawalsList');
            if (!container) return;
            var pending = list.filter(function(r) { return r.status === 'pending'; });
            var badge = document.getElementById('wdPendingBadge');
            if (badge) badge.textContent = pending.length;
            var tabBadge = document.getElementById('wdTabBadge');
            if (tabBadge) { tabBadge.style.display = pending.length > 0 ? 'flex' : 'none'; tabBadge.textContent = pending.length; }

            var displayList = showProcessedWithdrawals ? list : pending;
            if (!displayList.length) {
                container.innerHTML = '<div style="color:#475569;font-size:0.85rem;text-align:center;padding:40px;background:rgba(0,0,0,0.2);border-radius:14px;border:1px dashed rgba(100,116,139,0.2);"><i class="fa-solid fa-inbox" style="font-size:2rem;color:#334155;display:block;margin-bottom:10px;"></i>' + (showProcessedWithdrawals ? 'Нет запросов' : 'Нет активных запросов') + '</div>';
                return;
            }
            var reversed = displayList.slice().reverse();
            container.innerHTML = reversed.map(function(r) {
                var idx = list.indexOf(r);
                var statusBadge = r.status === 'pending' ? '<span style="background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:3px 10px;font-size:0.72rem;font-weight:700;">\u23f3 Ожидает</span>'
                    : r.status === 'approved' ? '<span style="background:rgba(74,222,128,0.12);color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:8px;padding:3px 10px;font-size:0.72rem;font-weight:700;">\u2714 Выполнено</span>'
                    : '<span style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:3px 10px;font-size:0.72rem;font-weight:700;">\u2717 Отклонено</span>';
                var btns = r.status === 'pending' ? '<div style="display:flex;gap:8px;margin-top:12px;"><button onclick="adminWithdrawDecide(' + idx + ',\'approved\')" style="flex:1;background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.35);border-radius:10px;padding:9px;font-weight:800;font-size:0.82rem;cursor:pointer;"><i class="fa-solid fa-check" style="margin-right:5px;"></i>Подтвердить</button><button onclick="adminWithdrawDecide(' + idx + ',\'rejected\')" style="flex:1;background:rgba(248,113,113,0.1);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:9px;font-weight:800;font-size:0.82rem;cursor:pointer;"><i class="fa-solid fa-xmark" style="margin-right:5px;"></i>Отклонить</button></div>' : '';
                return '<div style="background:rgba(9,14,28,0.8);border:1px solid ' + (r.status==='pending'?'rgba(251,191,36,0.2)':r.status==='approved'?'rgba(74,222,128,0.15)':'rgba(248,113,113,0.15)') + ';border-radius:16px;padding:18px;"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="color:#fff;font-weight:700;font-size:0.95rem;">' + r.userName + ' <span style="color:#38bdf8;font-size:0.8rem;">ID: ' + r.userId + '</span></div><div style="color:#64748b;font-size:0.75rem;margin-top:3px;"><b style="color:#fff;">' + r.amount.toFixed(2) + '$ USDT</b> \u2192 ' + r.address.slice(0,10) + '...' + r.address.slice(-6) + ' <span style="color:#94a3b8;">(' + r.network + ')</span></div><div style="color:#475569;font-size:0.72rem;margin-top:2px;">' + r.createdAt + '</div></div><div>' + statusBadge + '</div></div>' + btns + '</div>';
            }).join('');
        }

        function toggleProcessedWithdrawals() {
            showProcessedWithdrawals = !showProcessedWithdrawals;
            var btn = document.getElementById('toggleProcessedBtn');
            if (btn) btn.textContent = showProcessedWithdrawals ? 'Скрыть отработанные' : 'Показать отработанные';
            adminRenderWithdrawals();
        }

        function adminWithdrawDecide(idx, decision) {
            var list = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
            if (!list[idx]) return;
            list[idx].status = decision;
            list[idx].decidedAt = new Date().toLocaleString('ru-RU');
            localStorage.setItem('trustWithdrawRequests', JSON.stringify(list));

            var myId = localStorage.getItem('trustUserId');
            if (list[idx].userId === myId) {
                if (decision === 'rejected') {
                    trustMainBalance += list[idx].amount;
                    localStorage.setItem('trustMainBalance', trustMainBalance.toFixed(8));
                    updateBalanceUI();
                }
                // Update existing log entry or add new
                var logs = JSON.parse(localStorage.getItem('trustUserLogs') || '[]');
                // Find the original withdraw request log
                var found = false;
                for (var li = 0; li < logs.length; li++) {
                    if (logs[li].type === 'withdraw' && Math.abs((logs[li].amount || 0) - list[idx].amount) < 0.01 && !logs[li].decided) {
                        logs[li].decided = decision;
                        logs[li].action = (decision === 'approved' ? '✔ Вывод выполнен: ' : '✗ Вывод отклонён: ') + list[idx].amount.toFixed(2) + '$ на ' + (list[idx].address||'').slice(0,8) + '...';
                        found = true;
                        break;
                    }
                }
                localStorage.setItem('trustUserLogs', JSON.stringify(logs));
                // Show alert
                if (decision === 'rejected') {
                    showCustomAlert('Вывод отклонён', 'Запрос на вывод $' + list[idx].amount.toFixed(2) + ' отклонён. Средства возвращены на баланс.', 'error');
                } else {
                    showCustomAlert('Вывод выполнен', 'Вывод $' + list[idx].amount.toFixed(2) + ' USDT выполнен!', 'success');
                }
            }
            adminSysLogAdd('[WITHDRAW] ' + list[idx].userName + ': $' + list[idx].amount.toFixed(2) + ' — ' + (decision === 'approved' ? 'ПОДТВЕРЖДЁН' : 'ОТКЛОНЁН'), decision === 'approved' ? 'green' : 'red');
            adminRenderWithdrawals();
            // Refresh history if visible
            if (typeof renderHistory === 'function') renderHistory();
        }

        function adminClearWithdrawals() {
            var list = JSON.parse(localStorage.getItem('trustWithdrawRequests') || '[]');
            var filtered = list.filter(function(r) { return r.status === 'pending'; });
            localStorage.setItem('trustWithdrawRequests', JSON.stringify(filtered));
            adminRenderWithdrawals();
            adminSysLogAdd('[WITHDRAW] Обработанные запросы скрыты', 'yellow');
        }

        // ==========================================
        // ADMIN: TRS COIN MANAGEMENT
        // ==========================================
        function adminInitTrs() {
            var cfg = JSON.parse(localStorage.getItem('trustTrsConfig') || '{}');
            if (!cfg.basePrice) cfg = { basePrice: 0.85, change24h: 14.5, price: 0.97 };
            var priceEl = document.getElementById('adminTrsPrice');
            var changeEl = document.getElementById('adminTrsChange');
            var currentEl = document.getElementById('adminTrsCurrentPrice');
            if (priceEl) priceEl.value = cfg.basePrice || cfg.price || 0.85;
            if (changeEl) changeEl.value = cfg.change24h || 0;
            var realPrice = (cfg.basePrice || cfg.price) * (1 + (cfg.change24h || 0) / 100);
            if (currentEl) currentEl.textContent = realPrice.toFixed(2) + '$';
        }

        function resetTrsData() {
            if (!confirm('Сбросить ВСЕ данные TRS (график, цену, настройки)?')) return;
            localStorage.removeItem('trustTrsConfig');
            localStorage.removeItem('trustTrsChart');
            localStorage.removeItem('trustTrsChartBackup');
            location.reload();
        }

        function adminSaveTrs() {
            var basePrice = parseFloat(document.getElementById('adminTrsPrice').value) || 0.85;
            var change = parseFloat(document.getElementById('adminTrsChange').value) || 0;
            // Real price = base price + change%
            var realPrice = basePrice * (1 + change / 100);
            if (realPrice < 0.001) realPrice = 0.001;
            var cfg = { basePrice: basePrice, change24h: change, price: realPrice };
            localStorage.setItem('trustTrsConfig', JSON.stringify(cfg));
            updateTrsFromAdmin();
            var currentEl = document.getElementById('adminTrsCurrentPrice');
            if (currentEl) currentEl.textContent = realPrice.toFixed(2) + '$';
            adminSysLogAdd('[TRS] Базовая: ' + basePrice.toFixed(2) + '$ → Текущая: ' + realPrice.toFixed(2) + '$ (' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%)', 'green');
            showCustomAlert('TRS обновлён', 'Базовая: ' + basePrice.toFixed(2) + '$ → Текущая: ' + realPrice.toFixed(2) + '$ (' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%)', 'success');
        }

        // ==========================================
        // ADMIN: SUPPORT — TELEGRAM-STYLE CHAT
        // ==========================================
        var adminActiveChat = -1;

        function adminRenderSupport() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var dialogsEl = document.getElementById('adminDialogsList');
            if (!dialogsEl) return;
            var open = tickets.filter(function(t) { return t.status === 'open'; });
            var badge = document.getElementById('supportPendingBadge');
            if (badge) badge.textContent = open.length;
            var tabBadge = document.getElementById('supportTabBadge');
            if (tabBadge) { tabBadge.style.display = open.length > 0 ? 'flex' : 'none'; tabBadge.textContent = open.length; }

            if (!tickets.length) {
                dialogsEl.innerHTML = '<div style="color:#475569;text-align:center;padding:40px;font-size:0.82rem;"><i class="fa-solid fa-inbox" style="font-size:1.5rem;color:#334155;display:block;margin-bottom:8px;"></i>Нет обращений</div>';
                return;
            }
            dialogsEl.innerHTML = tickets.slice().reverse().map(function(t, revIdx) {
                var idx = tickets.length - 1 - revIdx;
                var isActive = idx === adminActiveChat;
                var msgs = t.messages || [];
                var lastMsg = msgs.length > 0 ? msgs[msgs.length-1] : null;
                var lastText = lastMsg ? ((lastMsg.from==='admin' ? 'Вы: ' : '') + lastMsg.text.slice(0,40)) : t.description.slice(0,40);
                var unread = 0;
                var adminLastSeen = parseInt(localStorage.getItem('trustAdminChatLastSeen') || '0');
                msgs.forEach(function(m) { if (m.from === 'user' && (new Date(m.time).getTime() > adminLastSeen)) unread++; });
                var initials = t.userName ? t.userName.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() : '??';
                return '<div onclick="openAdminChat('+idx+')" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);background:'+(isActive?'rgba(37,99,235,0.1)':'transparent')+';transition:0.15s;display:flex;align-items:center;gap:10px;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\''+(isActive?'rgba(37,99,235,0.1)':'transparent')+'\'">'
                    + '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.72rem;color:#fff;flex-shrink:0;">'+initials+'</div>'
                    + '<div style="flex:1;min-width:0;">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:#fff;font-weight:700;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+t.userName+'</span>'
                    + (unread > 0 ? '<span style="background:#f87171;color:#fff;border-radius:50%;min-width:18px;height:18px;font-size:0.6rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+unread+'</span>' : '<span style="color:#475569;font-size:0.65rem;flex-shrink:0;">'+t.createdAt.split(',')[0]+'</span>')
                    + '</div>'
                    + '<div style="color:#64748b;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">'+lastText+'...</div>'
                    + '</div></div>';
            }).join('');
        }

        function adminCloseTicket(idx) {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            if (!tickets[idx]) return;
            tickets[idx].status = 'closed';
            localStorage.setItem('trustSupportTickets', JSON.stringify(tickets));
            adminRenderSupport();
            if (adminActiveChat === idx) openAdminChat(idx);
        }

        function openAdminChat(idx) {
            adminActiveChat = idx;
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var t = tickets[idx];
            if (!t) return;
            // Mark as seen
            adminChatLastSeen = Date.now();
            localStorage.setItem('trustAdminChatLastSeen', adminChatLastSeen.toString());
            adminRenderSupport();

            var headerEl = document.getElementById('adminChatHeader');
            headerEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.68rem;color:#fff;">'+t.userName.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase()+'</div><div><div style="color:#fff;font-weight:700;font-size:0.88rem;">'+t.userName+'</div><div style="color:#64748b;font-size:0.7rem;">'+t.email+' · #'+t.id+'</div></div></div>'
                + '<div style="display:flex;gap:6px;">'+(t.status==='open'?'<button onclick="adminCloseTicket('+idx+')" style="background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.25);border-radius:8px;padding:6px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Закрыть</button>':'<span style="color:#4ade80;font-size:0.72rem;">Закрыт</span>')+'</div>';

            var msgsEl = document.getElementById('adminChatMessages');
            var msgs = (t.messages || []);
            var msgsHtml = '<div style="text-align:center;margin-bottom:12px;"><span style="background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.15);border-radius:20px;padding:4px 14px;font-size:0.7rem;">'+t.reason+': '+t.description.slice(0,100)+'</span></div>';
            msgsHtml += msgs.map(function(m) {
                var isAdmin = m.from === 'admin';
                var senderName = isAdmin ? 'Поддержка' : t.userName;
                return '<div style="display:flex;justify-content:'+(isAdmin?'flex-end':'flex-start')+';margin-bottom:8px;"><div style="max-width:75%;background:'+(isAdmin?'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(59,130,246,0.1))':'rgba(255,255,255,0.04)')+';border:1px solid '+(isAdmin?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.06)')+';border-radius:12px;padding:10px 14px;"><div style="color:#fff;font-size:0.84rem;line-height:1.5;">'+m.text+'</div><div style="color:#475569;font-size:0.62rem;margin-top:4px;">'+senderName+' · '+m.time+'</div></div></div>';
            }).join('');
            if (!msgs.length) msgsHtml += '<div style="color:#475569;text-align:center;padding:20px;font-size:0.8rem;">Нет сообщений</div>';
            msgsEl.innerHTML = '<div style="width:100%;">'+msgsHtml+'</div>';
            msgsEl.style.display = 'block';
            msgsEl.style.alignItems = 'flex-start';
            msgsEl.scrollTop = msgsEl.scrollHeight;

            var inputArea = document.getElementById('adminChatInputArea');
            inputArea.style.display = 'block';
            var input = document.getElementById('adminChatInput');
            input.onkeydown = function(e){ if(e.key==='Enter') adminSendChat(idx); };
            var sendBtn = document.getElementById('adminChatSendBtn');
            sendBtn.onclick = function(){ adminSendChat(idx); };
        }

        function adminSendChat(idx) {
            var input = document.getElementById('adminChatInput');
            var text = input.value.trim();
            if (!text) return;
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            if (!tickets[idx]) return;
            if (!tickets[idx].messages) tickets[idx].messages = [];
            tickets[idx].messages.push({ from: 'admin', text: text, time: new Date().toLocaleString('ru-RU') });
            localStorage.setItem('trustSupportTickets', JSON.stringify(tickets));
            input.value = '';
            openAdminChat(idx);
            // Trigger user notification immediately
            setTimeout(function(){ checkUserSupportMessages(); showSupportNotification(); }, 300);
        }

        // ==========================================
        // USER SUPPORT CHAT + NOTIFICATIONS
        // ==========================================
        var userChatLastSeen = parseInt(localStorage.getItem('trustChatLastSeen') || '0');

        function checkUserSupportMessages() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var myId = localStorage.getItem('trustUserId');
            var unread = 0;
            var hasNew = false;
            tickets.forEach(function(t) {
                if (t.userId !== myId) return;
                (t.messages || []).forEach(function(m) {
                    if (m.from === 'admin') {
                        var msgTime = new Date(m.time).getTime() || 0;
                        if (msgTime > userChatLastSeen || !userChatLastSeen) unread++;
                    }
                });
            });
            // Show/hide icon and badge
            var icon = document.getElementById('supportChatIcon');
            var badge = document.getElementById('supportChatBadge');
            var hasTickets = tickets.some(function(t) { return t.userId === myId; });
            if (icon) icon.style.display = hasTickets ? 'block' : 'none';
            if (badge) {
                if (unread > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = unread;
                    hasNew = true;
                } else {
                    badge.style.display = 'none';
                }
            }
            return { unread: unread, hasNew: hasNew };
        }

        function openUserSupportChat() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var myId = localStorage.getItem('trustUserId');
            var myTickets = tickets.filter(function(t) { return t.userId === myId; });
            
            // Mark all as seen
            userChatLastSeen = Date.now();
            localStorage.setItem('trustChatLastSeen', userChatLastSeen.toString());
            checkUserSupportMessages();

            // Remove notification if present
            var notif = document.getElementById('supportNotifToast');
            if (notif) notif.remove();

            var existing = document.getElementById('userSupportChatModal');
            if (existing) existing.remove();

            if (!myTickets.length) {
                showCustomAlert('Нет обращений', 'У вас пока нет обращений в поддержку. Перейдите в раздел Support чтобы создать обращение.', 'warning');
                return;
            }

            // Build messages from all tickets
            var allMsgs = [];
            myTickets.forEach(function(t) {
                // Add ticket creation as system message
                allMsgs.push({ from: 'system', text: 'Обращение: ' + t.reason + ' — ' + t.description.slice(0,80), time: t.createdAt });
                (t.messages || []).forEach(function(m) { allMsgs.push(m); });
            });

            var msgsHtml = allMsgs.map(function(m) {
                if (m.from === 'system') {
                    return '<div style="text-align:center;margin:12px 0;"><span style="background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);border-radius:20px;padding:4px 14px;font-size:0.72rem;">' + m.text + ' · ' + m.time + '</span></div>';
                }
                var isAdmin = m.from === 'admin';
                return '<div style="display:flex;justify-content:' + (isAdmin ? 'flex-start' : 'flex-end') + ';margin-bottom:10px;"><div style="max-width:80%;background:' + (isAdmin ? 'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.06))' : 'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(59,130,246,0.1))') + ';border:1px solid ' + (isAdmin ? 'rgba(251,191,36,0.25)' : 'rgba(59,130,246,0.25)') + ';border-radius:14px;padding:12px 16px;"><div style="color:#fff;font-size:0.85rem;line-height:1.6;">' + m.text + '</div><div style="color:#475569;font-size:0.65rem;margin-top:6px;display:flex;align-items:center;gap:6px;">' + (isAdmin ? '<i class="fa-solid fa-headset" style="color:#fbbf24;font-size:0.6rem;"></i> Поддержка' : '<i class="fa-solid fa-user" style="color:#38bdf8;font-size:0.6rem;"></i> Вы') + ' · ' + m.time + '</div></div></div>';
            }).join('');

            // Find latest open ticket index for reply
            var latestIdx = -1;
            for (var i = tickets.length - 1; i >= 0; i--) {
                if (tickets[i].userId === myId) { latestIdx = i; break; }
            }

            var modal = document.createElement('div');
            modal.id = 'userSupportChatModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
            modal.innerHTML = '<div style="background:linear-gradient(160deg,#0b1628,#060e1c);border:1px solid rgba(251,191,36,0.2);border-radius:20px;padding:0;max-width:500px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">'
                + '<div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(251,191,36,0.05),rgba(245,158,11,0.02));"><div style="display:flex;align-items:center;gap:12px;"><div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15));border:1.5px solid rgba(251,191,36,0.3);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-headset" style="color:#fbbf24;font-size:1rem;"></i></div><div><div style="color:#fff;font-weight:800;font-size:1rem;">Чат с поддержкой</div><div style="color:#64748b;font-size:0.72rem;">Служба поддержки TrustDrop</div></div></div><button onclick="this.closest(\'#userSupportChatModal\').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark"></i></button></div>'
                + '<div id="userChatMessages" style="flex:1;overflow-y:auto;padding:16px 20px;min-height:200px;">' + msgsHtml + '</div>'
                + '<div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;"><input type="text" id="userChatInput" placeholder="Написать сообщение..." style="flex:1;background:rgba(15,23,42,0.8);color:#fff;border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:11px 14px;font-size:0.85rem;outline:none;" onkeydown="if(event.key===\'Enter\')userSendChat(' + latestIdx + ')"><button onclick="userSendChat(' + latestIdx + ')" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-weight:800;font-size:0.85rem;cursor:pointer;"><i class="fa-solid fa-paper-plane"></i></button></div>'
                + '</div>';
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
            var chatDiv = document.getElementById('userChatMessages');
            if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
        }

        function userSendChat(ticketIdx) {
            var input = document.getElementById('userChatInput');
            var text = input.value.trim();
            if (!text || ticketIdx < 0) return;
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            if (!tickets[ticketIdx]) return;
            if (!tickets[ticketIdx].messages) tickets[ticketIdx].messages = [];
            tickets[ticketIdx].messages.push({ from: 'user', text: text, time: new Date().toLocaleString('ru-RU') });
            localStorage.setItem('trustSupportTickets', JSON.stringify(tickets));
            input.value = '';
            openUserSupportChat(); // re-render
            // Trigger admin notification immediately
            setTimeout(showAdminSupportNotification, 300);
        }

        // Check for new messages on page load + periodically
        var userNotifShownIds = JSON.parse(localStorage.getItem('trustUserNotifShown') || '[]');
        var adminNotifShownIds = JSON.parse(localStorage.getItem('trustAdminNotifShown') || '[]');

        setTimeout(function() {
            checkUserSupportMessages();
            showSupportNotification();
        }, 1500);
        setInterval(function() {
            checkUserSupportMessages();
        }, 5000);

        function showSupportNotification() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var myId = localStorage.getItem('trustUserId');
            // Find newest admin message not yet notified
            var newMsgId = null;
            tickets.forEach(function(t) {
                if (t.userId !== myId) return;
                (t.messages || []).forEach(function(m) {
                    if (m.from === 'admin') {
                        var mId = t.id + '_' + m.time;
                        if (userNotifShownIds.indexOf(mId) === -1) newMsgId = mId;
                    }
                });
            });
            if (!newMsgId) return;
            if (document.getElementById('supportNotifToast')) return;
            userNotifShownIds.push(newMsgId);
            localStorage.setItem('trustUserNotifShown', JSON.stringify(userNotifShownIds));
            playNotifSound();
            var toast = document.createElement('div');
            toast.id = 'supportNotifToast';
            toast.onclick = function() { toast.style.animation='slideOutNotif 0.3s ease-in forwards'; setTimeout(function(){toast.remove();},300); openUserSupportChat(); };
            toast.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#1e3a5f,#0b1628);border:1px solid rgba(251,191,36,0.4);border-radius:16px;padding:16px 20px;z-index:99999;cursor:pointer;max-width:340px;box-shadow:0 8px 30px rgba(0,0,0,0.6);animation:slideInNotif 0.4s ease-out;display:flex;align-items:center;gap:12px;';
            toast.innerHTML = '<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15));border:1.5px solid rgba(251,191,36,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-headset" style="color:#fbbf24;font-size:1.1rem;"></i></div><div><div style="color:#fbbf24;font-weight:800;font-size:0.88rem;">Служба поддержки</div><div style="color:#94a3b8;font-size:0.8rem;line-height:1.4;">С вами связалась служба поддержки. Нажмите чтобы открыть чат.</div></div>';
            toast.onmouseenter = function() { setTimeout(function(){ toast.style.animation='slideOutNotif 0.3s ease-in forwards'; setTimeout(function(){toast.remove();},300); }, 200); };
            document.body.appendChild(toast);
        }

        // ==========================================
        // ADMIN NOTIFICATIONS (when user writes)
        // ==========================================
        var adminChatLastSeen = parseInt(localStorage.getItem('trustAdminChatLastSeen') || '0');

        function checkAdminNewMessages() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var unread = 0;
            tickets.forEach(function(t) {
                (t.messages || []).forEach(function(m) {
                    if (m.from === 'user') {
                        var msgTime = new Date(m.time).getTime() || 0;
                        if (msgTime > adminChatLastSeen || !adminChatLastSeen) unread++;
                    }
                });
            });
            return unread;
        }

        function showAdminSupportNotification() {
            var tickets = JSON.parse(localStorage.getItem('trustSupportTickets') || '[]');
            var newMsgId = null;
            tickets.forEach(function(t) {
                (t.messages || []).forEach(function(m) {
                    if (m.from === 'user') {
                        var mId = t.id + '_' + m.time;
                        if (adminNotifShownIds.indexOf(mId) === -1) newMsgId = mId;
                    }
                });
            });
            if (!newMsgId) return;
            if (document.getElementById('adminNotifToast')) return;
            adminNotifShownIds.push(newMsgId);
            localStorage.setItem('trustAdminNotifShown', JSON.stringify(adminNotifShownIds));
            playNotifSound();
            var toast = document.createElement('div');
            toast.id = 'adminNotifToast';
            toast.onclick = function() { toast.style.animation='slideOutNotif 0.3s ease-in forwards'; setTimeout(function(){toast.remove();},300); adminChatLastSeen=Date.now(); localStorage.setItem('trustAdminChatLastSeen',adminChatLastSeen.toString()); switchAdminTab('support'); };
            toast.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#2d1040,#0b1628);border:1px solid rgba(168,85,247,0.4);border-radius:16px;padding:16px 20px;z-index:99999;cursor:pointer;max-width:340px;box-shadow:0 8px 30px rgba(0,0,0,0.6);animation:slideInNotif 0.4s ease-out;display:flex;align-items:center;gap:12px;';
            toast.innerHTML = '<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(139,92,246,0.15));border:1.5px solid rgba(168,85,247,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-envelope" style="color:#a855f7;font-size:1.1rem;"></i></div><div><div style="color:#a855f7;font-weight:800;font-size:0.88rem;">Новое сообщение</div><div style="color:#94a3b8;font-size:0.8rem;line-height:1.4;">Пользователь написал в чат поддержки</div></div>';
            toast.onmouseenter = function() { setTimeout(function(){ toast.style.animation='slideOutNotif 0.3s ease-in forwards'; setTimeout(function(){toast.remove();},300); }, 200); };
            document.body.appendChild(toast);
        }

        setInterval(function() {
            var adminModal = document.getElementById('adminPanelModal');
            if (adminModal && adminModal.classList.contains('active')) {
                showAdminSupportNotification();
            }
        }, 8000);


        // ===== MOBILE MENU =====
        function toggleMobileMenu() {
            var btn = document.getElementById('mobileMenuBtn');
            var drawer = document.getElementById('mobileNavDrawer');
            var overlay = document.getElementById('mobileNavOverlay');
            var isOpen = drawer.classList.contains('open');
            if (isOpen) {
                drawer.classList.remove('open');
                overlay.style.display = 'none';
                btn.classList.remove('open');
            } else {
                drawer.classList.add('open');
                overlay.style.display = 'block';
                btn.classList.add('open');
            }
        }
        function closeMobileMenu() {
            document.getElementById('mobileNavDrawer').classList.remove('open');
            document.getElementById('mobileNavOverlay').style.display = 'none';
            document.getElementById('mobileMenuBtn').classList.remove('open');
        }
        function switchMainTabMobile(tab) {
            closeMobileMenu();
            var navItems = document.querySelectorAll('.nav-item');
            var tabMap = { airdrops: 0, market: 1, news: 2, support: 3 };
            var idx = tabMap[tab];
            if (idx !== undefined) switchMainTab(tab, navItems[idx]);
        }
        function goToDashboardMobile(tab) {
            closeMobileMenu();
            goToDashboard(tab);
        }

        // ===== MOBILE SIDEBAR =====
        function toggleMobileSidebar() {
            var sidebar = document.querySelector('.dashboard-sidebar');
            var overlay = document.getElementById('mobileSidebarOverlay');
            if (!sidebar) return;
            var isOpen = sidebar.classList.contains('mobile-open');
            if (isOpen) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('show');
            } else {
                sidebar.classList.add('mobile-open');
                overlay.classList.add('show');
            }
        }
        function closeMobileSidebar() {
            var sidebar = document.querySelector('.dashboard-sidebar');
            var overlay = document.getElementById('mobileSidebarOverlay');
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('show');
        }

        // Close mobile sidebar when a nav item is clicked
        document.querySelectorAll('.dash-nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 768) closeMobileSidebar();
            });
        });

        // Add viewport meta if missing
        if (!document.querySelector('meta[name="viewport"]')) {
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0';
            document.head.appendChild(meta);
        }

        // Init KYC on load
        kycInit();
        adminRenderKyc();

        // ==========================================
        // FULLSCREEN CANDLESTICK CHART (TradingView Lightweight Charts)
        // ==========================================
        var fullChart = null;
        var fullChartSeries = null;
        var fullChartVolSeries = null;
        var currentChartCoin = '';
        var currentChartTf = '1H';

        // Cache generated candle data per coin+tf
        var candleCache = {};

        function generateCandleData(coin, tf) {
            var cacheKey = coin + '_' + tf;
            if (candleCache[cacheKey]) return candleCache[cacheKey];

            var basePrice = 1;
            if (chartHistory[coin] && chartHistory[coin].length > 0) {
                basePrice = chartHistory[coin][chartHistory[coin].length - 1];
            }
            var candles = [];
            var now = Math.floor(Date.now() / 1000);
            var count, interval;
            switch(tf) {
                case '1H':  count = 1500; interval = 60;       break; // 500 min candles
                case '4H':  count = 1000; interval = 240;      break; // 500 x 4min
                case '1D':  count = 1000; interval = 900;      break; // 500 x 15min
                case '1W':  count = 1000; interval = 7200;     break; // 500 x 2h
                case '1M':  count = 1000; interval = 86400;    break; // 500 days
                case '1Y':  count = 1500; interval = 86400;    break; // 2 years daily
                default:    count = 1500; interval = 60;
            }

            // For TRS use stored chart data for ALL timeframes — synced with mini-chart
            if (coin === 'TRS' && typeof trsStoredChart !== 'undefined' && trsStoredChart.length > 50) {
                var src = trsStoredChart;
                var targetCount = count;
                var step = Math.max(1, Math.floor(src.length / targetCount));
                var intervalSec;
                switch(tf) {
                    case '1H':  intervalSec = 60;    break;
                    case '4H':  intervalSec = 240;   break;
                    case '1D':  intervalSec = 900;   break;
                    case '1W':  intervalSec = 7200;  break;
                    case '1M':  intervalSec = 86400; break;
                    case '1Y':  intervalSec = 86400; break;
                    default:    intervalSec = 60;
                }
                var price = src[0] || basePrice;
                for (var si = 0; si < src.length; si += step) {
                    var time = now - Math.floor((src.length - si) / step) * intervalSec;
                    var open = price;
                    price = src[Math.min(si + step - 1, src.length - 1)];
                    var close = price;
                    var sliceMax = open, sliceMin = open;
                    for (var sj = si; sj < Math.min(si + step, src.length); sj++) {
                        if (src[sj] > sliceMax) sliceMax = src[sj];
                        if (src[sj] < sliceMin) sliceMin = src[sj];
                    }
                    var spread = Math.abs(close - open) * 0.3 + basePrice * 0.002;
                    var high = Math.max(open, close) + Math.random() * spread;
                    var low = Math.max(0.0001, Math.min(open, close) - Math.random() * spread);
                    candles.push({ time: time, open: +open.toPrecision(6), high: +high.toPrecision(6), low: +low.toPrecision(6), close: +close.toPrecision(6) });
                }
                candleCache[cacheKey] = candles;
                return candles;
            }

            var price = basePrice * (0.4 + Math.random() * 0.3);
            var volatility = basePrice < 0.001 ? 0.06 : basePrice < 1 ? 0.04 : basePrice < 100 ? 0.025 : 0.015;
            if (tf === '1Y') { volatility *= 2.5; price = basePrice * 0.2; }
            else if (tf === '1M') { volatility *= 2; price = basePrice * 0.5; }
            else if (tf === '1W') volatility *= 1.5;
            var trend = (basePrice - price) / count * (0.8 + Math.random() * 0.4);

            for (var i = 0; i < count; i++) {
                var time = now - (count - i) * interval;
                var change = (Math.random() - 0.48) * volatility * price;
                // Add trend towards current price
                change += trend;
                // Random pumps/dumps
                if (Math.random() < 0.02) change += (Math.random() - 0.5) * volatility * price * 4;
                var open = price;
                price += change;
                if (price < basePrice * 0.05) price = basePrice * 0.06;
                var close = price;
                var high = Math.max(open, close) + Math.random() * Math.abs(change) * 0.8;
                var low = Math.min(open, close) - Math.random() * Math.abs(change) * 0.8;
                if (low < 0.0001) low = 0.0001;
                candles.push({
                    time: time,
                    open: +open.toPrecision(6),
                    high: +high.toPrecision(6),
                    low: +low.toPrecision(6),
                    close: +close.toPrecision(6)
                });
            }
            // Ensure last candle close = current price
            if (candles.length > 0) candles[candles.length - 1].close = +basePrice.toPrecision(6);

            // Get real change% from market to ensure last candles direction matches
            var realChangePct = 0;
            var mRow = document.querySelector('[data-market-symbol="' + coin + '"]');
            if (mRow) {
                var mce = mRow.querySelector('.m-col-change');
                if (mce) realChangePct = parseFloat(mce.innerText) || 0;
            }
            // Fix last ~30 candles to match the % direction
            if (candles.length > 30) {
                var lastIdx = candles.length - 1;
                var openPrice24h = basePrice / (1 + realChangePct / 100);
                // Smoothly transition last 30 candles from openPrice24h to basePrice
                for (var fi = 0; fi < 30; fi++) {
                    var ci = lastIdx - 29 + fi;
                    var progress = fi / 29;
                    var targetClose = openPrice24h + (basePrice - openPrice24h) * progress;
                    var targetOpen = fi === 0 ? openPrice24h : candles[ci - 1].close;
                    var spread = Math.abs(targetClose - targetOpen) * 0.3 + basePrice * 0.001;
                    candles[ci].open = +targetOpen.toPrecision(6);
                    candles[ci].close = +targetClose.toPrecision(6);
                    candles[ci].high = +(Math.max(targetOpen, targetClose) + Math.random() * spread).toPrecision(6);
                    candles[ci].low = +(Math.max(0.0001, Math.min(targetOpen, targetClose) - Math.random() * spread)).toPrecision(6);
                }
            }

            candleCache[cacheKey] = candles;
            return candles;
        }

        function openFullChart(coin) {
            currentChartCoin = coin;
            currentChartTf = '1H';
            var iconUrl = coinIcons[coin] || '';
            var iconEl = document.getElementById('fullChartCoinIcon');
            if (iconEl) {
                if (coin === 'TRS') {
                    iconEl.style.display = 'none';
                    // Add SVG icon for TRS
                    var trsIconEl = document.getElementById('fullChartTrsIcon');
                    if (!trsIconEl) {
                        trsIconEl = document.createElement('div');
                        trsIconEl.id = 'fullChartTrsIcon';
                        trsIconEl.style.cssText = 'width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#6366f1);display:flex;align-items:center;justify-content:center;flex-shrink:0;';
                        trsIconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polygon points="12,2 22,20 2,20" stroke="#fff" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/><circle cx="12" cy="14" r="3" fill="#fff" opacity="0.9"/></svg>';
                        iconEl.parentNode.insertBefore(trsIconEl, iconEl);
                    }
                    trsIconEl.style.display = 'flex';
                } else {
                    iconEl.style.display = '';
                    iconEl.src = iconUrl;
                    var trsIconEl = document.getElementById('fullChartTrsIcon');
                    if (trsIconEl) trsIconEl.style.display = 'none';
                }
            }
            document.getElementById('fullChartTitle').textContent = coin + '/USDT';

            var price = (chartHistory[coin] && chartHistory[coin].length > 0) ? chartHistory[coin][chartHistory[coin].length-1] : 0;
            var priceStr = price < 0.001 ? price.toFixed(8) : price < 1 ? price.toFixed(4) : price.toFixed(2);
            document.getElementById('fullChartPrice').textContent = priceStr + '$';
            // Get real change% from market row
            var changeEl = document.getElementById('fullChartChange');
            var marketRow = document.querySelector('[data-market-symbol="' + coin + '"]');
            var realChange = '0.00';
            if (marketRow) {
                var mce = marketRow.querySelector('.m-col-change');
                if (mce) realChange = mce.innerText;
            }
            changeEl.textContent = realChange;
            changeEl.style.color = realChange.indexOf('-') > -1 ? '#f87171' : '#4ade80';

            // Reset TF buttons
            var btns = document.querySelectorAll('#fullChartTimeframes .tf-btn');
            btns.forEach(function(b) {
                if (b.dataset.tf === '1H') {
                    b.style.background = 'rgba(59,130,246,0.15)';
                    b.style.color = '#38bdf8';
                    b.style.borderColor = 'rgba(59,130,246,0.3)';
                } else {
                    b.style.background = 'rgba(255,255,255,0.04)';
                    b.style.color = '#64748b';
                    b.style.borderColor = 'rgba(255,255,255,0.08)';
                }
            });

            openModal('fullChartModal');
            setTimeout(function() { renderFullChart(coin, '1H'); }, 100);
        }

        function closeFullChart() {
            if (fullChart) {
                fullChart.remove();
                fullChart = null;
                fullChartSeries = null;
                fullChartVolSeries = null;
            }
            closeModal('fullChartModal');
        }

        function setChartTimeframe(tf) {
            currentChartTf = tf;
            var btns = document.querySelectorAll('#fullChartTimeframes .tf-btn');
            btns.forEach(function(b) {
                if (b.dataset.tf === tf) {
                    b.style.background = 'rgba(59,130,246,0.15)';
                    b.style.color = '#38bdf8';
                    b.style.borderColor = 'rgba(59,130,246,0.3)';
                } else {
                    b.style.background = 'rgba(255,255,255,0.04)';
                    b.style.color = '#64748b';
                    b.style.borderColor = 'rgba(255,255,255,0.08)';
                }
            });
            renderFullChart(currentChartCoin, tf);
        }

        function renderFullChart(coin, tf) {
            var container = document.getElementById('fullChartContainer');
            if (!container) return;
            container.innerHTML = '';

            if (typeof LightweightCharts === 'undefined') {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;">Загрузка графика...</div>';
                return;
            }

            var chart = LightweightCharts.createChart(container, {
                width: container.clientWidth,
                height: container.clientHeight,
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#64748b',
                    fontFamily: 'system-ui, sans-serif'
                },
                grid: {
                    vertLines: { color: 'rgba(255,255,255,0.03)' },
                    horzLines: { color: 'rgba(255,255,255,0.03)' }
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: 2, labelBackgroundColor: '#1e3a5f' },
                    horzLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: 2, labelBackgroundColor: '#1e3a5f' }
                },
                timeScale: {
                    borderColor: 'rgba(255,255,255,0.06)',
                    timeVisible: tf === '1H' || tf === '4H' || tf === '1D',
                    secondsVisible: false,
                    barSpacing: 8,
                    minBarSpacing: 2,
                    rightOffset: 5
                },
                rightPriceScale: {
                    borderColor: 'rgba(255,255,255,0.06)',
                    scaleMargins: { top: 0.1, bottom: 0.2 }
                },
                handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
                handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
            });

            fullChart = chart;

            var candleSeries = chart.addCandlestickSeries({
                upColor: '#4ade80',
                downColor: '#f6465d',
                borderDownColor: '#f6465d',
                borderUpColor: '#4ade80',
                wickDownColor: '#f6465d',
                wickUpColor: '#4ade80'
            });

            var candles = generateCandleData(coin, tf);
            candleSeries.setData(candles);
            fullChartSeries = candleSeries;

            // Volume
            var volSeries = chart.addHistogramSeries({
                color: '#38bdf8',
                priceFormat: { type: 'volume' },
                priceScaleId: '',
                scaleMargins: { top: 0.85, bottom: 0 }
            });
            var volData = candles.map(function(c) {
                var vol = Math.abs(c.close - c.open) * (1000 + Math.random() * 5000);
                return { time: c.time, value: vol, color: c.close >= c.open ? 'rgba(74,222,128,0.25)' : 'rgba(246,70,93,0.25)' };
            });
            volSeries.setData(volData);
            fullChartVolSeries = volSeries;

            chart.timeScale().fitContent();

            // Resize observer
            var ro = new ResizeObserver(function() {
                if (chart && container.clientWidth > 0) {
                    chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
                }
            });
            ro.observe(container);
        }

        // Make market charts clickable + entire row on mobile
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                var rows = document.querySelectorAll('.market-row');
                rows.forEach(function(row) {
                    var sym = row.getAttribute('data-market-symbol');
                    var chartWrap = row.querySelector('.market-chart-wrap');
                    if (chartWrap && sym) {
                        chartWrap.setAttribute('title', 'Открыть график ' + sym);
                        chartWrap.onclick = function(e) {
                            e.stopPropagation();
                            openFullChart(sym);
                        };
                    }
                    // On mobile — clicking entire row opens trade
                    if (sym) {
                        row.style.cursor = 'pointer';
                        row.onclick = function(e) {
                            if (e.target.closest('.btn-trade') || e.target.closest('.market-chart-wrap')) return;
                            if (window.innerWidth <= 480) openTrade(sym);
                        };
                    }
                });
            }, 500);
        });

        // Also make trade modal chart clickable
        var tradeChartEl = document.getElementById('tradeModalChart');
        if (tradeChartEl) {
            tradeChartEl.parentElement.style.cursor = 'pointer';
            tradeChartEl.parentElement.title = 'Открыть полный график';
            tradeChartEl.parentElement.onclick = function() {
                if (currentTradeCoin) openFullChart(currentTradeCoin);
            };
        }
    