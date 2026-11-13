"use strict";

// =============================================
// PERHUTANGAN ♡
// FAMILY FINANCE + WISHLIST
// =============================================

// YOUR EXISTING SUPABASE PROJECT
const SUPABASE_URL = "https://ixcvfcismkqwjpubbbpm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fitSTYwCaLGS9lQXonwQJw_liwfZLi3";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// =============================================
// APP STATE
// =============================================

let debts = [];
let payments = [];
let wishlist = [];
let transactions = [];
let savingsGoals = [];

let calendarDate = new Date();
let selectedDate = dateString(new Date());
let editingWishlistId = null;
let soundEnabled = false;

// =============================================
// HELPERS
// =============================================

const $ = id => document.getElementById(id);

const money = value =>
    "RM " + Number(value || 0).toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

const number = value => Number(value || 0);

function dateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseDate(value) {
    if (!value) return null;
    const parts = value.slice(0, 10).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#dc777f" : "#45a982";
}

function setConnection(online, message) {
    $("connectionStatus").textContent = message;
    $("connectionDot").className =
        "status-dot " + (online ? "online" : "offline");
}

function playSound() {
    if (!soundEnabled) return;

    try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.frequency.value = 660;
        gain.gain.value = 0.035;

        oscillator.start();
        oscillator.stop(audio.currentTime + 0.08);
        oscillator.onended = () => audio.close();
    } catch (error) {
        console.warn("Sound unavailable", error);
    }
}

function todayString() {
    return dateString(new Date());
}

function addMonthsClamped(date, months) {
    const result = new Date(
        date.getFullYear(),
        date.getMonth() + months,
        1
    );

    const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
    ).getDate();

    result.setDate(Math.min(date.getDate(), lastDay));
    return result;
}

// =============================================
// DATABASE
// =============================================

async function loadData() {
    setConnection(false, "Loading...");

    try {
        const results = await Promise.all([
            db.from("debts").select("*").order("created_at", { ascending: false }),
            db.from("debt_payments").select("*"),
            db.from("wishlist_items").select("*").order("created_at", { ascending: false }),
            db.from("money_transactions").select("*").order("transaction_date", { ascending: false }),
            db.from("savings_goals").select("*").order("created_at", { ascending: false })
        ]);

        const errors = results.filter(result => result.error);

        if (errors.length) {
            throw errors[0].error;
        }

        debts = results[0].data || [];
        payments = results[1].data || [];
        wishlist = results[2].data || [];
        transactions = results[3].data || [];
        savingsGoals = results[4].data || [];

        // Display old names using the current names.
        debts = debts.map(debt => ({
            ...debt,
            person: normalizePerson(debt.person)
        }));

        setConnection(true, "Connected · Live");
        renderEverything();

    } catch (error) {
        console.error("Database error:", error);
        setConnection(false, "Connection error");
        alert(
            "Unable to load your data.\n\n" +
            (error.message || "Please check your Supabase database and connection.")
        );
    }
}

function normalizePerson(person) {
    if (person === "Baby") return "Eisya";
    if (person === "Sayang") return "Capiq";
    return person || "Everyone";
}

async function insertRow(table, data) {
    const { error } = await db.from(table).insert(data);
    if (error) throw error;
}

async function updateRow(table, id, data) {
    const { error } = await db.from(table).update(data).eq("id", id);
    if (error) throw error;
}

async function deleteRow(table, id) {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) throw error;
}

// =============================================
// NAVIGATION
// =============================================

document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(btn =>
            btn.classList.remove("active")
        );

        document.querySelectorAll(".page").forEach(page =>
            page.classList.remove("active")
        );

        button.classList.add("active");
        $(button.dataset.page).classList.add("active");

        if (button.dataset.page === "dashboard") {
            drawCharts();
        }
    });
});

// =============================================
// DEBT SCHEDULE
// =============================================

