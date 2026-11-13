"use strict";

/* =========================================
   PERHUTANGAN ♡
   FAMILY DEBT TRACKER
   ========================================= */


/* =========================================
   SUPABASE CONFIGURATION
   ========================================= */

const SUPABASE_URL = "https://ixcvfcismkqwjpubbbpm.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_fitSTYwCaLGS9lQXonwQJw_liwfZLi3";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =========================================
   APPLICATION STATE
   ========================================= */

const PEOPLE = ["Baby", "Sayang"];

let debts = [];
let payments = [];

let currentMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

let selectedDate = dateKey(new Date());

let toastTimeout = null;


/* =========================================
   DOM HELPERS
   ========================================= */

function $(id) {
    return document.getElementById(id);
}

function money(value) {
    return new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR"
    }).format(Number(value) || 0);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(value) {
    if (!value) return null;

    const parts = String(value).split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return null;
    }

    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(value) {
    const date = parseDate(value);

    if (!date) return "-";

    return date.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatLongDate(value) {
    const date = parseDate(value);

    if (!date) return "-";

    return date.toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function clampDate(year, monthIndex, day) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();

    return new Date(
        year,
        monthIndex,
        Math.min(day, lastDay)
    );
}

function addMonthsClamped(date, months) {
    const totalMonth = date.getMonth() + months;
    const year = date.getFullYear() + Math.floor(totalMonth / 12);
    const month = totalMonth % 12;

    return clampDate(year, month, date.getDate());
}

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


/* =========================================
   DATABASE CONNECTION
   ========================================= */

function setConnectionStatus(status, message) {
    const element = $("connectionStatus");

    element.classList.remove("connected", "error");

    if (status === "connected") {
        element.classList.add("connected");
    }

    if (status === "error") {
        element.classList.add("error");
    }

    element.innerHTML = `
        <span class="status-dot"></span>
        ${escapeHTML(message)}
    `;
}

async function loadData() {
    setConnectionStatus("loading", "Connecting...");

    try {
        const [debtResult, paymentResult] = await Promise.all([
            db.from("debts").select("*").order("created_at", {
                ascending: false
            }),

            db.from("debt_payments").select("*")
        ]);

        if (debtResult.error) {
            throw debtResult.error;
        }

        if (paymentResult.error) {
            throw paymentResult.error;
        }

        debts = debtResult.data || [];
        payments = paymentResult.data || [];

        setConnectionStatus("connected", "Database connected");

        renderEverything();

    } catch (error) {
        console.error("Database loading error:", error);

        setConnectionStatus("error", "Connection error");

        $("calendar").innerHTML = `
            <div class="loading-message">
                Unable to load calendar. Please check your database connection.
            </div>
        `;

        $("debtList").innerHTML = `
            <div class="empty-state">
                Unable to load debts.<br>
                <small>${escapeHTML(error.message || "Unknown error")}</small>
            </div>
        `;

        showToast("Unable to connect to Supabase.");
    }
}


/* =========================================
   PAYMENT SCHEDULE
   ========================================= */

function getDebtPayments(debt) {
    const firstDate = parseDate(debt.first_due_date);

    if (!firstDate) return [];

    const numberOfMonths = Math.max(
        0,
        Number(debt.months) || 0
    );

    const monthlyAmount = Number(debt.amount) || 0;

    const result = [];

    for (let index = 0; index < numberOfMonths; index++) {
        const dueDate = addMonthsClamped(firstDate, index);
        const dueDateKey = dateKey(dueDate);

        const savedPayment = payments.find(payment =>
            String(payment.debt_id) === String(debt.id) &&
            payment.due_date === dueDateKey
        );

        result.push({
            debtId: debt.id,
            debtName: debt.name,
            person: debt.person,
            amount: monthlyAmount,
            dueDate: dueDateKey,
            paid: savedPayment
                ? Boolean(savedPayment.paid)
                : false
        });
    }

    return result;
}

function getAllScheduledPayments() {
    return debts.flatMap(debt => getDebtPayments(debt));
}

function getUnpaidPayments(list) {
    return list.filter(payment => !payment.paid);
}

function getPaidPayments(list) {
    return list.filter(payment => payment.paid);
}

function sumPayments(list) {
    return list.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
    );
}

