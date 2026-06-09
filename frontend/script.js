const API_URL = 'http://127.0.0.1:8000';

// Elementy interfejsu logowania i nawigacji podstawowej
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const appDashboard = document.getElementById('app-dashboard');
const authContainer = document.querySelector('.auth-container');
const welcomeMessage = document.getElementById('welcome-message');
const userDisplayEmail = document.getElementById('user-display-email');
const userAvatar = document.getElementById('user-avatar');
const sessionExpiredAlert = document.getElementById('session-expired-alert');

// Elementy okna profilu
const profileModal = document.getElementById('profile-modal');
const openProfileBtn = document.getElementById('open-profile-btn');
const closeProfileBtn = document.getElementById('close-profile-btn');

// Elementy nawigacji stron
const navBtnDashboard = document.getElementById('nav-btn-dashboard');
const navBtnReports = document.getElementById('nav-btn-reports');
const pageDashboard = document.getElementById('page-dashboard');
const pageReports = document.getElementById('page-reports');

// Formularze
const expenseForm = document.getElementById('expense-form');
const incomeForm = document.getElementById('income-form');

// Stan aplikacji
let categories = [];
let expenses = [];
let incomes = [];

// Stan nowych funkcjonalności
let reportChartInstance = null;
let currentHistoryPage = 1;
const EXPENSES_PER_PAGE = 10;
let currentSortField = null;
let currentSortOrder = null;
let editingTransactionId = null;

// ============================================================
// POWIADOMIENIA I DIALOGI
// ============================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3600);
}

function showConfirm(message, title = 'Potwierdzenie') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const messageEl = document.getElementById('confirm-modal-message');
        const okBtn = document.getElementById('confirm-modal-ok');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
            resolve(window.confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';

        const close = (result) => {
            modal.style.display = 'none';
            okBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onEscape);
            resolve(result);
        };

        const onConfirm = () => close(true);
        const onCancel = () => close(false);
        const onOverlayClick = (event) => {
            if (event.target === modal) close(false);
        };
        const onEscape = (event) => {
            if (event.key === 'Escape') close(false);
        };

        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onEscape);
    });
}

// ============================================================
// OBSŁUGA SESJI I ZAPYTANIA DO API
// ============================================================

function handleSessionExpired() {
    localStorage.removeItem('token');

    appDashboard.style.display = 'none';
    authContainer.style.display = 'block';
    loginSection.style.display = 'block';
    registerSection.style.display = 'none';

    if (sessionExpiredAlert) {
        sessionExpiredAlert.style.display = 'block';
    }
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');

    options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            handleSessionExpired();
            return null;
        }

        return response;
    } catch (error) {
        console.error('Błąd połączenia z API:', error);
        throw error;
    }
}

// ============================================================
// NAWIGACJA
// ============================================================

if (navBtnDashboard && navBtnReports) {
    navBtnDashboard.addEventListener('click', () => {
        navBtnDashboard.classList.add('active');
        navBtnReports.classList.remove('active');
        if (pageDashboard) pageDashboard.style.display = 'block';
        if (pageReports) pageReports.style.display = 'none';
        currentHistoryPage = 1;
        renderExpenses();
    });

    navBtnReports.addEventListener('click', () => {
        navBtnReports.classList.add('active');
        navBtnDashboard.classList.remove('active');
        if (pageDashboard) pageDashboard.style.display = 'none';
        if (pageReports) pageReports.style.display = 'block';

        const now = new Date();
        if (document.getElementById('report-month')) document.getElementById('report-month').value = String(now.getMonth() + 1).padStart(2, '0');
        if (document.getElementById('report-year')) document.getElementById('report-year').value = String(now.getFullYear());
    });
}

// Nawigacja: Przełączanie ekranów autoryzacji
if (document.getElementById('go-to-register')) {
    document.getElementById('go-to-register').addEventListener('click', () => {
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    });
}

if (document.getElementById('go-to-login')) {
    document.getElementById('go-to-login').addEventListener('click', () => {
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
    });
}

// ============================================================
// OBSŁUGA MODALA PROFILU
// ============================================================