function getDebtSchedule(debt) {
    const firstDate = parseDate(debt.first_due_date);
    if (!firstDate) return [];

    const months = Math.max(0, number(debt.months));

    return Array.from({ length: months }, (_, index) => {
        const due = addMonthsClamped(firstDate, index);

        const payment = payments.find(item =>
            item.debt_id === debt.id &&
            item.due_date === dateString(due)
        );

        return {
            debt,
            date: dateString(due),
            amount: number(debt.amount),
            paid: Boolean(payment?.paid),
            paymentId: payment?.id || null
        };
    });
}

function allInstallments() {
    return debts.flatMap(getDebtSchedule);
}

function remainingInstallments(debt) {
    return getDebtSchedule(debt).filter(item => !item.paid);
}

function remainingDebtAmount(debt) {
    return remainingInstallments(debt)
        .reduce((sum, item) => sum + item.amount, 0);
}

function debtOutstandingForPerson(person) {
    return debts
        .filter(debt => debt.person === person)
        .reduce((sum, debt) => sum + remainingDebtAmount(debt), 0);
}

function renderDebtSummary() {
    const schedule = allInstallments();
    const outstanding = schedule
        .filter(item => !item.paid)
        .reduce((sum, item) => sum + item.amount, 0);

    const active = debts.filter(debt =>
        remainingInstallments(debt).length > 0
    );

    $("debtOutstanding").textContent = money(outstanding);
    $("debtActiveCount").textContent = active.length;
    $("debtRemainingCount").textContent =
        schedule.filter(item => !item.paid).length;

    $("dashDebt").textContent = money(outstanding);
    $("dashDebtCount").textContent = `${active.length} active debts`;

    $("dashEisya").textContent = money(debtOutstandingForPerson("Eisya"));
    $("dashCapiq").textContent = money(debtOutstandingForPerson("Capiq"));
    $("dashEveryone").textContent = money(debtOutstandingForPerson("Everyone"));
}

// =============================================
// ADD DEBT
// =============================================

$("debtForm").addEventListener("submit", async event => {
    event.preventDefault();

    const person = $("debtPerson").value;
    const name = $("debtName").value;
    const amount = number($("debtAmount").value);
    const months = Math.floor(number($("debtMonths").value));
    const firstDate = $("debtDate").value;
    const note = $("debtNote").value.trim();

    if (!amount || amount <= 0 || months < 1 || !firstDate) {
        showMessage("debtMessage", "Please check all required fields.", true);
        return;
    }

    try {
        await insertRow("debts", {
            person,
            name,
            amount,
            months,
            first_due_date: firstDate,
            note
        });

        $("debtForm").reset();
        showMessage("debtMessage", "Debt added successfully!");
        playSound();
        await loadData();

    } catch (error) {
        console.error(error);
        showMessage("debtMessage", error.message, true);
    }
});

// =============================================
// DELETE DEBT
// =============================================

