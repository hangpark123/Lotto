/**
 * ?숉뻾蹂듦텒 ???좏뵆由ъ??댁뀡
 * SPA ?쇱슦?? API ?듭떊, UI ?곹깭 愿由?
 */

// ===== ?곹깭 愿由?=====
const state = {
    isAuthenticated: false,
    username: null,
    currentPage: 'dashboard',
    weeklyPurchaseLimit: null,
    myLottoNumbers: [],
    lastDraw: null,
    drawHistory: [],
    drawHistoryIndex: 0
};

// ===== API ?듭떊 =====
const API = {
    baseURL: '',  // 媛숈? ?꾨찓??

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            credentials: 'include',  // 荑좏궎 ?ы븿
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || '요청에 실패했습니다.');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    async logout() {
        return this.request('/api/logout', {
            method: 'POST'
        });
    },

    async checkSession() {
        return this.request('/api/session');
    },

    async getBalance() {
        return this.request('/api/balance');
    },

    async buyLotto(tickets) {
        return this.request('/api/buy-lotto645', {
            method: 'POST',
            body: JSON.stringify({ tickets })
        });
    },

    async getBuyList(startDate, endDate) {
        return this.request('/api/buy-list', {
            method: 'POST',
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate
            })
        });
    },

    async getAIRecommendation() {
        return this.request('/api/ai-recommend', {
            method: 'POST'
        });
    },

    async getRandomNumbers() {
        return this.request('/api/random-numbers', {
            method: 'POST'
        });
    },

    async assignVirtualAccount(amount) {
        return this.request('/api/assign-virtual-account', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    },

    async getVirtualAccount() {
        return this.request('/api/virtual-account');
    },

    async getWeeklyPurchaseLimit() {
        return this.request('/api/weekly-purchase-limit');
    },

    async getMyLottoNumbers() {
        return this.request('/api/my-lotto-numbers');
    },

    async saveMyLottoNumber(numbers, name) {
        return this.request('/api/my-lotto-numbers', {
            method: 'POST',
            body: JSON.stringify({ numbers, name })
        });
    },

    async deleteMyLottoNumber(id) {
        return this.request(`/api/my-lotto-numbers/${id}`, {
            method: 'DELETE'
        });
    },

    async getLastDraw() {
        return this.request('/api/last-draw');
    },

    async getLottoDraws(limit = 30) {
        return this.request(`/api/lotto-draws?limit=${encodeURIComponent(limit)}`);
    }
};

// ===== UI ?좏떥由ы떚 =====
const UI = {
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    },

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    },

    showError(elementId, message) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.classList.remove('hidden');
    },

    hideError(elementId) {
        const el = document.getElementById(elementId);
        el.classList.add('hidden');
    },

    showPage(pageName) {
        // 紐⑤뱺 ?섏씠吏 ?④린湲?
        document.querySelectorAll('.content-page').forEach(page => {
            page.classList.remove('active');
        });

        // ?좏깮???섏씠吏 ?쒖떆
        document.getElementById(`${pageName}-page`).classList.add('active');

        // ?ㅻ퉬寃뚯씠???쒖꽦???곹깭 ?낅뜲?댄듃
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');

        state.currentPage = pageName;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('ko-KR').format(amount) + '원';
    }
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
    if (!value) {
        return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).replace('T', ' ');
    }
    return parsed.toLocaleString('ko-KR', { hour12: false });
}

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrencyOrDash(value) {
    const numeric = toNumber(value);
    if (numeric === null || numeric < 0) {
        return '-';
    }
    return UI.formatCurrency(numeric);
}

function formatCountOrDash(value) {
    const numeric = toNumber(value);
    if (numeric === null || numeric < 0) {
        return '-';
    }
    return new Intl.NumberFormat('ko-KR').format(numeric);
}

const Runtime = {
    userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',

    isZoomLike() {
        return /ZoomApps|ZoomSDK|ZoomMeeting/i.test(this.userAgent);
    },

    isEmbeddedContext() {
        try {
            return window.self !== window.top;
        } catch (error) {
            return true;
        }
    }
};

const Dialogs = {
    confirm(message, defaultValue = false) {
        // Zoom/WebView environments may block native confirm() and always return false.
        if (Runtime.isZoomLike() || Runtime.isEmbeddedContext()) {
            console.info('[dialog-bypass] confirm skipped:', message);
            return defaultValue;
        }

        try {
            const result = window.confirm(message);
            return typeof result === 'boolean' ? result : defaultValue;
        } catch (error) {
            console.warn('[dialog-error] confirm failed:', error);
            return defaultValue;
        }
    }
};