if (openProfileBtn) {
    openProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (profileModal) profileModal.style.display = 'flex';
    });
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (profileModal) profileModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (profileModal && e.target === profileModal) {
        profileModal.style.display = 'none';
    }
});

// ============================================================
// ŁADOWANIE DANYCH Z BACKENDU
// ============================================================

async function loadCategories() {
    const response = await fetchWithAuth(`${API_URL}/categories`);
    if (!response) return;

    try {
        if (!response.ok) {
            throw new Error('Błąd pobierania kategorii');
        }
        categories = await response.json();
        renderCategories();
    } catch (error) {
        console.error('Błąd kategorii:', error);
    }
}

async function loadExpenses() {
    const response = await fetchWithAuth(`${API_URL}/expenses`);
    if (!response) return;

    try {
        if (!response.ok) {
            throw new Error('Błąd pobierania wydatków');
        }

        const data = await response.json();
        expenses = data.items;
        renderExpenses();
    } catch (error) {
        console.error('Błąd wydatków:', error);
    }
}

async function loadIncomes() {

    const token = localStorage.getItem('token');
    if (!token) {
        return;
    }
    try {
        const response = await fetch(
            `${API_URL}/incomes`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Błąd pobierania dochodów');
        }
        incomes = await response.json();
        renderExpenses();
    } catch (error) {
        console.error('Błąd dochodów:', error);
    }
}

// ============================================================
// FUNKCJE RENDERUJĄCE
// ============================================================

function renderCategories() {
    const categoriesList = document.getElementById('categories-list');
    const expenseCategorySelect = document.getElementById('expense-category');
    const filterCategorySelect = document.getElementById('filter-category');

    if (categoriesList) {
        categoriesList.innerHTML = '';
        categories.forEach(cat => {
            const tag = document.createElement('span');
            tag.className = 'category-tag';
            tag.textContent = cat.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete-category';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = `Usuń kategorię: ${cat.name}`;

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Sprawdzenie, czy kategoria jest aktualnie używana w jakimś wydatku
                const isUsed = expenses.some(exp => exp.category_id === cat.id);
                if (isUsed) {
                    showToast(`Nie możesz usunąć kategorii "${cat.name}", ponieważ są do niej przypisane aktywne wydatki!`, 'error');
                    return;
                }

                const confirmed = await showConfirm(`Czy na pewno chcesz usunąć kategorię "${cat.name}"?`, 'Usuń kategorię');
                if (confirmed) {
                    try {
                        const response = await fetchWithAuth(`${API_URL}/categories/${cat.id}`, { method: 'DELETE' });
                        if (!response || !response.ok) {
                            throw new Error('Nie udało się usunąć kategorii');
                        }
                        await loadCategories();
                        showToast(`Usunięto kategorię "${cat.name}".`, 'success');
                    } catch (error) {
                        console.error(error);
                        showToast('Nie udało się usunąć kategorii.', 'error');
                    }
                }
            });

            tag.appendChild(deleteBtn);
            categoriesList.appendChild(tag);
        });
    }

    if (expenseCategorySelect) {
        expenseCategorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            expenseCategorySelect.appendChild(option);
        });
    }

    if (filterCategorySelect) {
        const current = filterCategorySelect.value;
        filterCategorySelect.innerHTML = '<option value="">Wszystkie kategorie</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            filterCategorySelect.appendChild(option);
        });
        filterCategorySelect.value = current;
    }
}