async function deleteDebt(id) {
    if (!confirm("Delete this debt and its payment records?")) return;

    try {
        await deleteRow("debts", id);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

// =============================================
// MARK PAID / UNDO
// =============================================

async function togglePaid(debtId, dueDate, currentlyPaid) {
    try {
        const existing = payments.find(item =>
            item.debt_id === debtId &&
            item.due_date === dueDate
        );

        if (currentlyPaid && existing) {
            await deleteRow("debt_payments", existing.id);
        } else if (existing) {
            await updateRow("debt_payments", existing.id, {
                paid: true
            });
        } else {
            await insertRow("debt_payments", {
                debt_id: debtId,
                due_date: dueDate,
                paid: true
            });
        }

        playSound();
        await loadData();

    } catch (error) {
        alert("Unable to update payment: " + error.message);
    }
}

// =============================================
// ALL DEBTS
// =============================================

function renderAllDebts() {
    const search = ($("debtSearch").value || "").toLowerCase();

    const filtered = debts.filter(debt =>
        String(debt.name).toLowerCase().includes(search) ||
        String(debt.person).toLowerCase().includes(search)
    );

    if (!filtered.length) {
        $("allDebts").innerHTML =
            '<p class="empty">No matching debts found.</p>';
        return;
    }

    $("allDebts").innerHTML = filtered.map(debt => {
        const remaining = remainingDebtAmount(debt);
        const remainingCount = remainingInstallments(debt).length;

        return `
            <div class="list-item">
                <div class="list-main">
                    <strong>${escapeHTML(debt.name)}</strong>
                    <small>
                        ${escapeHTML(debt.person)} ·
                        ${remainingCount} instalments remaining ·
                        ${money(remaining)}
                    </small>
                    <small>
                        First payment: ${escapeHTML(debt.first_due_date)}
                    </small>
                </div>
                <div class="list-actions">
                    <button class="action-btn danger"
                        onclick="deleteDebt('${debt.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join("");
}

$("debtSearch").addEventListener("input", renderAllDebts);

// =============================================
// CALENDAR
// =============================================

function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    $("calendarMonth").textContent =
        calendarDate.toLocaleDateString("en-MY", {
            month: "long",
            year: "numeric"
        });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const headings = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let html = headings.map(day =>
        `<div class="calendar-day heading">${day}</div>`
    ).join("");

    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const current = new Date(year, month, day);
        const key = dateString(current);

        const items = allInstallments().filter(item => item.date === key);

        const dots = items.map(item => {
            if (item.paid) return '<i class="dot paid"></i>';
            if (item.date < todayString()) return '<i class="dot overdue"></i>';
            return '<i class="dot upcoming"></i>';
        }).join("");

        const selected = key === selectedDate ? "selected" : "";
        const today = key === todayString() ? "today" : "";

        html += `
            <button class="calendar-day ${selected} ${today}"
                onclick="selectCalendarDate('${key}')">
                ${day}
                <div class="day-dots">${dots}</div>
            </button>
        `;
    }

    $("calendar").innerHTML = html;
}

function selectCalendarDate(date) {
    selectedDate = date;
    renderCalendar();
    renderSelectedPayments();
}

function renderSelectedPayments() {
    const items = allInstallments().filter(item =>
        item.date === selectedDate
    );

    $("selectedDateTitle").textContent =
        parseDate(selectedDate).toLocaleDateString("en-MY", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    const total = items
        .filter(item => !item.paid)
        .reduce((sum, item) => sum + item.amount, 0);

    $("selectedDateTotal").textContent = money(total);

    if (!items.length) {
        $("selectedPayments").innerHTML =
            '<p class="empty">No payments scheduled for this date.</p>';
        return;
    }

    $("selectedPayments").innerHTML = items.map(item => `
        <div class="list-item">
            <div class="list-main">
                <strong>${escapeHTML(item.debt.name)}</strong>
                <small>
                    ${escapeHTML(item.debt.person)} ·
                    ${money(item.amount)}
                </small>
                <small>${item.paid ? "Paid" : "Not paid"}</small>
            </div>
            <button class="action-btn ${item.paid ? "" : "success"}"
                onclick="togglePaid('${item.debt.id}','${item.date}',${item.paid})">
                ${item.paid ? "Undo" : "Mark Paid"}
            </button>
        </div>
    `).join("");
}

$("calendarPrev").addEventListener("click", () => {
    calendarDate = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() - 1,
        1
    );
    renderCalendar();
});

$("calendarNext").addEventListener("click", () => {
    calendarDate = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() + 1,
        1
    );
    renderCalendar();
});

// =============================================
// WISHLIST
// =============================================

$("wishlistForm").addEventListener("submit", async event => {
    event.preventDefault();

    const title = $("wishTitle").value.trim();
    const category = $("wishCategory").value;
    const price = number($("wishPrice").value);
    const saved = number($("wishSavedInput").value);

    if (!title || price < 0 || saved < 0) {
        showMessage("wishMessage", "Please enter valid details.", true);
        return;
    }

    const data = {
        title,
        category,
        price,
        saved_amount: saved,
        target_date: $("wishDate").value || null,
        priority: $("wishPriority").value,
        image_url: $("wishImage").value.trim() || null,
        shopping_url: $("wishLink").value.trim() || null,
        notes: $("wishNotes").value.trim()
    };

    try {
        if (editingWishlistId) {
            await updateRow("wishlist_items", editingWishlistId, data);
        } else {
            await insertRow("wishlist_items", data);
        }

        $("wishlistForm").reset();
        $("wishSavedInput").value = 0;
        editingWishlistId = null;
        $("cancelWishEdit").classList.add("hidden");

        showMessage("wishMessage", "Wishlist saved successfully!");
        playSound();
        await loadData();

    } catch (error) {
        showMessage("wishMessage", error.message, true);
    }
});

function editWishlist(id) {
    const item = wishlist.find(row => row.id === id);
    if (!item) return;

    editingWishlistId = id;

    $("wishTitle").value = item.title || "";
    $("wishCategory").value = item.category || "Other";
    $("wishPrice").value = item.price || 0;
    $("wishSavedInput").value = item.saved_amount || 0;
    $("wishDate").value = item.target_date || "";
    $("wishPriority").value = item.priority || "Medium";
    $("wishImage").value = item.image_url || "";
    $("wishLink").value = item.shopping_url || "";
    $("wishNotes").value = item.notes || "";

    $("cancelWishEdit").classList.remove("hidden");
    $("wishTitle").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("cancelWishEdit").addEventListener("click", () => {
    editingWishlistId = null;
    $("wishlistForm").reset();
    $("wishSavedInput").value = 0;
    $("cancelWishEdit").classList.add("hidden");
});

async function deleteWishlist(id) {
    if (!confirm("Delete this wishlist item?")) return;

    try {
        await deleteRow("wishlist_items", id);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

async function markPurchased(id) {
    const item = wishlist.find(row => row.id === id);
    if (!item) return;

    try {
        await updateRow("wishlist_items", id, {
            purchased: !item.purchased
        });
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

async function updateWishlistSaved(id) {
    const item = wishlist.find(row => row.id === id);
    if (!item) return;

    const value = prompt(
        "Enter your total saved amount (RM):",
        item.saved_amount || 0
    );

    if (value === null) return;

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        alert("Please enter a valid amount.");
        return;
    }

    try {
        await updateRow("wishlist_items", id, {
            saved_amount: amount
        });
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

function renderWishlist() {
    const search = ($("wishSearch").value || "").toLowerCase();
    const category = $("wishFilter").value;
    const sort = $("wishSort").value;

    $("wishTotal").textContent = money(
        wishlist.filter(item => !item.purchased)
            .reduce((sum, item) => sum + number(item.price), 0)
    );

    $("wishSaved").textContent = money(
        wishlist.reduce((sum, item) => sum + number(item.saved_amount), 0)
    );

    $("wishNeeded").textContent = money(
        wishlist.filter(item => !item.purchased)
            .reduce((sum, item) =>
                sum + Math.max(0, number(item.price) - number(item.saved_amount)), 0)
    );

    $("wishCount").textContent =
        wishlist.filter(item => !item.purchased).length;

    let filtered = wishlist.filter(item => {
        const matchesSearch =
            String(item.title).toLowerCase().includes(search) ||
            String(item.category).toLowerCase().includes(search);

        const matchesCategory =
            category === "all" || item.category === category;

        return matchesSearch && matchesCategory;
    });

    if (sort === "price-low") {
        filtered.sort((a, b) => number(a.price) - number(b.price));
    } else if (sort === "price-high") {
        filtered.sort((a, b) => number(b.price) - number(a.price));
    } else if (sort === "priority") {
        const rank = { High: 0, Medium: 1, Low: 2 };
        filtered.sort((a, b) =>
            (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)
        );
    } else {
        filtered.sort((a, b) =>
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
    }

    if (!filtered.length) {
        $("wishlistItems").innerHTML =
            '<p class="empty">No wishlist items found.</p>';
    } else {
        $("wishlistItems").innerHTML = filtered.map(item => {
            const price = number(item.price);
            const saved = number(item.saved_amount);
            const percent = price > 0
                ? Math.min(100, Math.round(saved / price * 100))
                : 0;

            const image = item.image_url
                ? `<img class="wish-image" src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="wish-image-placeholder">♡</div>`;

            return `
                <article class="wish-card">
                    ${image}
                    <div class="wish-content">
                        <div class="wish-top">
                            <span class="tag">${escapeHTML(item.category)}</span>
                            <span class="tag priority-${String(item.priority || "medium").toLowerCase()}">
                                ${escapeHTML(item.priority || "Medium")}
                            </span>
                        </div>

                        <h3>${escapeHTML(item.title)}</h3>
                        <div class="wish-price">${money(price)}</div>

                        <div class="progress-caption">
                            <span>Saved ${money(saved)}</span>
                            <strong>${percent}%</strong>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${percent}%"></div>
                        </div>

                        <div class="progress-caption">
                            <span>Remaining</span>
                            <strong>${money(Math.max(0, price - saved))}</strong>
                        </div>

                        <small class="muted">
                            Target: ${escapeHTML(item.target_date || "Not set")}
                        </small>

                        ${item.notes ? `<p class="muted">${escapeHTML(item.notes)}</p>` : ""}

                        ${item.purchased
                            ? '<span class="tag">Purchased ✓</span>'
                            : ""}

                        <div class="wish-actions">
                            <button class="action-btn"
                                onclick="updateWishlistSaved('${item.id}')">Update Saved</button>
                            <button class="action-btn"
                                onclick="editWishlist('${item.id}')">Edit</button>
                            <button class="action-btn success"
                                onclick="markPurchased('${item.id}')">
                                ${item.purchased ? "Undo Purchase" : "Purchased"}
                            </button>
                            ${item.shopping_url
                                ? `<button class="action-btn" onclick="openShoppingLink('${encodeURIComponent(item.shopping_url)}')">Open Link</button>`
                                : ""}
                            <button class="action-btn danger"
                                onclick="deleteWishlist('${item.id}')">Delete</button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    updatePlannerOptions();
}

function openShoppingLink(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            throw new Error("Invalid link");
        }
        window.open(parsed.href, "_blank", "noopener,noreferrer");
    } catch {
        alert("This shopping link is not valid.");
    }
}

$("wishSearch").addEventListener("input", renderWishlist);
$("wishFilter").addEventListener("change", renderWishlist);
$("wishSort").addEventListener("change", renderWishlist);

// =============================================
// WISHLIST SAVINGS PLANNER
// =============================================

function updatePlannerOptions() {
    const select = $("plannerItem");
    const previous = select.value;

    select.innerHTML =
        '<option value="">Choose wishlist item</option>' +
        wishlist.filter(item => !item.purchased).map(item =>
            `<option value="${item.id}">${escapeHTML(item.title)}</option>`
        ).join("");

    if (wishlist.some(item => item.id === previous)) {
        select.value = previous;
    }

    calculatePlanner();
}

function calculatePlanner() {
    const item = wishlist.find(row => row.id === $("plannerItem").value);

    if (!item) {
        $("plannerRemaining").textContent = money(0);
        $("plannerMonthly").textContent = money(0);
        $("plannerMessage").textContent = "Choose an item to calculate.";
        return;
    }

    const remaining = Math.max(
        0,
        number(item.price) - number(item.saved_amount)
    );

    $("plannerRemaining").textContent = money(remaining);

    if (!item.target_date) {
        $("plannerMonthly").textContent = "Set a target date";
        $("plannerMessage").textContent =
            "Edit this wishlist item and add a target purchase date.";
        return;
    }

    const today = new Date();
    const target = parseDate(item.target_date);

    const months = Math.max(
        1,
        (target.getFullYear() - today.getFullYear()) * 12 +
        (target.getMonth() - today.getMonth()) +
        (target.getDate() > today.getDate() ? 1 : 0)
    );

    $("plannerMonthly").textContent = money(remaining / months);
    $("plannerMessage").textContent =
        `Estimated monthly savings over ${months} month(s).`;
}

$("plannerItem").addEventListener("change", calculatePlanner);

// =============================================
// WISHLIST EXPORT
// =============================================

$("exportWishlist").addEventListener("click", () => {
    const data = JSON.stringify(wishlist, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "perhutangan-wishlist.json";
    link.click();

    URL.revokeObjectURL(url);
});

// =============================================
// INCOME AND EXPENSES
// =============================================

$("transactionDate").value = todayString();

$("transactionForm").addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        type: $("transactionType").value,
        title: $("transactionTitle").value.trim(),
        category: $("transactionCategory").value.trim() || "Other",
        amount: number($("transactionAmount").value),
        transaction_date: $("transactionDate").value,
        notes: $("transactionNote").value.trim()
    };

    if (!data.title || data.amount <= 0 || !data.transaction_date) {
        showMessage("transactionMessage", "Please check your transaction details.", true);
        return;
    }

    try {
        await insertRow("money_transactions", data);
        $("transactionForm").reset();
        $("transactionDate").value = todayString();
        showMessage("transactionMessage", "Transaction saved!");
        playSound();
        await loadData();
    } catch (error) {
        showMessage("transactionMessage", error.message, true);
    }
});