// ===== 濡쒓렇??=====
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    UI.hideError('login-error');
    UI.showLoading();

    try {
        const result = await API.login(username, password);

        if (result.success) {
            state.isAuthenticated = true;
            state.username = result.username;

            // 硫붿씤 ???쒖떆
            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('username-display').textContent = result.username;

            // ??쒕낫??濡쒕뱶
            await loadDashboard();
        }
    } catch (error) {
        UI.showError('login-error', error.message);
    } finally {
        UI.hideLoading();
    }
}

// ===== 濡쒓렇?꾩썐 =====
async function handleLogout() {
    UI.showLoading();

    try {
        await API.logout();

        state.isAuthenticated = false;
        state.username = null;

        // 濡쒓렇???섏씠吏濡??대룞
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');

        // ??珥덇린??
        document.getElementById('login-form').reset();
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
    } finally {
        UI.hideLoading();
    }
}

// ===== ??쒕낫??=====
async function loadDashboard() {
    UI.showLoading();

    try {
        const [balanceResult, weeklyResult] = await Promise.allSettled([
            API.getBalance(),
            API.getWeeklyPurchaseLimit()
        ]);

        let weeklyLimitData = null;
        if (weeklyResult.status === 'fulfilled' && weeklyResult.value?.success) {
            weeklyLimitData = weeklyResult.value;
            state.weeklyPurchaseLimit = weeklyLimitData;
        } else {
            state.weeklyPurchaseLimit = null;
        }

        if (balanceResult.status === 'fulfilled' && balanceResult.value?.success) {
            renderBalanceCards(balanceResult.value.balance, weeklyLimitData);
        } else {
            throw new Error('예치금 정보를 불러오지 못했습니다.');
        }

        renderWeeklyRemainingBadge(weeklyLimitData);
    } catch (error) {
        alert('예치금 정보를 불러오지 못했습니다.');
    } finally {
        UI.hideLoading();
    }
}

function renderWeeklyRemainingBadge(weeklyLimitData) {
    const badge = document.getElementById('buy-weekly-remaining');
    if (!badge) {
        return;
    }

    if (!weeklyLimitData || typeof weeklyLimitData.week_remaining_amount !== 'number') {
        badge.textContent = '이번주 구매 가능 금액: -';
        badge.classList.remove('is-zero');
        return;
    }

    const remaining = Math.max(0, weeklyLimitData.week_remaining_amount);
    badge.textContent = `이번주 구매 가능 금액: ${UI.formatCurrency(remaining)}`;
    badge.classList.toggle('is-zero', remaining <= 0);
}

async function refreshWeeklyRemainingBadge() {
    try {
        const result = await API.getWeeklyPurchaseLimit();
        if (result.success) {
            state.weeklyPurchaseLimit = result;
            renderWeeklyRemainingBadge(result);
        }
    } catch (error) {
        renderWeeklyRemainingBadge(state.weeklyPurchaseLimit);
    }
}

function renderBalanceCards(balance, weeklyLimitData = null) {
    const container = document.getElementById('balance-cards');

    const valueOf = (...keys) => {
        for (const key of keys) {
            const raw = balance?.[key];
            if (raw !== undefined && raw !== null && raw !== '') {
                const numeric = Number(String(raw).replace(/[^\d.-]/g, ''));
                return Number.isFinite(numeric) ? numeric : 0;
            }
        }
        return 0;
    };

    const cards = [
        { title: '총 예치금', value: valueOf('총예치금') },
        { title: '구매 가능 금액', value: valueOf('구매가능금액') },
        { title: '예약 구매 금액', value: valueOf('예약구매금액') },
        { title: '출금 신청중 금액', value: valueOf('출금신청중금액') },
        { title: '구매 불가능 금액', value: valueOf('구매불가능금액') },
        { title: '최근 1달 누적 구매', value: valueOf('최근1달누적구매금액') },
        {
            title: '이번주 구매 가능 금액',
            value: weeklyLimitData?.week_remaining_amount,
            isUnknown: !weeklyLimitData || typeof weeklyLimitData.week_remaining_amount !== 'number'
        }
    ];

    container.innerHTML = cards.map(card => `
        <div class="balance-card">
            <div class="balance-card-title">${card.title}</div>
            <div class="balance-card-value">${card.isUnknown ? '-' : UI.formatCurrency(card.value)}</div>
        </div>
    `).join('');
}

// ===== 濡쒕삉 援щℓ =====
// ===== 濡쒕삉 援щℓ (踰덊샇??UI) =====
const lottoState = {
    selectedNumbers: new Set(),
    slots: {
        'A': null, 'B': null, 'C': null, 'D': null, 'E': null
    },
    currentMode: 'manual', // manual, auto, ai
    pricePerGame: 1000,
    savedNumbers: []
};