function renderExpenses() {
    const tbody = document.getElementById('expenses-list-body');
    const noExpensesAlert = document.getElementById('no-expenses-alert');
    const totalIncomeEl = document.getElementById('total-income-sum');
    const totalSumEl = document.getElementById('total-expenses-sum');
    const totalBalanceEl = document.getElementById('total-balance-left');
    const balanceBadgeContainer = document.getElementById('balance-badge-container');
    const incomeInput = document.getElementById('monthly-income-input');
    const paginationContainer = document.getElementById('history-pagination');

    if (!tbody) return;

    tbody.innerHTML = '';
    let totalSum = 0;

    // Filtry
    const searchTitle = document.getElementById('search-title')?.value.toLowerCase().trim() || '';
    const filterType = document.getElementById('filter-type')?.value || '';
    const filterCategory = document.getElementById('filter-category')?.value || '';
    const dateFrom = document.getElementById('filter-date-from')?.value || '';
    const dateTo = document.getElementById('filter-date-to')?.value || '';
    const amountMin = document.getElementById('filter-amount-min')?.value || '';
    const amountMax = document.getElementById('filter-amount-max')?.value || '';
    const allTransactions = [
        ...expenses.map(exp => ({
            ...exp,
            type: 'expense'
        })),
        ...incomes.map(income => ({
            ...income,
            type: 'income'
        }))
    ];


    const filtered = allTransactions.filter(item => {
        const category = categories.find(c => c.id === item.category_id);
        const catName = category ? category.name : '';
        const itemDate = item.date.substring(0, 10);
        
        if (filterType && item.type !== filterType) return false;
        if (searchTitle && !item.description.toLowerCase().includes(searchTitle)) return false;
        if (filterCategory && catName !== filterCategory) return false;
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo && itemDate > dateTo) return false;
        if (amountMin && parseFloat(item.amount) < parseFloat(amountMin)) return false;
        if (amountMax && parseFloat(item.amount) > parseFloat(amountMax)) return false;
        return true;
    });

    updateSortArrowsUI();

    // Sortowanie
    if (currentSortField !== null) {
        filtered.sort((a, b) => {
            let valA = a[currentSortField];
            let valB = b[currentSortField];

            if (currentSortField === 'amount') {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else if (currentSortField === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            }

            if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Obliczanie sumy (z pełnej listy, bez filtrów)
    expenses.forEach(exp => {
        totalSum += parseFloat(exp.amount);
    });

    if (totalSumEl) totalSumEl.textContent = totalSum.toFixed(2);

    // Obsługa przychodu i bilansu

    const totalIncome = incomes.reduce(
        (sum, income) => sum + parseFloat(income.amount),
        0
    );

    if (totalIncomeEl) {
        totalIncomeEl.textContent = totalIncome.toFixed(2);
    }

    let balanceLeft = totalIncome - totalSum;
    if (totalBalanceEl) totalBalanceEl.textContent = balanceLeft.toFixed(2);

    if (balanceBadgeContainer) {
        if (balanceLeft < 0) {
            balanceBadgeContainer.style.backgroundColor = '#fee2e2';
            balanceBadgeContainer.style.color = '#dc2626';
        } else {
            balanceBadgeContainer.style.backgroundColor = '#dcfce7';
            balanceBadgeContainer.style.color = '#15803d';
        }
    }

    // Paginacja
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / EXPENSES_PER_PAGE) || 1;
    if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;

    if (totalCount === 0) {
        if (noExpensesAlert) noExpensesAlert.style.display = 'block';
        if (paginationContainer) paginationContainer.style.display = 'none';
    } else {
        if (noExpensesAlert) noExpensesAlert.style.display = 'none';

        const startIndex = (currentHistoryPage - 1) * EXPENSES_PER_PAGE;
        const pageItems = filtered.slice(startIndex, startIndex + EXPENSES_PER_PAGE);

        pageItems.forEach(item => {
            const category = categories.find(c => c.id === item.category_id);

            const d = new Date(item.date + "Z");

            const formattedDate =
                `${d.getDate()}.` +
                `${String(d.getMonth() + 1).padStart(2, '0')}.` +
                `${d.getFullYear()} ` +
                `${String(d.getHours()).padStart(2, '0')}:` +
                `${String(d.getMinutes()).padStart(2, '0')}`;

            const isIncome = item.type === 'income';

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td><strong>${item.description}</strong></td>

                <td>
                    <span class="category-tag">
                        ${isIncome ? 'Dochód' : 'Wydatek'}
                    </span>
                </td>

                <td>
                    ${
                        isIncome
                            ? '-'
                            : `<span class="category-tag">
                                ${category ? category.name : 'Brak kategorii'}
                            </span>`
                    }
                </td>

                <td>${formattedDate}</td>

                <td class="${isIncome ? 'text-income' : 'amount-text'}">
                    ${isIncome ? '+' : '-'}${parseFloat(item.amount).toFixed(2)} PLN
                </td>

                <td style="text-align:center;">
                    <div class="actions-cell-wrapper">

                        ${
                            !isIncome
                                ? `<button class="btn-edit-expense">✎</button>`
                                : ''
                        }

                        <button
                            class="btn-delete-transaction"
                            data-type="${item.type}"
                            data-id="${item.id}">
                            &times;
                        </button>

                    </div>
                </td>
            `;
                tr.querySelector('.btn-delete-transaction')
                .addEventListener('click', async () => {

                    const confirmed = await showConfirm(
                        'Czy na pewno chcesz usunąć tę pozycję?',
                        'Usuń'
                    );

                    if (!confirmed) return;

                    const endpoint =
                        item.type === 'income'
                            ? `${API_URL}/incomes/${item.id}`
                            : `${API_URL}/expenses/${item.id}`;

                    try {
                        const response = await fetchWithAuth(
                            endpoint,
                            {
                                method: 'DELETE'
                            }
                        );

                        if (!response || !response.ok) {
                            throw new Error();
                        }

                        await loadExpenses();
                        await loadIncomes();

                        showToast(
                            item.type === 'income'
                                ? 'Dochód został usunięty.'
                                : 'Wydatek został usunięty.',
                            'success'
                        );

                    } catch (error) {
                        showToast(
                            'Nie udało się usunąć pozycji.',
                            'error'
                        );
                    }
                });
            const editBtn = tr.querySelector('.btn-edit-expense');

            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    startEditingExpense(item.id);
                });
            }

            tbody.appendChild(tr);
        });

        if (paginationContainer) {
            paginationContainer.style.display = totalCount > EXPENSES_PER_PAGE ? 'flex' : 'none';
            const paginationInfo = document.getElementById('pagination-info');
            if (paginationInfo) paginationInfo.textContent = `Strona ${currentHistoryPage} z ${totalPages}`;
            const btnPrev = document.getElementById('btn-prev-page');
            const btnNext = document.getElementById('btn-next-page');
            if (btnPrev) btnPrev.disabled = currentHistoryPage === 1;
            if (btnNext) btnNext.disabled = currentHistoryPage === totalPages;
        }
    }
}

// ============================================================
// PAGINACJA
// ============================================================

const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
if (btnPrevPage && btnNextPage) {
    btnPrevPage.addEventListener('click', () => {
        if (currentHistoryPage > 1) { currentHistoryPage--; renderExpenses(); }
    });
    btnNextPage.addEventListener('click', () => {
        currentHistoryPage++;
        renderExpenses();
    });
}

// ============================================================
// SORTOWANIE
// ============================================================

function updateSortArrowsUI() {
    const dateArrow = document.querySelector('#th-date .sort-arrow');
    const amountArrow = document.querySelector('#th-amount .sort-arrow');

    if (!dateArrow || !amountArrow) return;

    dateArrow.textContent = '';
    amountArrow.textContent = '';

    if (currentSortField !== null && currentSortOrder !== null) {
        const arrowChar = currentSortOrder === 'asc' ? '↑' : '↓';
        if (currentSortField === 'date') {
            dateArrow.textContent = arrowChar;
        } else if (currentSortField === 'amount') {
            amountArrow.textContent = arrowChar;
        }
    }
}

function handleSortClick(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'desc';
    }
    currentHistoryPage = 1;
    renderExpenses();
}

// ============================================================
// EDYTOWANIE WYDATKU
// ============================================================

function startEditingExpense(id) {
    const exp = expenses.find(item => item.id === id);
    if (!exp) return;

    cancelEditing();
    editingTransactionId = id;

    const category = categories.find(c => c.id === exp.category_id);

    if (document.getElementById('expense-title')) document.getElementById('expense-title').value = exp.description;
    if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = exp.amount;
    if (document.getElementById('expense-date')) document.getElementById('expense-date').value = exp.date.substring(0, 10);
    if (document.getElementById('expense-category') && category) document.getElementById('expense-category').value = category.name;

    const headingEl = document.getElementById('form-expense-title-heading');
    if (headingEl) headingEl.textContent = 'Edytuj wydatek';

    const submitBtn = document.getElementById('expense-submit-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Zapisz zmiany';
        submitBtn.classList.add('btn-mode-edit');
    }

    const cancelBtn = document.getElementById('btn-cancel-expense-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';
}

function cancelEditing() {
    editingTransactionId = null;

    if (expenseForm) {
        expenseForm.reset();
        const dateInput = document.getElementById('expense-date');
        if (dateInput) dateInput.valueAsDate = new Date();
        const headingEl = document.getElementById('form-expense-title-heading');
        if (headingEl) headingEl.textContent = 'Dodaj nowy wydatek';
        const subBtn = document.getElementById('expense-submit-btn');
        if (subBtn) {
            subBtn.textContent = 'Zapisz wydatek';
            subBtn.classList.remove('btn-mode-edit');
        }
        const cancelBtn = document.getElementById('btn-cancel-expense-edit');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

document.getElementById('btn-cancel-expense-edit')?.addEventListener('click', cancelEditing);

// ============================================================
// FORMULARZ: DODAWANIE KATEGORII
// ============================================================

const categoryForm = document.getElementById('category-form');
if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('category-name').value.trim();

        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            showToast('Taka kategoria już istnieje!', 'error');
            return;
        }

        try {
            const response = await fetchWithAuth(`${API_URL}/categories`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            if (!response || !response.ok) {
                throw new Error('Nie udało się utworzyć kategorii');
            }

            await loadCategories();
            categoryForm.reset();
            showToast(`Dodano kategorię "${name}".`, 'success');

        } catch (error) {
            console.error(error);
            showToast('Nie udało się utworzyć kategorii.', 'error');
        }
    });
}

// ============================================================
// FORMULARZ: DODAWANIE/EDYTOWANIE WYDATKU
// ============================================================

if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('expense-title').value.trim();
        const amount = document.getElementById('expense-amount').value;
        const date = document.getElementById('expense-date').value;
        const categoryName = document.getElementById('expense-category').value;

        const category = categories.find(c => c.name === categoryName);

        if (!category) {
            showToast('Nie znaleziono kategorii.', 'error');
            return;
        }

        try {
            if (editingTransactionId !== null) {
                // Edytowanie istniejącego wydatku
                const response = await fetchWithAuth(`${API_URL}/expenses/${editingTransactionId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        description: title,
                        category_id: category.id,
                        date: date
                    })
                });

                if (!response || !response.ok) {
                    throw new Error('Nie udało się zaktualizować wydatku');
                }

                cancelEditing();
                showToast('Wydatek został zaktualizowany.', 'success');
            } else {
                // Dodawanie nowego wydatku
                const response = await fetchWithAuth(`${API_URL}/expenses`, {
                    method: 'POST',
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        description: title,
                        category_id: category.id
                    })
                });

                if (!response || !response.ok) {
                    throw new Error('Nie udało się dodać wydatku');
                }

                expenseForm.reset();
                if (document.getElementById('expense-date')) {
                    document.getElementById('expense-date').valueAsDate = new Date();
                }
                showToast('Dodano nowy wydatek.', 'success');
            }

            currentHistoryPage = 1;
            await loadExpenses();

        } catch (error) {
            console.error(error);
            showToast('Nie udało się zapisać wydatku.', 'error');
        }
    });
}