function getDebtProgress(debt) {
    const schedule = getDebtPayments(debt);

    const paid = getPaidPayments(schedule);
    const unpaid = getUnpaidPayments(schedule);

    const total = Number(debt.amount) * Number(debt.months);
    const paidAmount = sumPayments(paid);
    const remaining = sumPayments(unpaid);

    const percentage = total > 0
        ? Math.min(100, (paidAmount / total) * 100)
        : 0;

    return {
        total,
        paidAmount,
        remaining,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        totalCount: schedule.length,
        percentage,
        completed: unpaid.length === 0
    };
}


/* =========================================
   DASHBOARD SUMMARY
   ========================================= */

function renderDashboard() {
    const allPayments = getAllScheduledPayments();
    const unpaid = getUnpaidPayments(allPayments);

    const today = new Date();
    const todayKey = dateKey(today);

    const monthStart = dateKey(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );

    const monthEnd = dateKey(
        new Date(today.getFullYear(), today.getMonth() + 1, 0)
    );

    const dueThisMonth = unpaid.filter(payment =>
        payment.dueDate >= monthStart &&
        payment.dueDate <= monthEnd
    );

    const overdue = unpaid.filter(payment =>
        payment.dueDate < todayKey
    );

    $("totalOutstanding").textContent = money(sumPayments(unpaid));

    $("monthOutstanding").textContent = money(
        sumPayments(dueThisMonth)
    );

    $("monthCount").textContent =
        `${dueThisMonth.length} unpaid payment${dueThisMonth.length === 1 ? "" : "s"}`;

    $("overdueOutstanding").textContent = money(
        sumPayments(overdue)
    );

    $("overdueCount").textContent =
        `${overdue.length} overdue payment${overdue.length === 1 ? "" : "s"}`;

    const activeDebts = debts.filter(debt =>
        !getDebtProgress(debt).completed
    );

    $("activeDebtCount").textContent = activeDebts.length;

    const babyPayments = unpaid.filter(payment =>
        payment.person === "Baby"
    );

    const sayangPayments = unpaid.filter(payment =>
        payment.person === "Sayang"
    );

    $("babyOutstanding").textContent = money(
        sumPayments(babyPayments)
    );

    $("sayangOutstanding").textContent = money(
        sumPayments(sayangPayments)
    );
}


/* =========================================
   CALENDAR
   ========================================= */

function renderCalendar() {
    const calendar = $("calendar");

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    $("monthLabel").textContent = currentMonth.toLocaleDateString(
        "en-MY",
        {
            month: "long",
            year: "numeric"
        }
    );

    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const previousMonthDays = new Date(year, month, 0).getDate();

    const allPayments = getAllScheduledPayments();

    let html = "";

    for (let index = 0; index < 42; index++) {
        let dayNumber;
        let date;
        let isOtherMonth = false;

        if (index < startDay) {
            dayNumber = previousMonthDays - startDay + index + 1;

            date = new Date(
                year,
                month - 1,
                dayNumber
            );

            isOtherMonth = true;

        } else if (index >= startDay + daysInMonth) {
            dayNumber = index - startDay - daysInMonth + 1;

            date = new Date(
                year,
                month + 1,
                dayNumber
            );

            isOtherMonth = true;

        } else {
            dayNumber = index - startDay + 1;

            date = new Date(
                year,
                month,
                dayNumber
            );
        }

        const key = dateKey(date);

        const dayPayments = allPayments.filter(payment =>
            payment.dueDate === key
        );

        const unpaid = getUnpaidPayments(dayPayments);
        const paid = getPaidPayments(dayPayments);

        const unpaidTotal = sumPayments(unpaid);

        const todayClass = key === dateKey(new Date())
            ? "today"
            : "";

        const selectedClass = key === selectedDate
            ? "selected"
            : "";

        const otherClass = isOtherMonth
            ? "other-month"
            : "";

        let amountHTML = "";

        if (dayPayments.length > 0) {
            amountHTML = `
                <span class="day-amount ${unpaid.length === 0 ? "day-paid" : ""}">
                    ${unpaid.length > 0
                        ? escapeHTML(money(unpaidTotal))
                        : "Paid"}
                </span>
                <span class="day-indicator">
                    ${dayPayments.map(payment =>
                        `<i class="${payment.paid ? "paid" : ""}"></i>`
                    ).join("")}
                </span>
            `;
        }

        html += `
            <button
                type="button"
                class="calendar-day ${todayClass} ${selectedClass} ${otherClass}"
                data-date="${key}"
                aria-label="${formatLongDate(key)}"
            >
                <span class="day-number">${dayNumber}</span>
                ${amountHTML}
            </button>
        `;
    }

    calendar.innerHTML = html;

    calendar.querySelectorAll("[data-date]").forEach(button => {
        button.addEventListener("click", () => {
            selectedDate = button.dataset.date;

            const clickedDate = parseDate(selectedDate);

            if (
                clickedDate.getMonth() !== currentMonth.getMonth() ||
                clickedDate.getFullYear() !== currentMonth.getFullYear()
            ) {
                currentMonth = new Date(
                    clickedDate.getFullYear(),
                    clickedDate.getMonth(),
                    1
                );
            }

            renderCalendar();
            renderSelectedDay();
        });
    });
}


