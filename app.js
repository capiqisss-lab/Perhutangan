
"use strict";

/* =========================================
   PERHUTANGAN ♡
   FAMILY DEBT TRACKER
   ========================================= */

/* SUPABASE CONFIGURATION */

const SUPABASE_URL = "https://ixcvfcismkqwjpubbbpm.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_fitSTYwCaLGS9lQXonwQJw_liwfZLi3";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* APPLICATION STATE */

let debts = [];
let payments = [];

let currentMonth = new Date();
currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
);

let selectedDate = localDate(new Date());
let toastTimer = null;

const $ = id => document.getElementById(id);

/* DEBT TYPES */

const DEBT_TYPES = [
    "TikTok Loan",
    "TikTok PayLater",
    "SLoan",
    "SPayLater",
    "Atome Loan",
    "Atome Card",
    "Atome PayLater"
];

/* HELPERS */

function money(value) {
    return new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function localDate(date) {
    const d = new Date(date);

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function parseDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
}

function addMonths(dateString, months) {
    const original = parseDate(dateString);
    const day = original.getDate();

    const result = new Date(
        original.getFullYear(),
        original.getMonth() + months,
        1
    );

    const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
    ).getDate();

    result.setDate(Math.min(day, lastDay));

    return localDate(result);
}

function formatDate(dateString) {
    return parseDate(dateString).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatLongDate(dateString) {
    return parseDate(dateString).toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function sameMonth(dateString, date) {
    const d = parseDate(dateString);

    return (
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear()
    );
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

function personName(value) {
    const names = {
        Baby: "Eisya",
        Sayang: "Capiq",
        Everyone: "Shared (Both)",
        Eisya: "Eisya",
        Capiq: "Capiq",
        "Shared (Both)": "Shared (Both)"
    };

    return names[value] || value || "Unassigned";
}

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function setConnection(status, message) {
    const dot = $("connectionDot");

    dot.className = "status-dot";

    if (status === "connected") {
        dot.classList.add("connected");
    } else if (status === "error") {
        dot.classList.add("error");
    }

    $("connectionText").textContent = message;
}

function getDebtPayments(debtId) {
    return payments
        .filter(payment =>
            String(payment.debt_id) === String(debtId)
        )
        .sort((a, b) =>
            a.due_date.localeCompare(b.due_date)
        );
}

function getDebtType(debt) {
    const storedType = String(debt?.debt_type || "").trim();

    const matchingType = DEBT_TYPES.find(type =>
        type.toLowerCase() === storedType.toLowerCase()
    );

    return matchingType || storedType || "Uncategorised";
}

/* PAYMENT SCHEDULE */

function getSchedule(debt) {
    if (!debt || !debt.first_due_date) return [];

    const amount = Number(debt.amount) || 0;
    const months = Number(debt.months) || 0;

    const existing = getDebtPayments(debt.id);

    const existingByDate = new Map(
        existing.map(payment => [payment.due_date, payment])
    );

    const schedule = [];

    for (let i = 0; i < months; i++) {
        const dueDate = addMonths(debt.first_due_date, i);
        const existingPayment = existingByDate.get(dueDate);

        schedule.push({
            id: existingPayment?.id ?? null,
            debt_id: debt.id,
            due_date: dueDate,
            paid: existingPayment?.paid === true,
            amount,
            virtual: !existingPayment
        });
    }

    return schedule;
}

function allSchedule() {
    return debts.flatMap(debt =>
        getSchedule(debt).map(payment => ({
            ...payment,
            debt
        }))
    );
}

function paymentStatus(payment) {
    if (payment.paid) return "paid";

    const today = localDate(new Date());

    if (payment.due_date < today) return "overdue";

    return "upcoming";
}

function sumPayments(items) {
    return items.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
    );
}

/* LOAD DATABASE */

async function loadData() {
    setConnection("loading", "Connecting...");

    try {
        const [debtResult, paymentResult] = await Promise.all([
            db.from("debts")
                .select("*")
                .order("created_at", { ascending: false }),

            db.from("debt_payments")
                .select("*")
                .order("due_date", { ascending: true })
        ]);

        if (debtResult.error) throw debtResult.error;
        if (paymentResult.error) throw paymentResult.error;

        debts = debtResult.data || [];
        payments = paymentResult.data || [];

        setConnection("connected", "Connected");

        renderAll();

    } catch (error) {
        console.error("Database loading error:", error);

        setConnection("error", "Connection failed");

        showToast(
            "Unable to load data. Check your Supabase settings and table permissions."
        );

        $("debtsContainer").innerHTML = `
            <div class="empty-state">
                <span>☁️</span>
                <p>Unable to load your debts.</p>
                <p>Check your internet connection and Supabase settings.</p>
            </div>
        `;
    }
}

/* DASHBOARD SUMMARY */

function renderSummary() {
    const schedule = allSchedule();

    const unpaid = schedule.filter(item => !item.paid);
    const paid = schedule.filter(item => item.paid);

    const today = localDate(new Date());

    // Unpaid instalments due in the selected month
    const thisMonth = unpaid.filter(item =>
        sameMonth(item.due_date, currentMonth)
    );

    // Unpaid instalments that are past their due date
    const overdue = unpaid.filter(item =>
        item.due_date < today
    );

    // Count unique debt accounts, not individual instalments
    const activeDebtThisMonth = new Set(
        thisMonth.map(item => String(item.debt_id))
    ).size;

    const activeDebtOverall = new Set(
        unpaid.map(item => String(item.debt_id))
    ).size;

    // Payments due today
    const todayItems = unpaid.filter(item =>
        item.due_date === today
    );

    // This calendar week: Sunday to Saturday
    const todayDate = parseDate(today);

    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekItems = unpaid.filter(item => {
        const date = parseDate(item.due_date);

        return date >= weekStart && date <= weekEnd;
    });

    // Next 7 days, including today
    const upcomingEnd = new Date(todayDate);
    upcomingEnd.setDate(upcomingEnd.getDate() + 6);

    const upcoming = unpaid.filter(item => {
        const date = parseDate(item.due_date);

        return date >= todayDate && date <= upcomingEnd;
    });

    // Main dashboard
    $("totalThisMonth").textContent =
        money(sumPayments(thisMonth));

    $("activeDebtThisMonth").textContent =
        activeDebtThisMonth;

    $("totalOutstanding").textContent =
        money(sumPayments(unpaid));

    $("activeDebtOverall").textContent =
        activeDebtOverall;

    // Secondary dashboard
    $("totalPaid").textContent =
        money(sumPayments(paid));

    $("dueThisMonth").textContent =
        money(sumPayments(thisMonth));

    $("totalOverdue").textContent =
        money(sumPayments(overdue));

    // Quick summary
    $("todayOutstanding").textContent =
        money(sumPayments(todayItems));

    $("weekOutstanding").textContent =
        money(sumPayments(weekItems));

    $("upcomingOutstanding").textContent =
        money(sumPayments(upcoming));
}

/* DEBT TYPE OVERVIEW */

function renderDebtTypeSummary() {
    const schedule = allSchedule();

    const unpaid = schedule.filter(item => !item.paid);

    const thisMonth = unpaid.filter(item =>
        sameMonth(item.due_date, currentMonth)
    );

    $("typeMonthCount").textContent = thisMonth.length;
    $("typeAllCount").textContent = unpaid.length;

    const breakdown = {};

    DEBT_TYPES.forEach(type => {
        breakdown[type] = {
            monthCount: 0,
            allCount: 0,
            monthAmount: 0,
            allAmount: 0
        };
    });

    // Overall unpaid instalments
    unpaid.forEach(item => {
        const type = getDebtType(item.debt);

        if (!breakdown[type]) return;

        breakdown[type].allCount++;
        breakdown[type].allAmount += Number(item.amount) || 0;
    });

    // Unpaid instalments due in the selected month
    thisMonth.forEach(item => {
        const type = getDebtType(item.debt);

        if (!breakdown[type]) return;

        breakdown[type].monthCount++;
        breakdown[type].monthAmount += Number(item.amount) || 0;
    });

    $("debtTypeBreakdown").innerHTML = DEBT_TYPES.map(type => {
        const data = breakdown[type];

        return `
            <article class="debt-type-row">

                <div class="debt-type-row-name">
                    <strong>${escapeHTML(type)}</strong>
                </div>

                <div class="debt-type-column">
                    <strong>${data.monthCount}</strong>
                    <small>${money(data.monthAmount)}</small>
                </div>

                <div class="debt-type-column">
                    <strong>${data.allCount}</strong>
                    <small>${money(data.allAmount)}</small>
                </div>

            </article>
        `;
    }).join("");
}

/* CALENDAR */

function renderCalendar() {
    $("calendarMonth").textContent =
        currentMonth.toLocaleDateString("en-MY", {
            month: "long",
            year: "numeric"
        });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const startingDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();

    const schedule = allSchedule();
    const paymentsByDate = new Map();

    schedule.forEach(payment => {
        if (!paymentsByDate.has(payment.due_date)) {
            paymentsByDate.set(payment.due_date, []);
        }

        paymentsByDate.get(payment.due_date).push(payment);
    });

    const totalCells = Math.ceil(
        (startingDay + daysInMonth) / 7
    ) * 7;

    let html = "";

    for (let i = 0; i < totalCells; i++) {
        let day;
        let dateString;
        let outside = false;

        if (i < startingDay) {
            day = previousMonthDays - startingDay + i + 1;
            dateString = localDate(new Date(year, month - 1, day));
            outside = true;

        } else if (i >= startingDay + daysInMonth) {
            day = i - startingDay - daysInMonth + 1;
            dateString = localDate(new Date(year, month + 1, day));
            outside = true;

        } else {
            day = i - startingDay + 1;
            dateString = localDate(new Date(year, month, day));
        }

        const dayPayments = paymentsByDate.get(dateString) || [];
        const today = localDate(new Date());

        const classes = [
            "calendar-day",
            outside ? "outside-month" : "",
            dateString === selectedDate ? "selected" : "",
            dateString === today ? "today" : "",
            dayPayments.length ? "has-payment" : ""
        ].filter(Boolean).join(" ");

        const markers = dayPayments.slice(0, 4).map(payment => {
            const status = paymentStatus(payment);

            const markerClass = status === "paid"
                ? "paid"
                : status === "overdue"
                    ? "overdue"
                    : "due";

            return `<i class="day-marker ${markerClass}"></i>`;
        }).join("");

        html += `
            <button class="${classes}"
                data-date="${dateString}"
                type="button"
                aria-label="${dateString}">
                <span class="calendar-day-number">${day}</span>
                <span class="day-markers">${markers}</span>
            </button>
        `;
    }

    $("calendarDays").innerHTML = html;
}

function handleCalendarClick(event) {
    const button = event.target.closest(".calendar-day");

    if (!button) return;

    selectedDate = button.dataset.date;

    const clickedDate = parseDate(selectedDate);

    currentMonth = new Date(
        clickedDate.getFullYear(),
        clickedDate.getMonth(),
        1
    );

    renderAll();
}

/* SELECTED DATE PAYMENTS */

function renderSelectedDate() {
    $("selectedDateTitle").textContent =
        formatLongDate(selectedDate);

    const items = allSchedule().filter(
        item => item.due_date === selectedDate
    );

    const unpaid = items.filter(item => !item.paid);

    $("selectedDateTotal").textContent =
        money(sumPayments(unpaid));

    if (!items.length) {
        $("selectedDatePayments").innerHTML = `
            <div class="empty-state">
                <span>☁️</span>
                <p>No payments scheduled for this date.</p>
            </div>
        `;
        return;
    }

    $("selectedDatePayments").innerHTML = items.map(item => {
        const status = paymentStatus(item);

        return `
            <div class="payment-item">

                <div class="payment-info">
                    <strong>${escapeHTML(item.debt.name)}</strong>

                    <small>
                        ${escapeHTML(getDebtType(item.debt))}
                        · ${escapeHTML(personName(item.debt.person))}
                    </small>
                </div>

                <div class="payment-right">
                    <strong>${money(item.amount)}</strong>

                    <span class="status-pill status-${status}">
                        ${status.toUpperCase()}
                    </span>
                </div>

            </div>
        `;
    }).join("");
}

/* MONTHLY BREAKDOWN */

function renderMonthlyTotals() {
    const schedule = allSchedule().filter(
        item => sameMonth(item.due_date, currentMonth)
    );

    $("monthlyBreakdownTitle").textContent =
        currentMonth.toLocaleDateString("en-MY", {
            month: "long",
            year: "numeric"
        }) + " breakdown";

    const paid = schedule.filter(item => item.paid);
    const unpaid = schedule.filter(item => !item.paid);

    $("monthlyScheduled").textContent =
        money(sumPayments(schedule));

    $("monthlyPaid").textContent =
        money(sumPayments(paid));

    $("monthlyRemaining").textContent =
        money(sumPayments(unpaid));

    const groups = {
        Capiq: { scheduled: 0, paid: 0, remaining: 0 },
        Eisya: { scheduled: 0, paid: 0, remaining: 0 },
        "Shared (Both)": { scheduled: 0, paid: 0, remaining: 0 }
    };

    schedule.forEach(item => {
        const person = personName(item.debt.person);

        if (!groups[person]) return;

        groups[person].scheduled += Number(item.amount) || 0;

        if (item.paid) {
            groups[person].paid += Number(item.amount) || 0;
        } else {
            groups[person].remaining += Number(item.amount) || 0;
        }
    });

    const ids = {
        Capiq: "capiq",
        Eisya: "eisya",
        "Shared (Both)": "shared"
    };

    Object.entries(groups).forEach(([person, data]) => {
        const prefix = ids[person];

        $(`${prefix}Scheduled`).textContent = money(data.scheduled);
        $(`${prefix}Paid`).textContent = money(data.paid);
        $(`${prefix}Remaining`).textContent = money(data.remaining);
    });
}

/* DEBT STATUS */

function debtProgress(debt) {
    const schedule = getSchedule(debt);

    const completed = schedule.filter(item => item.paid).length;
    const total = schedule.length;

    return {
        completed,
        total,
        percentage: total
            ? Math.round(completed / total * 100)
            : 0
    };
}

function getDebtStatus(debt) {
    const schedule = getSchedule(debt);

    if (schedule.length && schedule.every(item => item.paid)) {
        return "completed";
    }

    if (schedule.some(item =>
        !item.paid && item.due_date < localDate(new Date())
    )) {
        return "overdue";
    }

    return "active";
}

/* DEBT CARDS AND FILTERS */

function renderDebts() {
    const search = $("searchDebt").value.trim().toLowerCase();
    const personFilter = $("personFilter").value;
    const typeFilter = $("debtTypeFilter").value;
    const statusFilter = $("statusFilter").value;

    const filtered = debts.filter(debt => {
        const name = String(debt.name || "").toLowerCase();
        const note = String(debt.note || "").toLowerCase();
        const type = getDebtType(debt);

        const matchesSearch =
            name.includes(search) ||
            note.includes(search) ||
            type.toLowerCase().includes(search);

        const matchesPerson =
            personFilter === "all" ||
            personName(debt.person) === personName(personFilter);

        const matchesType =
            typeFilter === "all" ||
            type === typeFilter;

        const debtStatus = getDebtStatus(debt);

        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "paid" && debtStatus === "completed") ||
            (statusFilter === "unpaid" &&
                (debtStatus === "active" || debtStatus === "overdue")) ||
            (statusFilter === "overdue" && debtStatus === "overdue");

        return (
            matchesSearch &&
            matchesPerson &&
            matchesType &&
            matchesStatus
        );
    });

    $("debtCount").textContent =
        `${filtered.length} ${filtered.length === 1 ? "debt" : "debts"}`;

    if (!filtered.length) {
        $("debtsContainer").innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <span>♡</span>
                <p>No debts found.</p>
            </div>
        `;
        return;
    }

    $("debtsContainer").innerHTML = filtered.map(debt => {
        const schedule = getSchedule(debt);
        const progress = debtProgress(debt);
        const status = getDebtStatus(debt);
        const type = getDebtType(debt);

        const nextPayment = schedule.find(item => !item.paid);

        const outstanding = sumPayments(
            schedule.filter(item => !item.paid)
        );

        const totalPaid = sumPayments(
            schedule.filter(item => item.paid)
        );

        const statusLabel = {
            active: "ACTIVE",
            overdue: "OVERDUE",
            completed: "COMPLETED"
        }[status];

        const actionButton = nextPayment
            ? `
                <button class="small-button pay-button"
                    data-action="pay"
                    data-debt="${escapeHTML(debt.id)}"
                    data-date="${nextPayment.due_date}">
                    ✓ Mark Next Paid
                </button>
            `
            : `<span class="status-pill status-paid">ALL PAID</span>`;

        const undoButton = schedule.some(item => item.paid)
            ? `
                <button class="small-button undo-button"
                    data-action="undo"
                    data-debt="${escapeHTML(debt.id)}">
                    ↶ Undo Last Paid
                </button>
            `
            : "";

        return `
            <article class="debt-card">

                <div class="debt-card-top">
                    <div>
                        <h3>${escapeHTML(debt.name)}</h3>

                        <span class="debt-person">
                            ${escapeHTML(personName(debt.person))}
                            · ${schedule.length} months
                        </span>
                    </div>

                    <span class="status-pill status-${
                        status === "completed"
                            ? "paid"
                            : status === "overdue"
                                ? "overdue"
                                : "upcoming"
                    }">${statusLabel}</span>
                </div>

                <div class="debt-type-badge">
                    ${escapeHTML(type)}
                </div>

                <div class="debt-amount">${money(outstanding)}</div>
                <div class="debt-amount-label">Remaining outstanding</div>

                <div class="debt-details">

                    <div>
                        <span>Monthly payment</span>
                        <strong>${money(debt.amount)}</strong>
                    </div>

                    <div>
                        <span>Total paid</span>
                        <strong>${money(totalPaid)}</strong>
                    </div>

                    <div>
                        <span>First due date</span>
                        <strong>${formatDate(debt.first_due_date)}</strong>
                    </div>

                    <div>
                        <span>Next payment</span>
                        <strong>
                            ${nextPayment
                                ? formatDate(nextPayment.due_date)
                                : "Completed"}
                        </strong>
                    </div>

                </div>

                <div class="debt-progress">
                    <div class="debt-progress-fill"
                        style="width:${progress.percentage}%"></div>
                </div>

                <div class="debt-progress-label">
                    <span>${progress.completed} / ${progress.total} payments completed</span>
                    <strong>${progress.percentage}%</strong>
                </div>

                ${debt.note ? `
                    <div class="debt-note">
                        ♡ ${escapeHTML(debt.note)}
                    </div>
                ` : ""}

                <div class="debt-actions">
                    ${actionButton}
                    ${undoButton}

                    <button class="small-button delete-button"
                        data-action="delete"
                        data-debt="${escapeHTML(debt.id)}">
                        Delete
                    </button>
                </div>

            </article>
        `;
    }).join("");
}

/* DEBT ACTION BUTTONS */

async function handleDebtAction(event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const debtId = button.dataset.debt;

    button.disabled = true;

    try {
        if (action === "pay") {
            await markPaymentPaid(debtId, button.dataset.date);

        } else if (action === "undo") {
            await undoLastPayment(debtId);

        } else if (action === "delete") {
            await deleteDebt(debtId);
        }

    } finally {
        button.disabled = false;
    }
}

/* MARK PAYMENT PAID */

async function markPaymentPaid(debtId, dueDate) {
    const debt = debts.find(
        item => String(item.id) === String(debtId)
    );

    if (!debt) return;

    const existing = payments.find(payment =>
        String(payment.debt_id) === String(debtId) &&
        payment.due_date === dueDate
    );

    if (existing?.paid) {
        showToast("This payment is already paid.");
        return;
    }

    try {
        let result;

        if (existing) {
            result = await db.from("debt_payments")
                .update({ paid: true })
                .eq("id", existing.id)
                .select()
                .single();

        } else {
            result = await db.from("debt_payments")
                .insert({
                    debt_id: debt.id,
                    due_date: dueDate,
                    paid: true
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        showToast("Payment successfully marked as paid! ♡");

        await loadData();

    } catch (error) {
        console.error("Payment update error:", error);
        showToast("Unable to update payment. Please try again.");
    }
}

/* UNDO PAYMENT */

async function undoLastPayment(debtId) {
    const debt = debts.find(
        item => String(item.id) === String(debtId)
    );

    if (!debt) return;

    const lastPaid = getSchedule(debt)
        .filter(item => item.paid && item.id)
        .sort((a, b) => b.due_date.localeCompare(a.due_date))[0];

    if (!lastPaid) {
        showToast("Unable to find the saved payment record.");
        return;
    }

    if (!confirm("Are you sure you want to undo this payment?")) {
        return;
    }

    try {
        const { error } = await db.from("debt_payments")
            .update({ paid: false })
            .eq("id", lastPaid.id);

        if (error) throw error;

        showToast("Payment status has been undone.");

        await loadData();

    } catch (error) {
        console.error("Undo error:", error);
        showToast("Unable to undo payment.");
    }
}

/* DELETE DEBT */

async function deleteDebt(debtId) {
    const debt = debts.find(
        item => String(item.id) === String(debtId)
    );

    if (!debt) return;

    const confirmed = confirm(
        `Delete "${debt.name}" and its payment history? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
        const { error: paymentError } = await db.from("debt_payments")
            .delete()
            .eq("debt_id", debtId);

        if (paymentError) throw paymentError;

        const { error: debtError } = await db.from("debts")
            .delete()
            .eq("id", debtId);

        if (debtError) throw debtError;

        showToast("Debt deleted successfully.");

        await loadData();

    } catch (error) {
        console.error("Delete error:", error);
        showToast("Unable to delete debt. Check database permissions.");
    }
}