// ============================================================
// FORMULARZ: DODAWANIE DOCHODU (nowa funkcjonalność - bez backendu)
// ============================================================

if (incomeForm) {
    
    incomeForm.addEventListener('submit', async (e) => {
        console.log('INCOME SUBMIT');
        e.preventDefault();
        const title =
            document.getElementById('income-title')
            .value
            .trim();

        const amount =
            document.getElementById('income-amount')
            .value;

        const token =
            localStorage.getItem('token');

        try {
            const response = await fetch(
                `${API_URL}/incomes`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        description: title
                    })
                }
            );

            if (!response.ok) {
                throw new Error(
                    'Nie udało się dodać dochodu'
                );
            }

            await loadIncomes();

            incomeForm.reset();

            if (
                document.getElementById(
                    'income-date'
                )
            ) {
                document.getElementById(
                    'income-date'
                ).valueAsDate = new Date();
            }

            showToast(
                'Dodano nowy dochód.',
                'success'
            );

        } catch (error) {
            console.error(error);

            alert(
                'Nie udało się dodać dochodu'
            );
        }
    });
}

// ============================================================
// FILTRY
// ============================================================

const filterIds = [
    'search-title',
    'filter-type',
    'filter-category',
    'filter-date-from',
    'filter-date-to',
    'filter-amount-min',
    'filter-amount-max'
];
filterIds.forEach(id => document.getElementById(id)?.addEventListener('input', () => {
    currentHistoryPage = 1;
    renderExpenses();
}));