/* =========================================
   SELECTED DAY AND WEEKLY TOTALS
   ========================================= */

function getPaymentsForDate(dateValue) {
    return getAllScheduledPayments()
        .filter(payment => payment.dueDate === dateValue)
        .sort((a, b) => a.debtName.localeCompare(b.debtName));
}

function renderSelectedDay() {
    const selected = parseDate(selectedDate);

    if (!selected) return;

    $("selectedDateTitle").textContent = formatLongDate(selectedDate);
    $("dailyTotalDate").textContent = formatDate(selectedDate);

    const dayPayments = getPaymentsForDate(selectedDate);
    const unpaid = getUnpaidPayments(dayPayments);

    $("dailyOutstanding").textContent = money(
        sumPayments(unpaid)
    );

    $("selectedPaymentCount").textContent =
        `${dayPayments.length} payment${dayPayments.length === 1 ? "" : "s"}`;

    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - selected.getDay());

    const weekEnd = addDays(weekStart, 6);

    const weekStartKey = dateKey(weekStart);
    const weekEndKey = dateKey(weekEnd);

    const weeklyPayments = getAllScheduledPayments().filter(payment =>
        !payment.paid &&
        payment.dueDate >= weekStartKey &&
        payment.dueDate <= weekEndKey
    );

    $("weeklyOutstanding").textContent = money(
        sumPayments(weeklyPayments)
    );

    $("weeklyDateRange").textContent =
        `${formatDate(weekStartKey)} – ${formatDate(weekEndKey)}`;

    renderSelectedPayments(dayPayments);
}