async function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;

    try {
        await deleteRow("money_transactions", id);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

function currentMonthTransactions() {
    const month = todayString().slice(0, 7);

    return transactions.filter(item =>
        String(item.transaction_date).slice(0, 7) === month
    );
}

function renderTransactions() {
    const search = ($("transactionSearch").value || "").toLowerCase();

    const filtered = transactions.filter(item =>
        String(item.title).toLowerCase().includes(search) ||
        String(item.category).toLowerCase().includes(search)
    );

    if (!filtered.length) {
        $("transactionList").innerHTML =
            '<p class="empty">No transactions found.</p>';
        return;
    }

    $("transactionList").innerHTML = filtered.map(item => `
        <div class="list-item">
            <div class="list-main">
                <strong>${escapeHTML(item.title)}</strong>
                <small>
                    ${escapeHTML(item.category)} ·
                    ${escapeHTML(item.transaction_date)}
                </small>
                <small>${escapeHTML(item.type)}</small>
            </div>
            <div class="list-actions">
                <strong style="color:${item.type === "Income" ? "#45a982" : "#dc777f"}">
                    ${item.type === "Income" ? "+" : "-"}${money(item.amount)}
                </strong>
                <button class="action-btn danger"
                    onclick="deleteTransaction('${item.id}')">Delete</button>
            </div>
        </div>
    `).join("");
}

$("transactionSearch").addEventListener("input", renderTransactions);

// =============================================
// SAVINGS GOALS
// =============================================

$("savingsForm").addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        title: $("savingTitle").value.trim(),
        target_amount: number($("savingTarget").value),
        saved_amount: number($("savingCurrent").value),
        target_date: $("savingDate").value || null,
        notes: $("savingNote").value.trim()
    };

    if (!data.title || data.target_amount <= 0 || data.saved_amount < 0) {
        showMessage("savingMessage", "Please enter valid amounts.", true);
        return;
    }

    try {
        await insertRow("savings_goals", data);
        $("savingsForm").reset();
        $("savingCurrent").value = 0;
        showMessage("savingMessage", "Savings goal created!");
        playSound();
        await loadData();
    } catch (error) {
        showMessage("savingMessage", error.message, true);
    }
});