document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentSortField = null;
    currentSortOrder = null;
    currentHistoryPage = 1;
    renderExpenses();
});

// ============================================================
// RAPORTY
// ============================================================

document.getElementById('btn-generate-report')?.addEventListener('click', () => {
    const selectedMonth = document.getElementById('report-month').value;
    const selectedYear = document.getElementById('report-year').value;

    const area = document.getElementById('report-results-area');
    const empty = document.getElementById('report-empty-state');
    const tbody = document.getElementById('report-expenses-body');

    if (expenses.length === 0) {
        if (area) area.style.display = 'none';
        if (empty) { empty.style.display = 'block'; empty.textContent = 'Brak danych dla wybranego okresu.'; }
        showToast('Brak danych dla wybranego okresu.', 'warning');
        return;
    }

    // Filtrowanie wydatków według wybranego miesiąca i roku
    const monthlyExpenses = expenses.filter(exp => {
        const d = new Date(exp.date + "Z");
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const y = String(d.getFullYear());
        return m === selectedMonth && y === selectedYear;
    });

    if (monthlyExpenses.length === 0) {
        if (area) area.style.display = 'none';
        if (empty) { empty.style.display = 'block'; empty.textContent = 'Brak danych dla wybranego okresu.'; }
        showToast('Brak danych dla wybranego okresu.', 'warning');
        return;
    }

    if (empty) empty.style.display = 'none';
    if (area) area.style.display = 'block';
    if (tbody) tbody.innerHTML = '';

    let expenseSum = 0;
    const categorySums = {};

    monthlyExpenses.forEach(exp => {
        const category = categories.find(c => c.id === exp.category_id);
        const catName = category ? category.name : 'Brak kategorii';
        const amt = parseFloat(exp.amount);

        expenseSum += amt;
        categorySums[catName] = (categorySums[catName] || 0) + amt;

        const d = new Date(exp.date + "Z");
        const formattedDate =
            `${d.getDate()}.` +
            `${String(d.getMonth() + 1).padStart(2, '0')}.` +
            `${d.getFullYear()}`;

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${exp.description}</strong></td>
                <td>Wydatek</td>
                <td>${catName}</td>
                <td>${formattedDate}</td>
                <td class="text-expense">-${amt.toFixed(2)} PLN</td>
            `;
            tbody.appendChild(tr);
        }
    });

    const monthlyIncomes = incomes.filter(income => {
        const d = new Date(income.date + "Z");
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const y = String(d.getFullYear());
        return m === selectedMonth && y === selectedYear;
    });

    const incomeSum = monthlyIncomes.reduce(
        (sum, income) => sum + parseFloat(income.amount),
        0
    );

    const repIncome = document.getElementById('rep-stat-income');
    if (repIncome) {
        repIncome.textContent = `${incomeSum.toFixed(2)} PLN`;
    }

    let bal = incomeSum - expenseSum;

    const repExpenses = document.getElementById('rep-stat-expenses');
    if (repExpenses) repExpenses.textContent = `${expenseSum.toFixed(2)} PLN`;

    const balEl = document.getElementById('rep-stat-balance');
    if (balEl) {
        balEl.textContent = `${bal.toFixed(2)} PLN`;
        balEl.className = `stat-value ${bal >= 0 ? 'text-green' : 'text-red'}`;
    }

    const days = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
    const repAvg = document.getElementById('rep-stat-avg');
    if (repAvg) repAvg.textContent = `${(expenseSum / days).toFixed(2)} PLN`;

    const chartCanvas = document.getElementById('report-pie-chart');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if (reportChartInstance) reportChartInstance.destroy();

        reportChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categorySums),
                datasets: [{
                    data: Object.values(categorySums),
                    backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    showToast('Raport został wygenerowany.', 'success');
});

// ============================================================
// DANE UŻYTKOWNIKA I INICJALIZACJA DASHBOARDU
// ============================================================

async function getCurrentUser() {
    const response = await fetchWithAuth(`${API_URL}/me`);
    if (!response) return null;

    try {
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function setupDashboardUI(email) {
    authContainer.style.display = 'none';
    appDashboard.style.display = 'flex';

    if (welcomeMessage) {
        welcomeMessage.textContent = '';
        welcomeMessage.style.display = 'none';
    }
    if (userDisplayEmail) userDisplayEmail.textContent = email;
    if (email && email.length > 0 && userAvatar) {
        userAvatar.textContent = email.charAt(0).toUpperCase();
    }

    if (sessionExpiredAlert) sessionExpiredAlert.style.display = 'none';

    if (document.getElementById('expense-date')) {
        document.getElementById('expense-date').valueAsDate = new Date();
    }
    if (document.getElementById('income-date')) {
        document.getElementById('income-date').valueAsDate = new Date();
    }

    await loadCategories();
    await loadExpenses();
    await loadIncomes();
}

// ============================================================
// FORMULARZ LOGOWANIA
// ============================================================

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.access_token);
                loginForm.reset();
                await setupDashboardUI(email);
                showToast('Zalogowano pomyślnie.', 'success');
            } else {
                showToast('Błąd logowania: ' + (data.detail || 'Niepoprawne dane.'), 'error');
            }
        } catch (error) {
            showToast('Nie można połączyć się z serwerem backendu.', 'error');
        }
    });
}

// ============================================================
// FORMULARZ REJESTRACJI
// ============================================================

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;

        if (password !== passwordConfirm) {
            showToast('Hasła nie są identyczne!', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (response.ok) {
                registerForm.reset();
                registerSection.style.display = 'none';
                loginSection.style.display = 'block';
                document.getElementById('login-email').value = email;
                showToast('Konto zostało utworzone. Możesz się zalogować.', 'success');
            } else {
                const data = await response.json();
                showToast('Błąd: ' + data.detail, 'error');
            }
        } catch (error) {
            showToast('Brak połączenia z API.', 'error');
        }
    });
}

// ============================================================
// PROFIL: ZMIANA HASŁA
// ============================================================

const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('profile-new-password').value;
        const newPasswordConfirm = document.getElementById('profile-new-password-confirm').value;

        if (newPassword !== newPasswordConfirm) {
            showToast('Nowe hasła nie są identyczne!', 'error');
            return;
        }
        showToast('Hasło zmienione pomyślnie!', 'success');
        if (profileModal) profileModal.style.display = 'none';
        changePasswordForm.reset();
    });
}

// ============================================================
// PROFIL: USUWANIE KONTA
// ============================================================

const deleteAccountBtn = document.getElementById('delete-account-btn');
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmed = await showConfirm('Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.', 'Usuń konto');
        if (!confirmed) return;

        localStorage.clear();
        showToast('Konto zostało usunięte.', 'success');
        setTimeout(() => location.reload(), 900);
    });
}

// ============================================================
// WYLOGOWANIE
// ============================================================

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        location.reload();
    });
}

// ============================================================
// INICJALIZACJA APLIKACJI
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {
    // Obsługa kliknięć sortowania
    document.getElementById('th-date')?.addEventListener('click', () => handleSortClick('date'));
    document.getElementById('th-amount')?.addEventListener('click', () => handleSortClick('amount'));

    // Automatyczne logowanie na podstawie tokena
    const user = await getCurrentUser();
    if (user) {
        await setupDashboardUI(user.email);
    }
});