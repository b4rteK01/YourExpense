document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("login-form");
    const loginPage = document.getElementById("login-page");
    const mainDashboard = document.getElementById("main-dashboard");
    const logoutBtn = document.getElementById("logout-btn");
    const userDisplay = document.getElementById("user-display");
    const emailInput = document.getElementById("email");

    // ================= OBSŁUGA LOGOWANIA (MAKIETA) =================
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            // Zatrzymujemy domyślne odświeżanie strony przez formularz
            e.preventDefault();

            // Pobieramy to, co użytkownik wpisał w pole e-mail
            const userEmail = emailInput.value;

            // Podmieniamy tekst na górze panelu, żeby ładnie wyglądało
            userDisplay.textContent = `Zalogowany jako: ${userEmail}`;

            // Ukrywamy stronę logowania i pokazujemy główny panel
            loginPage.classList.add("hidden");
            mainDashboard.classList.remove("hidden");
        });
    }

    // ================= OBSŁUGA WYLOGOWANIA =================
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Czyścimy pola formularza logowania
            loginForm.reset();

            // Ukrywamy panel główny i przywracamy ekran logowania
            mainDashboard.classList.add("hidden");
            loginPage.classList.remove("hidden");
        });
    }
});