function initBuyPage() {
    renderNumberGrid();
    setupEventListeners();
    updatePriceDisplay();
    if (state.isAuthenticated) {
        loadBuyReferenceData();
    }
}

function renderNumberGrid() {
    const grid = document.querySelector('.number-grid');
    grid.innerHTML = '';

    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `lotto-number-btn ${lottoState.selectedNumbers.has(i) ? 'selected' : ''}`;
        btn.textContent = i;
        btn.onclick = () => toggleNumber(i);
        grid.appendChild(btn);
    }
}

function setupEventListeners() {
    // ???꾪솚
    document.querySelectorAll('.lotto-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.tab;
            setMode(mode);
        });
    });

    // 珥덇린??踰꾪듉
    document.getElementById('btn-reset-board').addEventListener('click', resetBoard);

    // ?먮룞?좏깮 踰꾪듉
    document.getElementById('btn-auto-select').addEventListener('click', autoSelectNumbers);

    // ?뺤씤(異붽?) 踰꾪듉
    document.getElementById('btn-add-ticket').addEventListener('click', confirmSelection);

    // 紐⑤몢 ??젣 踰꾪듉
    document.getElementById('btn-reset-all').addEventListener('click', resetAllSlots);

    // 援щℓ?섍린 踰꾪듉
    document.getElementById('btn-buy-final').addEventListener('click', buyFinal);

    // ?щ’ ??젣 踰꾪듉??
    document.querySelectorAll('.delete-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slotId = e.target.closest('.cart-slot').dataset.slot;
            clearSlot(slotId);
        });
    });

    const saveBtn = document.getElementById('btn-save-my-number');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveMyNumber);
    }

    const savedList = document.getElementById('my-lotto-number-list');
    if (savedList) {
        savedList.addEventListener('click', handleSavedNumberListClick);
    }

    const prevDrawBtn = document.getElementById('btn-draw-prev');
    if (prevDrawBtn) {
        prevDrawBtn.addEventListener('click', () => moveDrawHistory(1));
    }

    const nextDrawBtn = document.getElementById('btn-draw-next');
    if (nextDrawBtn) {
        nextDrawBtn.addEventListener('click', () => moveDrawHistory(-1));
    }
}

