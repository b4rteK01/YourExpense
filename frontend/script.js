const API_URL = 'http://127.0.0.1:8000';

// Elementy interfejsu logowania i nawigacji podstawowej
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const appDashboard = document.getElementById('app-dashboard');
const authContainer = document.querySelector('.auth-container');
const welcomeMessage = document.getElementById('welcome-message');
const userDisplayEmail = document.getElementById('user-display-email');
const userAvatar = document.getElementById('user-avatar');

// Elementy okna profilu
const profileModal = document.getElementById('profile-modal');
const openProfileBtn = document.getElementById('open-profile-btn');
const closeProfileBtn = document.getElementById('close-profile-btn');

// BAZA DANYCH W PAMIĘCI LOKALNEJ
let categories = [];

let expenses = JSON.parse(localStorage.getItem('user_expenses')) || [];

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

// OBSŁUGA MODALA PROFILU
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

async function loadCategories() {

    const token = localStorage.getItem('token');

    if (!token) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/categories`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Błąd pobierania kategorii');
        }

        categories = await response.json();

        renderCategories();

    } catch (error) {

        console.error('Błąd kategorii:', error);

    }
}

// FUNKCJE RENDERUJĄCE PANEL FINANSOWY
function renderCategories() {
    const categoriesList = document.getElementById('categories-list');
    const expenseCategorySelect = document.getElementById('expense-category');
    
    if (categoriesList) {
        categoriesList.innerHTML = '';
        categories.forEach(cat => {
            const tag = document.createElement('span');
            tag.className = 'category-tag';
            tag.textContent = cat.name;

            // Tworzenie przycisku X, który pojawi się po najechaniu kursorem
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete-category';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = `Usuń kategorię: ${cat.name}`;
            
            // Reakcja na kliknięcie w przycisk usuwania kategorii
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Zapobiega błędom propagacji eventów
                
                // Sprawdzenie, czy kategoria jest aktualnie używana w jakimś wydatku
                const isUsed = expenses.some(exp => exp.category.toLowerCase() === cat.name.toLowerCase());
                if (isUsed) {
                    alert(`Nie możesz usunąć kategorii "${cat.name}", ponieważ są do niej przypisane aktywne wydatki!`);
                    return;
                }

                if (confirm(`Czy na pewno chcesz usunąć kategorię "${cat.name}"?`)) {
                    const token = localStorage.getItem('token');
                    try {
                        const response = await fetch(
                            `${API_URL}/categories/${cat.id}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    Authorization: `Bearer ${token}`
                                }
                            }
                        );
                        if (!response.ok) {
                            throw new Error('Nie udało się usunąć kategorii');
                        }
                        await loadCategories();
                    } catch (error) {
                        console.error(error);
                        alert('Nie udało się usunąć kategorii');
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
}

function renderExpenses() {
    const tbody = document.getElementById('expenses-list-body');
    const noExpensesAlert = document.getElementById('no-expenses-alert');
    const totalSumEl = document.getElementById('total-expenses-sum');
    const totalBalanceEl = document.getElementById('total-balance-left');
    const balanceBadgeContainer = document.getElementById('balance-badge-container');
    const incomeInput = document.getElementById('monthly-income-input');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let totalSum = 0;

    // Obliczanie sumy wydatków
    if (expenses.length === 0) {
        if (noExpensesAlert) noExpensesAlert.style.display = 'block';
    } else {
        if (noExpensesAlert) noExpensesAlert.style.display = 'none';
        
        expenses.forEach(exp => {
            totalSum += parseFloat(exp.amount);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${exp.title}</strong></td>
                <td><span class="category-tag">${exp.category}</span></td>
                <td>${exp.date}</td>
                <td class="amount-text">${parseFloat(exp.amount).toFixed(2)} PLN</td>
                <td style="text-align: center;">
                    <button class="btn-delete-expense" data-id="${exp.id}">&times;</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    if (totalSumEl) totalSumEl.textContent = totalSum.toFixed(2);

    // Obsługa przychodu i bilansu
    let savedIncome = parseFloat(localStorage.getItem('user_income')) || 0;
    
    if (incomeInput && !incomeInput.dataset.listenerSet) {
        incomeInput.value = savedIncome > 0 ? savedIncome : '';
        incomeInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value) || 0;
            localStorage.setItem('user_income', val);
            renderExpenses();
        });
        incomeInput.dataset.listenerSet = "true";
    }

    let balanceLeft = savedIncome - totalSum;
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

    // Usuwanie wydatków
    document.querySelectorAll('.btn-delete-expense').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idToDel = parseInt(e.target.getAttribute('data-id'));
            expenses = expenses.filter(exp => exp.id !== idToDel);
            localStorage.setItem('user_expenses', JSON.stringify(expenses));
            renderExpenses();
        });
    });
}

