"use strict";

// ==========================================
// PERHUTANGAN ♡
// FAMILY DEBT TRACKER
// ==========================================


// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://ixcvfcismkqwjpubbbpm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fitSTyWCaLGS9lQXonwQJw_liwfZLi3";

if (!window.supabase) {
    throw new Error("Supabase library did not load. Check your internet connection.");
}

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let debts = [];
let payments = [];

let viewDate = new Date();
let selectedDate = dateKey(new Date());

const $ = id => document.getElementById(id);

const CATEGORIES = {
    atomepaylater: "Atome PayLater",
    atomecard: "Atome Card",
    atomeloan: "Atome Loan",
    spaylater: "SPayLater",
    sloan: "SLoan",
    tiktokpaylater: "TikTok PayLater",
    tiktokloan: "TikTok Loan"
};


// ==========================================
// DATE AND DISPLAY HELPERS
// ==========================================

function dateKey(date) {
    const d = new Date(date);

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}


function parseDate(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}


function parseDisplayDate(value) {
    const match = String(value).trim().match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return dateKey(date);
}


function formatDate(key) {
    if (!key) return "-";

    const [year, month, day] = key.split("-");
    return `${day}/${month}/${year}`;
}


function dayDiff(key) {
    const today = parseDate(dateKey(new Date()));

    return Math.round(
        (parseDate(key) - today) / 86400000
    );
}


function monthName(date) {
    return date.toLocaleDateString("en-MY", {
        month: "long",
        year: "numeric"
    });
}


function money(value) {
    return "RM " + Number(value || 0).toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}


function categoryName(category) {
    return CATEGORIES[category] || category;
}


// ==========================================
// PERSON HELPERS
// ==========================================

// Old database values (Baby and Sayang) are still supported.
// They will appear in the website as Eisya and Capiq.

function normalisePerson(person) {
    const value = String(person || "").trim().toLowerCase();

    if (value === "baby" || value === "eisya") return "Eisya";
    if (value === "sayang" || value === "capiq") return "Capiq";

    return "Everyone";
}


// Keep the existing CSS colour classes to avoid breaking the design.

function personClass(person) {
    const value = normalisePerson(person);

    if (value === "Eisya") return "baby";
    if (value === "Capiq") return "sayang";

    return "everyone";
}


// ==========================================
// CONNECTION STATUS
// ==========================================

function setConnection(message, status = "") {
    $("connectionStatus").textContent = message;
    $("connectionStatus").className =
        `connection ${status}`.trim();
}


function showMessage(message, error = false) {
    $("formMessage").textContent = message;
    $("formMessage").className =
        error ? "form-message error" : "form-message";
}


// ==========================================
// PAYMENT SCHEDULE
// ==========================================

function occurrences(debt) {
    const first = parseDate(debt.first_due_date);
    const result = [];

    for (let i = 0; i < Number(debt.months); i++) {
        const targetMonth = new Date(
            first.getFullYear(),
            first.getMonth() + i,
            1
        );

        const lastDay = new Date(
            targetMonth.getFullYear(),
            targetMonth.getMonth() + 1,
            0
        ).getDate();

        const due = new Date(
            targetMonth.getFullYear(),
            targetMonth.getMonth(),
            Math.min(first.getDate(), lastDay)
        );

        result.push({
            debt,
            dueDate: dateKey(due),
            amount: Number(debt.amount)
        });
    }

    return result;
}


function allOccurrences() {
    return debts.flatMap(debt => occurrences(debt));
}


function getPayment(debtId, dueDate) {
    return payments.find(payment =>
        String(payment.debt_id) === String(debtId) &&
        payment.due_date === dueDate
    );
}


function getPaymentStatus(debtId, dueDate) {
    const payment = getPayment(debtId, dueDate);

    if (payment?.paid === true) return "paid";

    if (dueDate < dateKey(new Date())) return "overdue";

    return "unpaid";
}


function getRemainingEvents(list = allOccurrences()) {
    return list.filter(event =>
        getPaymentStatus(event.debt.id, event.dueDate) !== "paid"
    );
}