function renderSelectedPayments(dayPayments) {
    const container = $("selectedPayments");

    if (dayPayments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No payments scheduled for this date.
            </div>
        `;

        return;
    }

    container.innerHTML = dayPayments.map(payment => {
        const isOverdue =
            !payment.paid &&
            payment.dueDate < dateKey(new Date());

        let statusText = "Unpaid";
        let statusClass = "status-unpaid";

        if (payment.paid) {
            statusText = "Paid";
            statusClass = "status-paid";
        } else if (isOverdue) {
            statusText = "Overdue";
            statusClass = "status-overdue";
        }

        return `
            <div class="payment-item">
                <div class="payment-info">
                    <strong>${escapeHTML(payment.debtName)}</strong>
                    <small>
                        ${escapeHTML(payment.person)}
                        · ${escapeHTML(statusText)}
                    </small>
                </div>

                <div class="payment-actions">
                    <span class="payment-amount ${statusClass}">
                        ${money(payment.amount)}
                    </span>

                    <button
                        type="button"
                        class="small-button ${payment.paid ? "undo" : ""}"
                        data-payment-debt="${escapeHTML(payment.debtId)}"
                        data-payment-date="${escapeHTML(payment.dueDate)}"
                        data-payment-paid="${payment.paid}"
                    >
                        ${payment.paid ? "Undo Paid" : "Mark Paid"}
                    </button>
                </div>
            </div>
        `;
    }).join("");
}


/* =========================================
   MARK PAID / UNDO PAID
   ========================================= */

async function updatePayment(debtId, dueDate, paid) {
    try {
        const { error } = await db
            .from("debt_payments")
            .upsert(
                {
                    debt_id: debtId,
                    due_date: dueDate,
                    paid: paid
                },
                {
                    onConflict: "debt_id,due_date"
                }
            );

        if (error) {
            throw error;
        }

        showToast(
            paid
                ? "Payment marked as paid."
                : "Payment changed back to unpaid."
        );

        await loadData();

    } catch (error) {
        console.error("Payment update error:", error);

        showToast(
            `Unable to update payment: ${error.message || "Unknown error"}`
        );
    }
}


/* =========================================
   ADD DEBT
   ========================================= */

async function addDebt(event) {
    event.preventDefault();

    const form = $("debtForm");
    const button = $("submitBtn");
    const message = $("formMessage");

    const formData = new FormData(form);

    const person = String(formData.get("person") || "");
    const name = String(formData.get("name") || "").trim();
    const amount = Number(formData.get("amount"));
    const months = Number(formData.get("months"));
    const firstDueDate = String(formData.get("first_due_date") || "");
    const note = String(formData.get("note") || "").trim();

    message.textContent = "";
    message.className = "form-message";

    if (!PEOPLE.includes(person)) {
        message.textContent = "Please select Baby or Sayang.";
        message.classList.add("error");
        return;
    }

    if (!name || !firstDueDate) {
        message.textContent = "Please complete all required fields.";
        message.classList.add("error");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        message.textContent = "Enter a valid monthly payment amount.";
        message.classList.add("error");
        return;
    }

    if (!Number.isInteger(months) || months < 1 || months > 600) {
        message.textContent = "Enter a valid number of months.";
        message.classList.add("error");
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const { error } = await db
            .from("debts")
            .insert({
                person,
                name,
                amount,
                months,
                first_due_date: firstDueDate,
                note
            });

        if (error) {
            throw error;
        }

        form.reset();

        $("person").value = "Baby";

        message.textContent = "Debt added successfully.";
        message.classList.add("success");

        showToast("New debt added successfully.");

        await loadData();

    } catch (error) {
        console.error("Add debt error:", error);

        message.textContent =
            `Unable to save: ${error.message || "Unknown error"}`;

        message.classList.add("error");

    } finally {
        button.disabled = false;
        button.textContent = "+ Add Debt";
    }
}


/* =========================================
   DELETE DEBT
   ========================================= */

async function deleteDebt(debtId) {
    const debt = debts.find(item =>
        String(item.id) === String(debtId)
    );

    if (!debt) return;

    const confirmed = window.confirm(
        `Delete "${debt.name}"?\n\nThis will delete the debt record and its payment history if your database uses the existing cascading relationship.`
    );

    if (!confirmed) return;

    try {
        const { error } = await db
            .from("debts")
            .delete()
            .eq("id", debtId);

        if (error) {
            throw error;
        }

        showToast("Debt deleted.");

        await loadData();

    } catch (error) {
        console.error("Delete debt error:", error);

        showToast(
            `Unable to delete debt: ${error.message || "Unknown error"}`
        );
    }
}


/* =========================================
   ALL DEBTS
   ========================================= */

function renderDebtList() {
    const container = $("debtList");

    const search = $("debtSearch").value
        .trim()
        .toLowerCase();

    const personFilter = $("personFilter").value;
    const statusFilter = $("statusFilter").value;

    const filtered = debts.filter(debt => {
        const progress = getDebtProgress(debt);

        const matchesSearch =
            String(debt.name || "").toLowerCase().includes(search) ||
            String(debt.note || "").toLowerCase().includes(search);

        const matchesPerson =
            personFilter === "All" ||
            debt.person === personFilter;

        const matchesStatus =
            statusFilter === "All" ||
            (statusFilter === "Active" && !progress.completed) ||
            (statusFilter === "Completed" && progress.completed);

        return matchesSearch && matchesPerson && matchesStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No debts found.
            </div>
        `;

        return;
    }

    container.innerHTML = filtered.map(debt => {
        const progress = getDebtProgress(debt);

        const percentage = Math.round(progress.percentage);

        const personClass = debt.person === "Sayang"
            ? "sayang"
            : "";

        const personName = debt.person || "Unassigned";

        return `
            <article class="debt-card">

                <div class="debt-card-top">
                    <div class="debt-title-wrap">
                        <h3>${escapeHTML(debt.name)}</h3>
                        <small>
                            First payment: ${formatDate(debt.first_due_date)}
                        </small>
                    </div>

                    <span class="person-tag ${personClass}">
                        ${escapeHTML(personName)}
                    </span>
                </div>

                <div class="debt-total">
                    <span>Remaining balance</span>
                    <strong>${money(progress.remaining)}</strong>
                </div>

                <div class="progress-track">
                    <div
                        class="progress-fill"
                        style="width: ${percentage}%"
                    ></div>
                </div>

                <div class="progress-labels">
                    <span>${percentage}% paid</span>
                    <span>
                        ${progress.paidCount}/${progress.totalCount} payments
                    </span>
                </div>

                <div class="debt-meta">
                    <div>
                        <span>Monthly payment</span>
                        <strong>${money(debt.amount)}</strong>
                    </div>

                    <div>
                        <span>Total original amount</span>
                        <strong>${money(progress.total)}</strong>
                    </div>

                    <div>
                        <span>Paid so far</span>
                        <strong>${money(progress.paidAmount)}</strong>
                    </div>

                    <div>
                        <span>Remaining months</span>
                        <strong>${progress.unpaidCount}</strong>
                    </div>
                </div>

                ${debt.note ? `
                    <p class="debt-note">
                        Note: ${escapeHTML(debt.note)}
                    </p>
                ` : ""}

                <div class="debt-actions">
                    <span class="${progress.completed ? "status-paid" : "status-unpaid"}">
                        ${progress.completed ? "✓ Completed" : "● Active"}
                    </span>

                    <button
                        type="button"
                        class="text-button delete"
                        data-delete-debt="${escapeHTML(debt.id)}"
                    >
                        Delete debt
                    </button>
                </div>

            </article>
        `;
    }).join("");
}