function setMode(mode) {
    lottoState.currentMode = mode;

    // ??UI ?낅뜲?댄듃
    document.querySelectorAll('.lotto-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.lotto-tab[data-tab="${mode}"]`).classList.add('active');

    resetBoard();

    if (mode === 'ai') {
        runAIAnalysis();
    } else if (mode === 'auto') {
        // ?먮룞 紐⑤뱶 ?덈궡
    }
}

function toggleNumber(num) {
    if (lottoState.currentMode !== 'manual') {
        // ?섎룞 紐⑤뱶濡??먮룞 ?꾪솚
        setMode('manual');
    }

    if (lottoState.selectedNumbers.has(num)) {
        lottoState.selectedNumbers.delete(num);
    } else {
        if (lottoState.selectedNumbers.size >= 6) {
            return; // 6媛?珥덇낵 ?좏깮 遺덇?
        }
        lottoState.selectedNumbers.add(num);
    }
    renderNumberGrid();
}

function resetBoard() {
    lottoState.selectedNumbers.clear();
    renderNumberGrid();
}

function autoSelectNumbers() {
    lottoState.selectedNumbers.clear();
    const numbers = new Set();
    while (numbers.size < 6) {
        numbers.add(Math.floor(Math.random() * 45) + 1);
    }
    lottoState.selectedNumbers = numbers;
    renderNumberGrid();
    setMode('manual'); // 寃곌낵 ?뺤씤 ???섎룞?쇰줈 痍④툒
}

async function runAIAnalysis() {
    const aiTab = document.querySelector('.ai-tab');
    aiTab.innerHTML = '<div class="tab-title gpt-generation-loading">AI 분석 중...</div><div class="tab-desc">추천 번호를 계산하고 있습니다.</div>';

    try {
        const result = await API.getAIRecommendation();
        if (result.success) {
            lottoState.selectedNumbers = new Set(result.numbers);
            renderNumberGrid();
        }
    } catch (e) {
        alert('AI 추천 번호를 불러오지 못했습니다: ' + e.message);
        setMode('manual');
    } finally {
        aiTab.innerHTML = '<div class="tab-title">AI 추천</div><div class="tab-desc">최근 흐름을 기반으로 추천 번호를 제안합니다.</div>';
    }
}

function confirmSelection() {
    // 鍮??щ’ 李얘린
    const emptySlotId = Object.keys(lottoState.slots).find(key => lottoState.slots[key] === null);

    if (!emptySlotId) {
        alert('모든 슬롯(A~E)이 이미 채워져 있습니다.');
        return;
    }

    let numbers = [];
    let mode = 'MANUAL';

    if (lottoState.currentMode === 'auto') {
        numbers = []; // ?먮룞? 鍮?諛곗뿴 ?꾩넚 (?쒕쾭 洹쒓꺽 ?뺤씤 ?꾩슂, ?ш린?쒕뒗 ?쒖떆??'?먮룞', ?ㅼ젣 ?곗씠?곕뒗 鍮꾩썙??蹂대깂 or APIWrapper 濡쒖쭅 ?뺤씤)
        // 湲곗〈 APIWrapper???낅젰媛믪씠 ?놁쑝硫??먮룞??
        mode = 'AUTO';
    } else {
        if (lottoState.selectedNumbers.size !== 6) {
            const remaining = 6 - lottoState.selectedNumbers.size;
            if (remaining === 1) {
                alert('1개 더 선택해주세요.');
            } else {
                alert(`${remaining}개 더 선택해주세요.`);
            }
            return;
        }
        numbers = Array.from(lottoState.selectedNumbers).sort((a, b) => a - b);
    }

    // ?щ’ 梨꾩슦湲?
    fillSlot(emptySlotId, numbers, mode);
    resetBoard();
    setMode('manual'); // ?낅젰 ?꾩뿏 ?섎룞 紐⑤뱶濡?蹂듦? (?몄쓽??
}

function fillSlot(slotId, numbers, mode) {
    lottoState.slots[slotId] = { numbers, mode };

    const slotEl = document.querySelector(`.cart-slot[data-slot="${slotId}"]`);
    slotEl.classList.remove('empty');
    slotEl.classList.add('filled');

    const numbersContainer = slotEl.querySelector('.slot-numbers');

    if (mode === 'AUTO') {
        numbersContainer.innerHTML = '<span class="auto-badge">자동번호</span>';
    } else {
        numbersContainer.innerHTML = numbers.map(n => `<div class="mini-number">${n}</div>`).join('');
    }

    updatePriceDisplay();
}

function clearSlot(slotId) {
    lottoState.slots[slotId] = null;

    const slotEl = document.querySelector(`.cart-slot[data-slot="${slotId}"]`);
    slotEl.classList.add('empty');
    slotEl.classList.remove('filled');
    slotEl.querySelector('.slot-numbers').innerHTML = '';

    updatePriceDisplay();
}

function resetAllSlots() {
    Object.keys(lottoState.slots).forEach(key => clearSlot(key));
}

function updatePriceDisplay() {
    const count = Object.values(lottoState.slots).filter(v => v !== null).length;
    const total = count * lottoState.pricePerGame;

    document.getElementById('total-price').textContent = UI.formatCurrency(total);
    document.getElementById('btn-buy-final').disabled = count === 0;
    document.getElementById('btn-buy-final').textContent = count > 0 ? `${count}게임 구매하기` : '구매하기';
}

async function buyFinal() {
    const filledSlots = Object.values(lottoState.slots).filter(v => v !== null);
    if (filledSlots.length === 0) return;

    if (!Dialogs.confirm(`${filledSlots.length}게임을 구매하시겠습니까?`, true)) return;

    const tickets = filledSlots.map(slot => ({
        numbers: slot.mode === 'AUTO' ? '' : slot.numbers.join(',')
    }));

    UI.showLoading();

    try {
        const result = await API.buyLotto(tickets);

        if (result.success) {
            alert('구매가 완료되었습니다.');
            resetAllSlots();
            await loadDashboard();
        }
    } catch (error) {
        alert(error.message);
    } finally {
        UI.hideLoading();
        // 援щℓ ?꾨즺 ???섏씠吏 ?대룞?섏? ?딆쓬 (?ъ슜??寃쏀뿕 ?좎?)
    }
}

function getNumbersForSaving() {
    if (lottoState.selectedNumbers.size === 6) {
        return Array.from(lottoState.selectedNumbers).sort((a, b) => a - b);
    }

    const filledManualSlot = Object.values(lottoState.slots).find(
        (slot) => slot && slot.mode !== 'AUTO' && Array.isArray(slot.numbers) && slot.numbers.length === 6
    );
    if (filledManualSlot) {
        return [...filledManualSlot.numbers].sort((a, b) => a - b);
    }

    return [];
}

function renderSavedNumberList(items) {
    const container = document.getElementById('my-lotto-number-list');
    if (!container) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p class="saved-number-empty">저장된 지정번호가 없습니다.</p>';
        return;
    }

    container.innerHTML = items.map((item) => {
        const numbers = Array.isArray(item.numbers) ? item.numbers : [];
        const title = item.name ? escapeHtml(item.name) : `지정번호 #${item.id}`;
        const createdAt = formatDateTime(item.created_at);

        return `
            <article class="saved-number-item">
                <div class="saved-number-item-header">
                    <div class="saved-number-title">${title}</div>
                    <div class="saved-number-date">${createdAt}</div>
                </div>
                <div class="saved-number-balls">
                    ${numbers.map((n) => `<span class="mini-number">${n}</span>`).join('')}
                </div>
                <div class="saved-number-actions">
                    <button class="btn btn-secondary btn-small" type="button" data-action="use" data-id="${item.id}">슬롯 담기</button>
                    <button class="btn btn-outline btn-small" type="button" data-action="delete" data-id="${item.id}">삭제</button>
                </div>
            </article>
        `;
    }).join('');
}