// FORMULARZ: DODAWANIE KATEGORII
const categoryForm = document.getElementById('category-form');
if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('category-name').value.trim();

        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            alert('Taka kategoria już istnieje!');
            return;
        }

        const token = localStorage.getItem('token');

        try {

            const response = await fetch(`${API_URL}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name
                })
            });

            if (!response.ok) {
                throw new Error('Nie udało się utworzyć kategorii');
            }

            await loadCategories();

            categoryForm.reset();

        } catch (error) {

            console.error(error);
            alert('Nie udało się utworzyć kategorii.');

        }
    });
}

// FORMULARZ: DODAWANIE WYDATKU
const expenseForm = document.getElementById('expense-form');
if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('expense-title').value.trim();
        const amount = document.getElementById('expense-amount').value;
        const date = document.getElementById('expense-date').value;
        const category = document.getElementById('expense-category').value;

        const newExpense = {
            id: Date.now(),
            title: title,
            amount: amount,
            date: date,
            category: category
        };

        expenses.push(newExpense);
        localStorage.setItem('user_expenses', JSON.stringify(expenses));
        
        renderExpenses();
        expenseForm.reset();
        
        if (document.getElementById('expense-date')) {
            document.getElementById('expense-date').valueAsDate = new Date();
        }
    });
}

async function getCurrentUser() {
    const token = localStorage.getItem('token');

    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch (error) {
        return null;
    }
}

// KONFIGURACJA WIDOKU PO ZALOGOWANIU
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

    if (document.getElementById('expense-date')) {
        document.getElementById('expense-date').valueAsDate = new Date();
    }

    await loadCategories();
    renderExpenses();
}

// FORMULARZ LOGOWANIA (POST /login)
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
                setupDashboardUI(email);
                loginForm.reset();
            } else {
                alert('Błąd logowania: ' + (data.detail || 'Niepoprawne dane.'));
            }
        } catch (error) {
            alert('Nie można połączyć się z serwerem backendu.');
        }
    });
}

// FORMULARZ REJESTRACJI
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;

        if (password !== passwordConfirm) {
            alert('Hasła nie są identyczne!');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (response.ok) {
                alert('Konto utworzone! Zaloguj się.');
                registerSection.style.display = 'none';
                loginSection.style.display = 'block';
                registerForm.reset();
            } else {
                const data = await response.json();
                alert('Błąd: ' + data.detail);
            }
        } catch (error) {
            alert('Brak połączenia z API.');
        }
    });
}

// PROFIL: ZMIANA HASŁA
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('profile-new-password').value;
        const newPasswordConfirm = document.getElementById('profile-new-password-confirm').value;

        if (newPassword !== newPasswordConfirm) {
            alert('Nowe hasła nie są identyczne!');
            return;
        }
        alert('Hasło zmienione pomyślnie!');
        if (profileModal) profileModal.style.display = 'none';
        changePasswordForm.reset();
    });
}

// PROFIL: USUWANIE KONTA
const deleteAccountBtn = document.getElementById('delete-account-btn');
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Czy na pewno chcesz usunąć konto? Wszystkie lokalne dane znikną.')) {
            localStorage.clear();
            location.reload();
        }
    });
}

// WYLOGOWANIE
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        location.reload();
    });
}

// AUTOMATYCZNE LOGOWANIE
window.addEventListener('DOMContentLoaded', async () => {
    const user = await getCurrentUser();
    if (user) {
        setupDashboardUI(user.email);
    }
});