/* =========================================
   DATE AND HEADER
   ========================================= */

function renderToday() {
    const today = new Date();

    $("todayDate").textContent = today.toLocaleDateString(
        "en-MY",
        {
            day: "numeric",
            month: "short"
        }
    );

    $("todayDay").textContent = today.toLocaleDateString(
        "en-MY",
        {
            weekday: "long",
            year: "numeric"
        }
    );
}


/* =========================================
   RENDER EVERYTHING
   ========================================= */

function renderEverything() {
    renderToday();
    renderDashboard();
    renderCalendar();
    renderSelectedDay();
    renderDebtList();
}


/* =========================================
   EVENT LISTENERS
   ========================================= */

function setupEventListeners() {

    $("debtForm").addEventListener("submit", addDebt);

    $("prevMonth").addEventListener("click", () => {
        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() - 1,
            1
        );

        renderCalendar();
    });

    $("nextMonth").addEventListener("click", () => {
        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            1
        );

        renderCalendar();
    });

    $("refreshBtn").addEventListener("click", async () => {
        await loadData();
        showToast("Data refreshed.");
    });

    $("debtSearch").addEventListener("input", renderDebtList);

    $("personFilter").addEventListener("change", renderDebtList);

    $("statusFilter").addEventListener("change", renderDebtList);

    $("selectedPayments").addEventListener("click", event => {
        const button = event.target.closest("[data-payment-debt]");

        if (!button) return;

        const debtId = button.dataset.paymentDebt;
        const dueDate = button.dataset.paymentDate;
        const currentlyPaid = button.dataset.paymentPaid === "true";

        updatePayment(
            debtId,
            dueDate,
            !currentlyPaid
        );
    });

    $("debtList").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-debt]");

        if (!button) return;

        deleteDebt(button.dataset.deleteDebt);
    });
}


/* =========================================
   START APPLICATION
   ========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();

    renderToday();

    $("person").value = "Baby";

    await loadData();
});