function renderLastDrawPanel(draw) {
    const panel = document.getElementById('last-draw-panel');
    if (!panel) {
        return;
    }

    if (!draw || !Array.isArray(draw.numbers) || draw.numbers.length !== 6) {
        panel.innerHTML = '<p class="saved-number-empty">직전 회차 번호를 불러오지 못했습니다.</p>';
        return;
    }

    const roundLabel = Number.isInteger(draw.round) ? `${draw.round}회` : '-';
    const drawDate = draw.draw_date ? escapeHtml(draw.draw_date) : '-';
    const bonus = Number.isInteger(draw.bonus) ? draw.bonus : '-';
    const rankRows = Array.isArray(draw.ranks) ? draw.ranks : [];
    const firstRank = rankRows.find((row) => Number(row.rank) === 1) || null;
    const winnerSummary = draw.winner_summary || {};
    const totalSales = winnerSummary.total_sales_amount;
    const totalWinners = winnerSummary.total_winner_count;

    const rankTableRows = rankRows.length > 0
        ? rankRows.map((row) => `
            <tr>
                <td>${escapeHtml(`${row.rank}등`)}</td>
                <td class="is-currency">${formatCurrencyOrDash(row.total_prize_amount)}</td>
                <td>${formatCountOrDash(row.winner_count)}</td>
                <td class="is-currency">${formatCurrencyOrDash(row.prize_per_winner)}</td>
                <td>${escapeHtml(row.criteria || '-')}</td>
                <td class="is-remark">${escapeHtml(row.remark || '-')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="6">당첨금 정보를 불러오지 못했습니다.</td></tr>';

    panel.innerHTML = `
        <div class="last-draw-meta">회차: ${roundLabel} / 추첨일: ${drawDate}</div>
        <div class="last-draw-number-row">
            ${draw.numbers.map((n) => `<span class="draw-ball">${n}</span>`).join('')}
            <span class="last-draw-plus">+</span>
            <span class="draw-ball bonus">${bonus}</span>
        </div>
        <div class="draw-prize-highlight">
            <div class="draw-prize-main">1등 1게임당 ${formatCurrencyOrDash(firstRank?.prize_per_winner)}</div>
            <div class="draw-prize-sub">
                등위별 총 당첨금 ${formatCurrencyOrDash(firstRank?.total_prize_amount)}
                · 총 당첨게임 수 ${formatCountOrDash(totalWinners)}
                · 총 판매금액 ${formatCurrencyOrDash(totalSales)}
            </div>
        </div>
        <div class="draw-rank-table">
            <table>
                <thead>
                    <tr>
                        <th>순위</th>
                        <th>등위별 총 당첨금</th>
                        <th>당첨게임 수</th>
                        <th>1게임당 당첨금</th>
                        <th>당첨기준</th>
                        <th>비고</th>
                    </tr>
                </thead>
                <tbody>
                    ${rankTableRows}
                </tbody>
            </table>
        </div>
    `;
}

function getCurrentDrawHistoryItem() {
    if (!Array.isArray(state.drawHistory) || state.drawHistory.length === 0) {
        return null;
    }
    return state.drawHistory[state.drawHistoryIndex] || null;
}

function renderDrawNavigator() {
    const label = document.getElementById('draw-current-label');
    const prevBtn = document.getElementById('btn-draw-prev');
    const nextBtn = document.getElementById('btn-draw-next');
    const current = getCurrentDrawHistoryItem();

    if (label) {
        label.textContent = current && Number.isInteger(current.round) ? `${current.round}회` : '-';
    }

    const maxIndex = Math.max(0, state.drawHistory.length - 1);
    if (prevBtn) {
        prevBtn.disabled = state.drawHistoryIndex >= maxIndex;
    }
    if (nextBtn) {
        nextBtn.disabled = state.drawHistoryIndex <= 0;
    }
}

function moveDrawHistory(offset) {
    if (!Array.isArray(state.drawHistory) || state.drawHistory.length === 0) {
        return;
    }

    const maxIndex = state.drawHistory.length - 1;
    const nextIndex = Math.max(0, Math.min(maxIndex, state.drawHistoryIndex + offset));
    if (nextIndex === state.drawHistoryIndex) {
        return;
    }

    state.drawHistoryIndex = nextIndex;
    const current = getCurrentDrawHistoryItem();
    state.lastDraw = current;
    renderDrawNavigator();
    renderLastDrawPanel(current);
}

async function loadMyLottoNumbers() {
    try {
        const result = await API.getMyLottoNumbers();
        if (result.success) {
            const items = Array.isArray(result.items) ? result.items : [];
            state.myLottoNumbers = items;
            lottoState.savedNumbers = items;
            renderSavedNumberList(items);
            return;
        }
    } catch (error) {
        const container = document.getElementById('my-lotto-number-list');
        if (container) {
            container.innerHTML = `<p class="saved-number-empty">지정번호 불러오기 실패: ${escapeHtml(error.message)}</p>`;
        }
    }
}

async function loadDrawHistory() {
    try {
        const result = await API.getLottoDraws(80);
        if (result.success) {
            const items = Array.isArray(result.items) ? result.items : [];
            state.drawHistory = items;
            state.drawHistoryIndex = 0;
            state.lastDraw = items[0] || null;
            renderDrawNavigator();
            if (state.lastDraw) {
                renderLastDrawPanel(state.lastDraw);
            } else {
                const panel = document.getElementById('last-draw-panel');
                if (panel) {
                    panel.innerHTML = '<p class="saved-number-empty">회차 정보가 없습니다.</p>';
                }
            }
            return;
        }
    } catch (error) {
        try {
            const fallback = await API.getLastDraw();
            if (fallback.success) {
                state.drawHistory = fallback.draw ? [fallback.draw] : [];
                state.drawHistoryIndex = 0;
                state.lastDraw = state.drawHistory[0] || null;
                renderDrawNavigator();
                renderLastDrawPanel(state.lastDraw);
                return;
            }
        } catch (fallbackError) {
            const panel = document.getElementById('last-draw-panel');
            if (panel) {
                panel.innerHTML = `<p class="saved-number-empty">직전 회차 조회 실패: ${escapeHtml(fallbackError.message || error.message)}</p>`;
            }
        }
        state.drawHistory = [];
        state.drawHistoryIndex = 0;
        renderDrawNavigator();
    }
}

async function loadBuyReferenceData() {
    await Promise.allSettled([
        loadMyLottoNumbers(),
        loadDrawHistory()
    ]);
}

async function handleSaveMyNumber() {
    const numbers = getNumbersForSaving();
    if (numbers.length !== 6) {
        alert('저장할 번호 6개를 먼저 선택하거나 슬롯에 채워주세요.');
        return;
    }

    const nameInput = document.getElementById('my-number-name');
    const name = nameInput ? nameInput.value.trim() : '';

    UI.showLoading();
    try {
        const result = await API.saveMyLottoNumber(numbers, name || null);
        if (result.success) {
            if (nameInput) {
                nameInput.value = '';
            }
            alert('나의 지정번호에 저장했습니다.');
            await loadMyLottoNumbers();
        }
    } catch (error) {
        alert(`지정번호 저장 실패: ${error.message}`);
    } finally {
        UI.hideLoading();
    }
}

function insertSavedNumbersToSlot(numberId) {
    const item = lottoState.savedNumbers.find((entry) => Number(entry.id) === Number(numberId));
    if (!item || !Array.isArray(item.numbers) || item.numbers.length !== 6) {
        alert('선택한 지정번호 정보를 찾지 못했습니다.');
        return;
    }

    const numbers = item.numbers
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
        .sort((a, b) => a - b);
    if (numbers.length !== 6) {
        alert('선택한 지정번호 형식이 올바르지 않습니다.');
        return;
    }

    const emptySlotId = Object.keys(lottoState.slots).find((key) => lottoState.slots[key] === null);
    if (!emptySlotId) {
        alert('모든 슬롯(A~E)이 이미 채워져 있습니다.');
        return;
    }

    setMode('manual');
    fillSlot(emptySlotId, numbers, 'MANUAL');
}

async function deleteSavedNumber(numberId) {
    if (!Dialogs.confirm('이 지정번호를 삭제하시겠습니까?', true)) {
        return;
    }

    UI.showLoading();
    try {
        const result = await API.deleteMyLottoNumber(numberId);
        if (result.success) {
            await loadMyLottoNumbers();
        }
    } catch (error) {
        alert(`지정번호 삭제 실패: ${error.message}`);
    } finally {
        UI.hideLoading();
    }
}

function handleSavedNumberListClick(event) {
    if (!(event.target instanceof Element)) {
        return;
    }
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton) {
        return;
    }

    const action = actionButton.dataset.action;
    const numberId = Number(actionButton.dataset.id);
    if (!Number.isInteger(numberId)) {
        return;
    }

    if (action === 'use') {
        insertSavedNumbersToSlot(numberId);
    } else if (action === 'delete') {
        deleteSavedNumber(numberId);
    }
}

// ===== 援щℓ ?댁뿭 =====
function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addMonthsKeepingDay(date, months) {
    const result = new Date(date);
    const day = result.getDate();
    result.setMonth(result.getMonth() + months);

    // ?붾쭚 蹂댁젙 (?? 1/31 + 1媛쒖썡 -> 2??留먯씪)
    if (result.getDate() < day) {
        result.setDate(0);
    }
    return result;
}

async function loadHistory() {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    let startDate = startInput.value?.replace(/-/g, '');
    let endDate = endInput.value?.replace(/-/g, '');

    if (startInput.value && endInput.value) {
        const start = new Date(startInput.value);
        const end = new Date(endInput.value);
        const maxEnd = addMonthsKeepingDay(start, 1);

        if (end > maxEnd) {
            endInput.value = formatDateForInput(maxEnd);
            endDate = endInput.value.replace(/-/g, '');
            alert('구매내역 조회는 최대 1개월만 가능합니다. 종료일을 자동 조정했습니다.');
        }
    }

    UI.showLoading();

    try {
        const result = await API.getBuyList(startDate, endDate);

        if (result.success) {
            renderHistoryTable(result.data);
        }
    } catch (error) {
        alert('구매 내역을 불러오지 못했습니다.');
    } finally {
        UI.hideLoading();
    }
}

function renderHistoryTable(data) {
    const container = document.getElementById('history-table-container');

    if (!data || data.length === 0 || !data[0].rows || data[0].rows.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: 2rem;">구매 내역이 없습니다.</p>';
        return;
    }

    const tableData = data[0];

    const tableHTML = `
        <div class="history-table">
            <table>
                <thead>
                    <tr>
                        ${tableData.headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableData.rows.map(row => `
                        <tr>
                            ${row.map(cell => `<td>${cell}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;
}

function initHistoryPage() {
    // 湲곕낯 ?좎쭨 ?ㅼ젙 (理쒓렐 14??
    const today = new Date();
    const oneMonthAgo = addMonthsKeepingDay(today, -1);
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');

    endInput.value = formatDateForInput(today);
    startInput.value = formatDateForInput(oneMonthAgo);

    // ?쒖옉???좏깮 ??醫낅즺?쇱쓣 ?먮룞?쇰줈 1媛쒖썡 ?ㅻ줈 ?ㅼ젙 (理쒕? ?ㅻ뒛)
    startInput.addEventListener('change', () => {
        if (!startInput.value) {
            return;
        }
        const start = new Date(startInput.value);
        let autoEnd = addMonthsKeepingDay(start, 1);

        const now = new Date();
        if (autoEnd > now) {
            autoEnd = now;
        }
        endInput.value = formatDateForInput(autoEnd);
    });

    // 議고쉶 踰꾪듉
    document.getElementById('filter-history-btn').addEventListener('click', loadHistory);
    document.getElementById('refresh-history-btn').addEventListener('click', loadHistory);
}

// ===== 媛?곴퀎醫?=====
function renderVirtualAccount(accountInfo, username) {
    const container = document.getElementById('virtual-account-result');

    if (!accountInfo) {
        container.innerHTML = '<p class="virtual-account-empty">아직 발급된 가상계좌가 없습니다.</p>';
        return;
    }

    const assignedAt = accountInfo.assigned_at
        ? new Date(accountInfo.assigned_at).toLocaleString('ko-KR', { hour12: false })
        : '-';

    container.innerHTML = `
        <dl class="virtual-account-info">
            <div class="virtual-account-row">
                <dt>사용자</dt>
                <dd>${accountInfo.username || username || '-'}</dd>
            </div>
            <div class="virtual-account-row">
                <dt>은행명</dt>
                <dd>${accountInfo.bank_name || '-'}</dd>
            </div>
            <div class="virtual-account-row">
                <dt>가상계좌</dt>
                <dd class="virtual-account-number">${accountInfo.account || '-'}</dd>
            </div>
            <div class="virtual-account-row">
                <dt>예금주</dt>
                <dd>${accountInfo.account_holder || '-'}</dd>
            </div>
            <div class="virtual-account-row">
                <dt>신청금액</dt>
                <dd>${accountInfo.amount || '-'}</dd>
            </div>
            <div class="virtual-account-row">
                <dt>발급시각</dt>
                <dd>${assignedAt}</dd>
            </div>
        </dl>
        <p class="virtual-account-note">계좌주 이름을 확인한 뒤 직접 입금해주세요.</p>
    `;
}

async function loadVirtualAccount() {
    UI.showLoading();

    try {
        const result = await API.getVirtualAccount();

        if (result.success && result.has_account) {
            renderVirtualAccount(result.virtual_account, result.username);
        } else {
            renderVirtualAccount(null, result.username);
        }
    } catch (error) {
        document.getElementById('virtual-account-result').innerHTML =
            `<p class="virtual-account-empty">가상계좌 조회 실패: ${error.message}</p>`;
    } finally {
        UI.hideLoading();
    }
}

async function handleAssignVirtualAccount() {
    const amountEl = document.getElementById('virtual-account-amount');
    const amount = Number(amountEl.value);

    if (!Number.isInteger(amount) || amount <= 0) {
        alert('입금 금액을 확인해주세요.');
        return;
    }

    if (!Dialogs.confirm(`${UI.formatCurrency(amount)}으로 가상계좌를 발급하시겠습니까?`, true)) {
        return;
    }

    UI.showLoading();

    try {
        const result = await API.assignVirtualAccount(amount);

        if (result.success) {
            renderVirtualAccount(result, result.username);
            alert('가상계좌가 발급되었습니다.');
            await loadDashboard();
        }
    } catch (error) {
        alert(`가상계좌 발급 실패: ${error.message}`);
    } finally {
        UI.hideLoading();
    }
}

function initVirtualAccountPage() {
    if (document.body.dataset.virtualAccountBound === 'true') {
        return;
    }
    document.body.dataset.virtualAccountBound = 'true';

    // Delegate click handling so UI changes do not break fixed ID bindings.
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        const assignBtn = event.target.closest('#assign-virtual-account-btn');
        if (assignBtn) {
            event.preventDefault();
            handleAssignVirtualAccount();
            return;
        }

        const refreshBtn = event.target.closest('#refresh-virtual-account-btn');
        if (refreshBtn) {
            event.preventDefault();
            loadVirtualAccount();
        }
    });
}

function safeBind(elementId, eventName, handler) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`[init] element not found: #${elementId}`);
        return;
    }
    element.addEventListener(eventName, handler);
}