/* ADD DEBT MODAL */

function openModal() {
    $("debtModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("debtName").focus();
}

function closeModal() {
    $("debtModal").hidden = true;
    document.body.style.overflow = "";

    $("debtForm").reset();
    $("debtFirstDate").value = localDate(new Date());

    updateEstimatedTotal();
}

function updateEstimatedTotal() {
    const amount = Number($("debtAmount").value) || 0;
    const months = Number($("debtMonths").value) || 0;

    $("estimatedTotal").textContent = money(amount * months);
}

/* SAVE NEW DEBT */

async function saveDebt(event) {
    event.preventDefault();

    const person = $("debtPerson").value;
    const debtType = $("debtType").value;
    const name = $("debtName").value.trim();
    const amount = Number($("debtAmount").value);
    const months = Number($("debtMonths").value);
    const firstDate = $("debtFirstDate").value;
    const note = $("debtNote").value.trim();

    if (
        !name ||
        !firstDate ||
        !DEBT_TYPES.includes(debtType) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isInteger(months) ||
        months < 1 ||
        months > 600
    ) {
        showToast("Please fill in all required fields correctly.");
        return;
    }

    const button = $("saveDebtButton");

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const { data: debt, error } = await db.from("debts")
            .insert({
                person,
                debt_type: debtType,
                name,
                amount,
                months,
                first_due_date: firstDate,
                note
            })
            .select()
            .single();

        if (error) throw error;

        const paymentRows = [];

        for (let i = 0; i < months; i++) {
            paymentRows.push({
                debt_id: debt.id,
                due_date: addMonths(firstDate, i),
                paid: false
            });
        }

        const { error: paymentError } = await db
            .from("debt_payments")
            .insert(paymentRows);

        closeModal();

        if (paymentError) {
            console.error("Payment schedule creation error:", paymentError);

            showToast(
                "Debt saved, but the payment schedule could not be saved. Check Supabase permissions."
            );

        } else {
            showToast("New debt and payment schedule saved! ♡");
        }

        await loadData();

    } catch (error) {
        console.error("Save debt error:", error);
        showToast(error.message || "Unable to save debt.");

    } finally {
        button.disabled = false;
        button.textContent = "Save debt";
    }
}