function getRemainingAmount(list = allOccurrences()) {
    return getRemainingEvents(list).reduce(
        (total, event) => total + Number(event.amount || 0),
        0
    );
}


// ==========================================
// LOAD DATABASE DATA
// ==========================================

async function loadData() {
    try {
        setConnection("Connecting...");

        if (!SUPABASE_ANON_KEY) {
            throw new Error("Please configure your Supabase key in app.js.");
        }

        const [debtResult, paymentResult] = await Promise.all([
            db.from("debts")
                .select("*")
                .order("created_at", { ascending: false }),

            db.from("debt_payments")
                .select("*")
        ]);

        if (debtResult.error) {
            throw new Error(
                "DEBTS TABLE: " + debtResult.error.message
            );
        }

        if (paymentResult.error) {
            throw new Error(
                "PAYMENTS TABLE: " + paymentResult.error.message
            );
        }

        debts = debtResult.data || [];
        payments = paymentResult.data || [];

        setConnection("Live · Perhutangan", "online");

        console.log("SUPABASE CONNECTED");
        console.log("DEBTS:", debts);
        console.log("PAYMENTS:", payments);

        render();

    } catch (error) {
        console.error("DATABASE ERROR:", error);

        setConnection("Connection error", "offline");

        $("debtList").innerHTML =
            `<p class="error-text">${escapeHtml(error.message)}</p>`;

        showMessage(error.message, true);
    }
}


// ==========================================
// MAIN RENDER
// ==========================================