async function updateSavings(id) {
    const goal = savingsGoals.find(item => item.id === id);
    if (!goal) return;

    const value = prompt(
        "Enter your updated savings amount (RM):",
        goal.saved_amount
    );

    if (value === null) return;

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        alert("Please enter a valid amount.");
        return;
    }

    try {
        await updateRow("savings_goals", id, {
            saved_amount: amount
        });
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteSavings(id) {
    if (!confirm("Delete this savings goal?")) return;

    try {
        await deleteRow("savings_goals", id);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

function renderSavings() {
    if (!savingsGoals.length) {
        $("savingsList").innerHTML =
            '<p class="empty">You have no savings goals yet.</p>';
        return;
    }

    $("savingsList").innerHTML = savingsGoals.map(goal => {
        const target = number(goal.target_amount);
        const saved = number(goal.saved_amount);
        const percent = target > 0
            ? Math.min(100, Math.round(saved / target * 100))
            : 0;

        return `
            <article class="saving-card">
                <div class="wish-content">
                    <span class="tag">Savings Goal</span>
                    <h3>${escapeHTML(goal.title)}</h3>
                    <div class="wish-price">${money(target)}</div>

                    <div class="progress-caption">
                        <span>Saved ${money(saved)}</span>
                        <strong>${percent}%</strong>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${percent}%"></div>
                    </div>

                    <p class="muted">
                        Remaining: ${money(Math.max(0, target - saved))}
                    </p>
                    <p class="muted">
                        Target date: ${escapeHTML(goal.target_date || "Not set")}
                    </p>

                    <div class="wish-actions">
                        <button class="action-btn success"
                            onclick="updateSavings('${goal.id}')">Update Saved</button>
                        <button class="action-btn danger"
                            onclick="deleteSavings('${goal.id}')">Delete</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

// =============================================
// DASHBOARD CALCULATIONS
// =============================================

function renderDashboard() {
    const monthData = currentMonthTransactions();

    const income = monthData
        .filter(item => item.type === "Income")
        .reduce((sum, item) => sum + number(item.amount), 0);

    const expenses = monthData
        .filter(item => item.type === "Expense")
        .reduce((sum, item) => sum + number(item.amount), 0);

    $("dashIncome").textContent = money(income);
    $("dashExpenses").textContent = money(expenses);
    $("dashBalance").textContent = money(income - expenses);

    $("moneyIncome").textContent = money(income);
    $("moneyExpense").textContent = money(expenses);
    $("moneyNet").textContent = money(income - expenses);

    $("dashWishCount").textContent =
        wishlist.filter(item => !item.purchased).length;

    $("dashWishTotal").textContent = money(
        wishlist.filter(item => !item.purchased)
            .reduce((sum, item) => sum + number(item.price), 0)
    );

    $("dashWishSaved").textContent = money(
        wishlist.reduce((sum, item) => sum + number(item.saved_amount), 0)
    );

    const upcoming = allInstallments()
        .filter(item => !item.paid && item.date >= todayString())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);

    if (!upcoming.length) {
        $("dashboardUpcoming").innerHTML =
            '<p class="empty">No upcoming payments.</p>';
    } else {
        $("dashboardUpcoming").innerHTML = upcoming.map(item => `
            <div class="list-item">
                <div class="list-main">
                    <strong>${escapeHTML(item.debt.name)}</strong>
                    <small>${escapeHTML(item.debt.person)} · ${item.date}</small>
                </div>
                <strong>${money(item.amount)}</strong>
            </div>
        `).join("");
    }
}

// =============================================
// CHARTS
// Native canvas: no chart library required.
// =============================================

function drawCharts() {
    drawFinanceChart();
    drawExpenseChart();
}

function canvasSetup(id) {
    const canvas = $(id);
    if (!canvas) return null;

    const width = Math.max(250, canvas.clientWidth);
    const height = 230;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    return { ctx, width, height };
}

function drawFinanceChart() {
    const setup = canvasSetup("financeChart");
    if (!setup) return;

    const { ctx, width, height } = setup;
    ctx.clearRect(0, 0, width, height);

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - i);

        const key = dateString(date).slice(0, 7);
        const records = transactions.filter(item =>
            String(item.transaction_date).slice(0, 7) === key
        );

        months.push({
            label: date.toLocaleDateString("en-MY", { month: "short" }),
            income: records.filter(item => item.type === "Income")
                .reduce((sum, item) => sum + number(item.amount), 0),
            expense: records.filter(item => item.type === "Expense")
                .reduce((sum, item) => sum + number(item.amount), 0)
        });
    }

    const max = Math.max(
        100,
        ...months.map(item => Math.max(item.income, item.expense))
    );

    const left = 12;
    const right = 12;
    const top = 18;
    const bottom = 32;
    const chartHeight = height - top - bottom;
    const groupWidth = (width - left - right) / months.length;

    ctx.strokeStyle = "#edf0f7";
    ctx.fillStyle = "#858ba4";
    ctx.font = "10px sans-serif";

    for (let i = 0; i <= 3; i++) {
        const y = top + chartHeight * i / 3;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();
    }

    months.forEach((item, index) => {
        const x = left + index * groupWidth + groupWidth / 2;
        const barWidth = Math.min(13, groupWidth * .24);

        const incomeHeight = item.income / max * chartHeight;
        const expenseHeight = item.expense / max * chartHeight;

        ctx.fillStyle = "#8191e8";
        ctx.fillRect(
            x - barWidth - 2,
            top + chartHeight - incomeHeight,
            barWidth,
            incomeHeight
        );

        ctx.fillStyle = "#e8a9c8";
        ctx.fillRect(
            x + 2,
            top + chartHeight - expenseHeight,
            barWidth,
            expenseHeight
        );

        ctx.fillStyle = "#858ba4";
        ctx.textAlign = "center";
        ctx.fillText(item.label, x, height - 9);
    });
}

function drawExpenseChart() {
    const setup = canvasSetup("expenseChart");
    if (!setup) return;

    const { ctx, width, height } = setup;
    ctx.clearRect(0, 0, width, height);

    const expenses = currentMonthTransactions()
        .filter(item => item.type === "Expense");

    const categories = {};

    expenses.forEach(item => {
        const key = item.category || "Other";
        categories[key] = (categories[key] || 0) + number(item.amount);
    });

    const entries = Object.entries(categories);
    const total = entries.reduce((sum, item) => sum + item[1], 0);

    const colors = [
        "#8292e8", "#e7a9c9", "#7ec5aa",
        "#e8b36e", "#9b91d8", "#82b9d8",
        "#e58e9c", "#a7b3c7"
    ];

    if (!total) {
        ctx.fillStyle = "#858ba4";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No expenses this month", width / 2, height / 2);
        $("expenseLegend").innerHTML = "";
        return;
    }

    let start = -Math.PI / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width * .25, 82);

    entries.forEach(([name, value], index) => {
        const angle = value / total * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();

        start += angle;
    });

    // White center for a doughnut chart.
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * .58, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.fillStyle = "#242943";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(money(total), centerX, centerY + 4);

    $("expenseLegend").innerHTML = entries.map(([name, value], index) => `
        <span>
            <i style="background:${colors[index % colors.length]}"></i>
            ${escapeHTML(name)} · ${money(value)}
        </span>
    `).join("");
}

// =============================================
// RENDER EVERYTHING
// =============================================

function renderEverything() {
    renderDebtSummary();
    renderCalendar();
    renderSelectedPayments();
    renderAllDebts();

    renderWishlist();
    renderTransactions();
    renderSavings();

    renderDashboard();
    drawCharts();
}

// =============================================
// SOUND SETTING
// =============================================

$("soundToggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    $("soundToggle").textContent =
        soundEnabled ? "Sound: On" : "Sound: Off";

    if (soundEnabled) playSound();
});

// =============================================
// REFRESH
// =============================================

$("refreshBtn").addEventListener("click", loadData);

// Refresh when returning to the website.
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadData();
});

// Redraw charts when the screen changes size.
let resizeTimeout;

window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(drawCharts, 200);
});

// =============================================
// START APPLICATION
// =============================================

loadData();