function safeInit(name, initFn) {
    try {
        initFn();
    } catch (error) {
        console.error(`[init] ${name} failed`, error);
    }
}

// ===== ?ㅻ퉬寃뚯씠??=====
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            UI.showPage(page);

            // ?섏씠吏蹂?珥덇린??
            if (page === 'dashboard') {
                loadDashboard();
            } else if (page === 'buy') {
                refreshWeeklyRemainingBadge();
                loadBuyReferenceData();
            } else if (page === 'history') {
                loadHistory();
            } else if (page === 'virtual-account') {
                loadVirtualAccount();
            }
        });
    });

    // ?덈줈怨좎묠 踰꾪듉
    document.getElementById('refresh-balance-btn').addEventListener('click', loadDashboard);
}

// ===== ?몄뀡 ?뺤씤 =====
async function checkSession() {
    try {
        const result = await API.checkSession();

        if (result.authenticated) {
            state.isAuthenticated = true;
            state.username = result.username;

            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('username-display').textContent = result.username;

            await loadDashboard();
        }
    } catch (error) {
        // ?몄뀡 ?놁쓬 - 濡쒓렇???섏씠吏 ?좎?
    }
}

// ===== 珥덇린??=====
document.addEventListener('DOMContentLoaded', () => {
    safeBind('login-form', 'submit', handleLogin);
    safeBind('logout-btn', 'click', handleLogout);

    safeInit('navigation', initNavigation);
    safeInit('buy-page', initBuyPage);
    safeInit('history-page', initHistoryPage);
    safeInit('virtual-account-page', initVirtualAccountPage);

    checkSession().catch((error) => {
        console.error('[session] check failed', error);
    });
});