function render() {
    const events = allOccurrences();

    // All unpaid instalments across every month.
    const allRemaining = getRemainingEvents(events);

    // Selected calendar month.
    const monthKey =
        `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;

    const monthEvents = events.filter(event =>
        event.dueDate.startsWith(monthKey)
    );

    const monthRemaining = getRemainingEvents(monthEvents);


    // ======================================
    // BOX 1: ACTIVE DEBTS THIS MONTH
    // ======================================

    const monthActiveDebts = new Set(
        monthEvents.map(event => String(event.debt.id))
    ).size;

    $("monthActiveCount").textContent = monthActiveDebts;


    // ======================================
    // BOX 2: DUE THIS MONTH
    // ======================================

    $("monthTotal").textContent =
        money(getRemainingAmount(monthEvents));

    $("monthCount").textContent =
        `${monthRemaining.length} remaining instalments`;


    // ======================================
    // BOX 3: OVERALL ACTIVE DEBTS
    // ======================================

    $("overallActiveCount").textContent =
        allRemaining.length;


    // ======================================
    // BOX 4: OVERALL TOTAL OUTSTANDING DEBT
    // ======================================

    $("overallDebt").textContent =
        money(getRemainingAmount(events));

    $("overallInstallments").textContent =
        `${allRemaining.length} remaining instalments`;


    // ======================================
    // UPCOMING PAYMENTS IN 7 DAYS
    // ======================================

    const upcoming = allRemaining.filter(event => {
        const difference = dayDiff(event.dueDate);

        return difference >= 0 && difference <= 7;
    });


    // ======================================
    // ALL DEBTS COUNT
    // ======================================

    $("debtListCount").textContent =
        `${debts.length} debts`;


    // ======================================
    // RENDER ALL SECTIONS
    // ======================================

    renderPersonSummaries(events);
    renderMonthlyPersonBreakdown(monthEvents);
    renderCalendar(events);
    renderUpcomingReminders(upcoming);
    renderSelectedDate(events);
    renderDebtList();
}


// ==========================================
// OVERALL PERSON TOTALS (ALL MONTHS)
// ==========================================

function renderPersonSummaries(events) {
    const people = [
        { name: "Eisya", prefix: "eisya" },
        { name: "Capiq", prefix: "capiq" },
        { name: "Everyone", prefix: "everyone" }
    ];

    people.forEach(({ name, prefix }) => {
        const personEvents = events.filter(event =>
            normalisePerson(event.debt.person) === name
        );

        const remaining = getRemainingEvents(personEvents);

        const total = remaining.reduce(
            (sum, event) => sum + Number(event.amount || 0),
            0
        );

        $(`${prefix}Outstanding`).textContent = money(total);

        $(`${prefix}Installments`).textContent =
            `${remaining.length} remaining instalments`;
    });
}


// ==========================================
// SELECTED MONTH PERSON BREAKDOWN
// ==========================================

function renderMonthlyPersonBreakdown(monthEvents) {
    const monthLabel = monthName(viewDate);

    $("monthlyBreakdownLabel").textContent =
        `${monthLabel} · unpaid instalments only`;

    const people = [
        { name: "Eisya", prefix: "monthEisya" },
        { name: "Capiq", prefix: "monthCapiq" },
        { name: "Everyone", prefix: "monthEveryone" }
    ];

    people.forEach(({ name, prefix }) => {
        const personEvents = monthEvents.filter(event =>
            normalisePerson(event.debt.person) === name
        );

        const remaining = getRemainingEvents(personEvents);

        const total = remaining.reduce(
            (sum, event) => sum + Number(event.amount || 0),
            0
        );

        $(`${prefix}Outstanding`).textContent = money(total);

        $(`${prefix}Installments`).textContent =
            `${remaining.length} remaining instalments`;
    });
}


// ==========================================
// CALENDAR
// ==========================================

function renderCalendar(events) {
    $("monthYear").textContent = monthName(viewDate);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const totalDays = new Date(
        year,
        month + 1,
        0
    ).getDate();

    const today = dateKey(new Date());

    let html = "";

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const key = dateKey(new Date(year, month, day));

        const dayEvents = events.filter(event =>
            event.dueDate === key
        );

        const classes = [
            "day",
            key === today ? "today" : "",
            key === selectedDate ? "selected" : ""
        ].filter(Boolean).join(" ");

        const chips = dayEvents.slice(0, 2).map(event => {
            const status = getPaymentStatus(
                event.debt.id,
                key
            );

            return `
                <div class="day-chip ${status} ${personClass(event.debt.person)}">
                    ${escapeHtml(normalisePerson(event.debt.person))}:
                    ${escapeHtml(categoryName(event.debt.name))}
                </div>
            `;
        }).join("");

        html += `
            <button
                type="button"
                class="${classes}"
                data-date="${key}"
            >
                <span class="day-number">${day}</span>

                <div class="day-events">
                    ${chips}
                    ${
                        dayEvents.length > 2
                            ? `<span class="more-chip">+${dayEvents.length - 2} more</span>`
                            : ""
                    }
                </div>
            </button>
        `;
    }

    $("calendar").innerHTML = html;

    $("calendar").querySelectorAll("[data-date]").forEach(button => {
        button.addEventListener("click", () => {
            selectedDate = button.dataset.date;
            render();
        });
    });
}


// ==========================================
// UPCOMING PAYMENT REMINDERS
// ==========================================

function renderUpcomingReminders(upcoming) {
    const container = $("upcomingReminderList");

    $("reminderCount").textContent =
        `${upcoming.length} payments`;

    if (!upcoming.length) {
        container.innerHTML =
            `<p class="muted">No upcoming payments in the next 7 days ♡</p>`;
        return;
    }

    const sorted = [...upcoming].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate)
    );

    container.innerHTML = sorted.map(event => {
        const difference = dayDiff(event.dueDate);

        let reminderText;

        if (difference === 0) {
            reminderText = "Due today!";
        } else if (difference === 1) {
            reminderText = "Due tomorrow";
        } else {
            reminderText = `Due in ${difference} days`;
        }

        return `
            <div class="reminder-item ${personClass(event.debt.person)}">
                <div class="reminder-info">
                    <strong>${escapeHtml(categoryName(event.debt.name))}</strong>
                    <small>
                        ${escapeHtml(normalisePerson(event.debt.person))}
                        · ${formatDate(event.dueDate)}
                    </small>
                    <span class="reminder-date">${reminderText}</span>
                </div>

                <strong class="reminder-amount">
                    ${money(event.amount)}
                </strong>
            </div>
        `;
    }).join("");
}


// ==========================================
// SELECTED DATE AND OUTSTANDING TOTALS
// ==========================================

function renderSelectedDate(events) {
    const selected = parseDate(selectedDate);

    $("selectedDateTitle").textContent =
        selected.toLocaleDateString("en-MY", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    const dayEvents = events.filter(event =>
        event.dueDate === selectedDate
    );

    const container = $("selectedPaymentsList");


    // ======================================
    // OUTSTANDING THIS DAY
    // ======================================

    const dailyRemaining = getRemainingEvents(dayEvents);

    const dailyOutstanding = dailyRemaining.reduce(
        (sum, event) => sum + Number(event.amount || 0),
        0
    );

    $("dailyOutstanding").textContent =
        money(dailyOutstanding);

    $("dailyTotalDate").textContent =
        `${formatDate(selectedDate)} · ${dailyRemaining.length} remaining instalments`;


    // ======================================
    // DISPLAY PAYMENTS FOR SELECTED DATE
    // ======================================

    if (!dayEvents.length) {
        container.innerHTML =
            `<p class="muted">Nothing scheduled for this date ♡</p>`;
    } else {
        container.innerHTML = dayEvents.map(event => {
            const status = getPaymentStatus(
                event.debt.id,
                event.dueDate
            );

            return `
                <div class="payment-row ${personClass(event.debt.person)}">
                    <div class="payment-info">
                        <strong>${escapeHtml(categoryName(event.debt.name))}</strong>
                        <small>
                            ${escapeHtml(normalisePerson(event.debt.person))}
                            · ${formatDate(event.dueDate)}
                        </small>
                        <span class="status-label ${status}">
                            ${status.toUpperCase()}
                        </span>
                    </div>

                    <div class="payment-action">
                        <strong>${money(event.amount)}</strong>

                        <button
                            type="button"
                            class="paid-btn ${status === "paid" ? "undo-btn" : ""}"
                            data-toggle="${escapeHtml(event.debt.id)}"
                            data-date="${event.dueDate}"
                        >
                            ${status === "paid" ? "Undo" : "Mark Paid"}
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }


    // ======================================
    // OUTSTANDING THIS WEEK
    // ======================================

    // Week starts Sunday and ends Saturday.

    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - selected.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startKey = dateKey(weekStart);
    const endKey = dateKey(weekEnd);

    const weeklyEvents = events.filter(event =>
        event.dueDate >= startKey &&
        event.dueDate <= endKey
    );

    const weeklyRemaining = getRemainingEvents(weeklyEvents);

    const weeklyOutstanding = weeklyRemaining.reduce(
        (sum, event) => sum + Number(event.amount || 0),
        0
    );

    $("weeklyTotal").innerHTML = `
        <div>
            <span>Outstanding this week</span>
            <small>
                ${formatDate(startKey)} – ${formatDate(endKey)}
                · ${weeklyRemaining.length} remaining instalments
            </small>
        </div>
        <strong>${money(weeklyOutstanding)}</strong>
    `;


    // ======================================
    // MARK PAID / UNDO BUTTONS
    // ======================================

    container.querySelectorAll("[data-toggle]").forEach(button => {
        button.addEventListener("click", () => {
            togglePaid(
                button.dataset.toggle,
                button.dataset.date
            );
        });
    });
}