/* CALENDAR NAVIGATION */

function changeMonth(direction) {
    currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + direction,
        1
    );

    selectedDate = localDate(currentMonth);

    renderAll();
}

/* RENDER EVERYTHING */

function renderAll() {
    renderSummary();
    renderCalendar();
    renderSelectedDate();
    renderDebtTypeSummary();
    renderMonthlyTotals();
    renderDebts();
}

/* EVENT LISTENERS */

function initializeEvents() {
    $("openAddDebt").addEventListener("click", openModal);
    $("closeDebtModal").addEventListener("click", closeModal);

    $("debtModal").addEventListener("click", event => {
        if (event.target === $("debtModal")) {
            closeModal();
        }
    });

    $("debtForm").addEventListener("submit", saveDebt);

    $("previousMonth").addEventListener(
        "click",
        () => changeMonth(-1)
    );

    $("nextMonth").addEventListener(
        "click",
        () => changeMonth(1)
    );

    $("calendarDays").addEventListener(
        "click",
        handleCalendarClick
    );

    $("debtsContainer").addEventListener(
        "click",
        handleDebtAction
    );

    $("searchDebt").addEventListener("input", renderDebts);
    $("personFilter").addEventListener("change", renderDebts);
    $("debtTypeFilter").addEventListener("change", renderDebts);
    $("statusFilter").addEventListener("change", renderDebts);

    $("debtAmount").addEventListener("input", updateEstimatedTotal);
    $("debtMonths").addEventListener("input", updateEstimatedTotal);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("debtModal").hidden) {
            closeModal();
        }
    });
}

/* START APPLICATION */

document.addEventListener("DOMContentLoaded", async () => {
    initializeEvents();

    $("debtFirstDate").value = localDate(new Date());

    updateEstimatedTotal();

    await loadData();
});