// ==========================================
// ALL DEBTS AND FILTERS
// ==========================================

function renderDebtList() {
    const personFilter = $("personFilter").value;
    const categoryFilter = $("categoryFilter").value;
    const dateText = $("debtDateFilter").value.trim();

    let filterDate = "";

    if (dateText) {
        filterDate = parseDisplayDate(dateText);

        if (!filterDate) {
            $("debtFilterMessage").textContent =
                "Please enter a valid date using DD/MM/YYYY.";

            $("filteredOutstanding").textContent =
                "Date format invalid";

            $("debtList").innerHTML =
                `<p class="muted">Enter a valid payment date to filter.</p>`;

            return;
        }
    }

    let displayedDebts = [...debts];


    // FILTER BY PERSON

    if (personFilter !== "all") {
        displayedDebts = displayedDebts.filter(debt =>
            normalisePerson(debt.person) === personFilter
        );
    }


    // FILTER BY CATEGORY

    if (categoryFilter !== "all") {
        displayedDebts = displayedDebts.filter(debt =>
            debt.name === categoryFilter
        );
    }


    // FILTER BY PAYMENT DATE

    if (filterDate) {
        displayedDebts = displayedDebts.filter(debt =>
            occurrences(debt).some(event =>
                event.dueDate === filterDate
            )
        );
    }


    const displayedEvents = displayedDebts.flatMap(debt =>
        occurrences(debt)
    );

    const displayedRemaining = getRemainingEvents(displayedEvents);

    const outstanding = displayedRemaining.reduce(
        (total, event) => total + Number(event.amount || 0),
        0
    );

    $("filteredOutstanding").textContent =
        `${money(outstanding)} outstanding`;

    $("debtListCount").textContent =
        `${displayedDebts.length} debts`;


    const descriptions = [];

    if (personFilter !== "all") {
        descriptions.push(personFilter);
    }

    if (categoryFilter !== "all") {
        descriptions.push(categoryName(categoryFilter));
    }

    if (filterDate) {
        descriptions.push(formatDate(filterDate));
    }

    $("debtFilterMessage").textContent =
        descriptions.length
            ? `Showing: ${descriptions.join(" · ")}`
            : "Showing all our debts.";


    if (!displayedDebts.length) {
        $("debtList").innerHTML =
            `<p class="muted">No debts match these filters.</p>`;
        return;
    }


    // DISPLAY ALL DEBT CARDS

    $("debtList").innerHTML = displayedDebts.map(debt => {

        const schedule = occurrences(debt);

        const remaining = getRemainingEvents(schedule);

        const remainingAmount = remaining.reduce(
            (total, event) => total + Number(event.amount || 0),
            0
        );

        const paidCount = schedule.length - remaining.length;

        const overdueCount = remaining.filter(event =>
            getPaymentStatus(debt.id, event.dueDate) === "overdue"
        ).length;

        // Last scheduled instalment date.

        const lastPayment = schedule.length
            ? schedule[schedule.length - 1].dueDate
            : null;

        const person = personClass(debt.person);
        const displayPerson = normalisePerson(debt.person);

        const progress = schedule.length
            ? (paidCount / schedule.length) * 100
            : 0;

        return `
            <article class="debt-card ${person}">

                <div class="debt-card-top">

                    <div>

                        <span class="person-tag ${person}-tag">
                            ${escapeHtml(displayPerson)}
                        </span>

                        <h3 class="debt-name">
                            ${escapeHtml(categoryName(debt.name))}
                        </h3>

                        <p class="debt-owner">
                            ${Number(debt.months)} monthly instalments
                        </p>

                    </div>

                    <div class="debt-amount">
                        ${money(debt.amount)}
                        <small>per month</small>
                    </div>

                </div>

                <div class="debt-progress">

                    <div class="progress-track">
                        <div
                            class="progress-fill ${person}"
                            style="width:${progress}%"
                        ></div>
                    </div>

                    <div class="progress-labels">
                        <span>${paidCount} paid</span>
                        <span>${remaining.length} remaining</span>
                    </div>

                </div>

                <div class="debt-details">
                    <span>Remaining amount</span>
                    <strong>${money(remainingAmount)}</strong>
                </div>

                <div class="debt-details">
                    <span>First payment</span>
                    <span>${formatDate(debt.first_due_date)}</span>
                </div>

                <div class="debt-details">
                    <span>Last payment</span>
                    <span>
                        ${lastPayment ? formatDate(lastPayment) : "-"}
                    </span>
                </div>

                <div class="debt-details">

                    <span>
                        ${
                            overdueCount
                                ? `<strong class="overdue-text">${overdueCount} overdue</strong>`
                                : "No overdue payments"
                        }
                    </span>

                    <button
                        type="button"
                        class="delete-btn"
                        data-delete="${escapeHtml(debt.id)}"
                    >
                        Delete
                    </button>

                </div>

                ${
                    debt.note
                        ? `<p class="debt-note">${escapeHtml(debt.note)}</p>`
                        : ""
                }

            </article>
        `;

    }).join("");


    // DELETE BUTTON EVENTS

    $("debtList").querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => {
            deleteDebt(button.dataset.delete);
        });
    });
}


// ==========================================
// MARK PAID / UNDO
// ==========================================

async function togglePaid(debtId, dueDate) {
    const existing = getPayment(debtId, dueDate);

    try {
        if (existing?.paid === true) {

            const { error } = await db
                .from("debt_payments")
                .delete()
                .eq("id", existing.id);

            if (error) throw error;

        } else if (existing) {

            const { error } = await db
                .from("debt_payments")
                .update({ paid: true })
                .eq("id", existing.id);

            if (error) throw error;

        } else {

            const { error } = await db
                .from("debt_payments")
                .insert({
                    debt_id: debtId,
                    due_date: dueDate,
                    paid: true
                });

            if (error) throw error;
        }

        await loadData();

    } catch (error) {
        console.error(error);
        alert("Could not update payment: " + error.message);
    }
}


// ==========================================
// DELETE DEBT
// ==========================================

async function deleteDebt(id) {
    const confirmed = confirm(
        "Delete this debt and its payment history?\n\nThis cannot be undone."
    );

    if (!confirmed) return;

    try {
        const { error: paymentError } = await db
            .from("debt_payments")
            .delete()
            .eq("debt_id", id);

        if (paymentError) throw paymentError;

        const { error: debtError } = await db
            .from("debts")
            .delete()
            .eq("id", id);

        if (debtError) throw debtError;

        await loadData();

    } catch (error) {
        console.error(error);
        alert("Could not delete debt: " + error.message);
    }
}


// ==========================================
// ADD MONTHLY DEBT
// ==========================================

$("debtForm").addEventListener("submit", async event => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const dueDate = form.get("first_due_date");

    const record = {
        person: String(form.get("person") || "").trim(),
        name: String(form.get("name") || "").trim(),
        amount: Number(form.get("amount")),
        months: Number(form.get("months")),
        first_due_date: dueDate,
        note: String(form.get("note") || "").trim()
    };


    // VALIDATE PERSON

    if (!["Eisya", "Capiq", "Everyone"].includes(record.person)) {
        showMessage("Please choose Eisya, Capiq or Everyone.", true);
        return;
    }


    // VALIDATE CATEGORY

    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, record.name)) {
        showMessage("Please choose a valid debt category.", true);
        return;
    }


    // VALIDATE AMOUNT AND MONTHS

    if (
        !Number.isFinite(record.amount) ||
        record.amount <= 0 ||
        !Number.isInteger(record.months) ||
        record.months < 1 ||
        record.months > 600
    ) {
        showMessage("Please enter a valid amount and number of months.", true);
        return;
    }


    // VALIDATE FIRST PAYMENT DATE

    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        showMessage("Please choose a valid first payment date.", true);
        return;
    }


    $("submitBtn").disabled = true;
    showMessage("Saving our debt...");

    try {
        const { error } = await db
            .from("debts")
            .insert(record);

        if (error) throw error;

        formElement.reset();

        showMessage("Added successfully to our little board ♡");

        await loadData();

    } catch (error) {
        console.error(error);
        showMessage("Could not save: " + error.message, true);

    } finally {
        $("submitBtn").disabled = false;
    }
});


// ==========================================
// CALENDAR NAVIGATION
// ==========================================

$("prevMonth").addEventListener("click", () => {
    viewDate = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth() - 1,
        1
    );

    selectedDate = dateKey(viewDate);
    render();
});


$("nextMonth").addEventListener("click", () => {
    viewDate = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth() + 1,
        1
    );

    selectedDate = dateKey(viewDate);
    render();
});


// ==========================================
// FILTER EVENTS
// ==========================================

$("personFilter").addEventListener("change", renderDebtList);

$("categoryFilter").addEventListener("change", renderDebtList);

$("debtDateFilter").addEventListener("change", renderDebtList);

$("debtDateFilter").addEventListener("input", () => {
    if (!$("debtDateFilter").value.trim()) {
        renderDebtList();
    }
});


$("clearDebtFilter").addEventListener("click", () => {
    $("personFilter").value = "all";
    $("categoryFilter").value = "all";
    $("debtDateFilter").value = "";

    renderDebtList();
});


// ==========================================
// START APPLICATION
// ==========================================

loadData();
