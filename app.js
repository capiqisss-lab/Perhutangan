
"use strict";

/* =========================================
   PERHUTANGAN ♡
   FAMILY DEBT TRACKER
   ========================================= */

/* SUPABASE CONFIGURATION */

const SUPABASE_URL = "https://ixcvfcismkqwjpubbbpm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fitSTYwCaLGS9lQXonwQJw_liwfZLi3";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* DEBT TYPES */

const DEBT_TYPE_LABELS = {
    tiktokloan: "TikTok Loan",
    tiktokpaylater: "TikTok PayLater",
    sloan: "SLoan",
    spaylater: "SPayLater",
    atomeloan: "Atome Loan",
    atomecard: "Atome Card",
    atomepaylater: "Atome PayLater",
    boostloan: "Boost Loan",
    other: "Other"
};

const DEBT_TYPE_ORDER = [
    "tiktokloan",
    "tiktokpaylater",
    "sloan",
    "spaylater",
    "atomeloan",
    "atomecard",
    "atomepaylater",
    "boostloan"
];

/* APPLICATION STATE */

let debts = [];
let payments = [];

let calendarMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

let selectedDate = toDateKey(new Date());
let isSaving = false;
let toastTimeout = null;

/* HELPERS */

function $(id) {
    return document.getElementById(id);
}

function money(value) {
    return new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function normalizeDebtType(value) {
    const normalized = String(value || "other")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    const aliases = {
        "tiktokloan": "tiktokloan",
        "tiktokpaylater": "tiktokpaylater",
        "sloan": "sloan",
        "spaylater": "spaylater",
        "atomeloan": "atomeloan",
        "atomecard": "atomecard",
        "atomepaylater": "atomepaylater",
        "boostloan": "boostloan",
        "other": "other"
    };

    return aliases[normalized] || normalized || "other";
}

function debtTypeLabel(value) {
    const type = normalizeDebtType(value);

    if (DEBT_TYPE_LABELS[type]) {
        return DEBT_TYPE_LABELS[type];
    }

    return type
        .replace(/([a-z])([0-9])/gi, "$1 $2")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, letter => letter.toUpperCase());
}

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
    if (!value) return null;

    const parts = String(value).slice(0, 10).split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return null;
    }

    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(value, options = {}) {
    const date = value instanceof Date ? value : parseDateKey(value);

    if (!date || Number.isNaN(date.getTime())) {
        return "Not set";
    }

    return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...options
    });
}

function addMonthsClamped(date, monthsToAdd) {
    const originalDay = date.getDate();

    const result = new Date(
        date.getFullYear(),
        date.getMonth() + monthsToAdd,
        1
    );

    const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
    ).getDate();

    result.setDate(Math.min(originalDay, lastDay));

    return result;
}

function isBeforeToday(dateKey) {
    return dateKey < toDateKey(new Date());
}

function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(dateKey, monthKey) {
    return String(dateKey).slice(0, 7) === monthKey;
}

function showToast(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function setConnectionStatus(message, state = "loading") {
    const label = $("connectionStatus");
    const dot = $("statusDot");

    if (label) label.textContent = message;

    if (dot) {
        dot.className = "status-dot";

        if (state === "connected") {
            dot.classList.add("connected");
        } else if (state === "error") {
            dot.classList.add("error");
        }
    }
}

/* PAYMENT SCHEDULE */

function getDebtSchedule(debt) {
    const amount = Number(debt.amount) || 0;
    const months = Math.max(0, Number(debt.months) || 0);
    const firstDate = parseDateKey(debt.first_due_date);

    if (!firstDate || !months || amount <= 0) {
        return [];
    }

    const schedule = [];

    for (let index = 0; index < months; index++) {
        const dueDate = addMonthsClamped(firstDate, index);
        const dueDateKey = toDateKey(dueDate);

        const paymentRecord = payments.find(payment =>
            String(payment.debt_id) === String(debt.id) &&
            String(payment.due_date).slice(0, 10) === dueDateKey
        );

        schedule.push({
            debtId: debt.id,
            debtName: debt.name,
            person: debt.person,
            debtType: normalizeDebtType(debt.debt_type),
            amount,
            dueDate: dueDateKey,
            paid: paymentRecord ? Boolean(paymentRecord.paid) : false
        });
    }

    return schedule;
}

function getAllSchedule() {
    return debts.flatMap(debt => getDebtSchedule(debt));
}

function getDebtScheduleFor(debt) {
    return getDebtSchedule(debt);
}

function getDebtStats(debt) {
    const schedule = getDebtScheduleFor(debt);

    const paid = schedule.filter(item => item.paid);
    const unpaid = schedule.filter(item => !item.paid);
    const overdue = unpaid.filter(item => isBeforeToday(item.dueDate));

    const paidAmount = paid.reduce((sum, item) => sum + item.amount, 0);
    const outstanding = unpaid.reduce((sum, item) => sum + item.amount, 0);

    return {
        schedule,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        overdueCount: overdue.length,
        paidAmount,
        outstanding,
        completed: schedule.length > 0 && unpaid.length === 0,
        hasOverdue: overdue.length > 0,
        totalCount: schedule.length,
        progress: schedule.length
            ? Math.round((paid.length / schedule.length) * 100)
            : 0
    };
}

/* DATA LOADING */

async function loadData() {
    setConnectionStatus("Connecting...", "loading");

    try {
        const [debtResult, paymentResult] = await Promise.all([
            supabaseClient
                .from("debts")
                .select("*")
                .order("created_at", { ascending: false }),

            supabaseClient
                .from("debt_payments")
                .select("*")
        ]);

        if (debtResult.error) throw debtResult.error;
        if (paymentResult.error) throw paymentResult.error;

        debts = debtResult.data || [];
        payments = paymentResult.data || [];

        setConnectionStatus("Connected", "connected");

        renderEverything();
    } catch (error) {
        console.error("Unable to load debt data:", error);

        setConnectionStatus("Connection error", "error");

        $("debtList").innerHTML = `
            <div class="empty-state">
                <span>!</span>
                <p>Unable to load your debts.</p>
                <p>${escapeHTML(error.message || "Please check your Supabase settings.")}</p>
            </div>
        `;

        showToast("Could not connect to Supabase.");
    }
}

function renderEverything() {
    renderDashboard();
    renderCalendar();
    renderSelectedDatePayments();
    renderDebtTypeOverview();
    renderMonthlyBreakdown();
    renderDebtList();
}

/* DASHBOARD */

function renderDashboard() {
    const allSchedule = getAllSchedule();
    const currentMonth = getMonthKey(new Date());

    const monthSchedule = allSchedule.filter(item =>
        isInMonth(item.dueDate, currentMonth)
    );

    const monthUnpaid = monthSchedule.filter(item => !item.paid);
    const allUnpaid = allSchedule.filter(item => !item.paid);
    const allPaid = allSchedule.filter(item => item.paid);

    const overdue = allUnpaid.filter(item => isBeforeToday(item.dueDate));

    const monthOutstanding = monthUnpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const overallOutstanding = allUnpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const totalPaid = allPaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const dueThisMonth = monthSchedule.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const overdueTotal = overdue.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const activeMonthDebtIds = new Set(
        monthUnpaid.map(item => String(item.debtId))
    );

    const overallActiveDebtIds = new Set(
        allUnpaid.map(item => String(item.debtId))
    );

    $("totalOutstandingMonth").textContent = money(monthOutstanding);
    $("activeDebtMonth").textContent = activeMonthDebtIds.size;

    $("totalOverallOutstanding").textContent = money(overallOutstanding);
    $("totalOverallActiveDebt").textContent = overallActiveDebtIds.size;

    $("totalPaid").textContent = money(totalPaid);
    $("dueThisMonth").textContent = money(dueThisMonth);
    $("overdueTotal").textContent = money(overdueTotal);
}

/* CALENDAR */

function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    $("calendarTitle").textContent = calendarMonth.toLocaleDateString(
        "en-MY",
        { month: "long", year: "numeric" }
    );

    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const previousMonthDays = new Date(year, month, 0).getDate();

    const schedule = getAllSchedule();

    let html = "";

    for (let cell = 0; cell < 42; cell++) {
        let date;
        let outside = false;

        if (cell < startDay) {
            date = new Date(year, month - 1, previousMonthDays - startDay + cell + 1);
            outside = true;
        } else if (cell >= startDay + daysInMonth) {
            date = new Date(year, month + 1, cell - startDay - daysInMonth + 1);
            outside = true;
        } else {
            date = new Date(year, month, cell - startDay + 1);
        }

        const dateKey = toDateKey(date);
        const dayPayments = schedule.filter(item => item.dueDate === dateKey);

        const hasPaid = dayPayments.some(item => item.paid);
        const hasOverdue = dayPayments.some(
            item => !item.paid && isBeforeToday(item.dueDate)
        );
        const hasUnpaid = dayPayments.some(item => !item.paid);

        const today = dateKey === toDateKey(new Date());
        const selected = dateKey === selectedDate;

        let markers = "";

        if (hasUnpaid) {
            markers += `<i class="day-marker ${hasOverdue ? "overdue" : ""}"></i>`;
        }

        if (hasPaid) {
            markers += `<i class="day-marker paid"></i>`;
        }

        html += `
            <button
                type="button"
                class="calendar-day
                    ${outside ? "outside-month" : ""}
                    ${today ? "today" : ""}
                    ${selected ? "selected" : ""}"
                data-date="${dateKey}"
                aria-label="${escapeHTML(formatDate(dateKey))}"
            >
                <span class="calendar-day-number">${date.getDate()}</span>
                <span class="day-markers">${markers}</span>
            </button>
        `;
    }

    $("calendarGrid").innerHTML = html;
}

function changeCalendarMonth(amount) {
    calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + amount,
        1
    );

    selectedDate = toDateKey(calendarMonth);
    renderCalendar();
    renderSelectedDatePayments();
}

/* SELECTED DATE PAYMENTS */

function renderSelectedDatePayments() {
    const schedule = getAllSchedule().filter(item =>
        item.dueDate === selectedDate
    );

    $("selectedDateTitle").textContent = formatDate(selectedDate);

    const unpaidTotal = schedule
        .filter(item => !item.paid)
        .reduce((sum, item) => sum + item.amount, 0);

    $("selectedDateTotal").textContent = money(unpaidTotal);

    if (!schedule.length) {
        $("selectedDatePayments").innerHTML = `
            <div class="empty-state">
                <span>♡</span>
                <p>No scheduled payments for this date.</p>
            </div>
        `;
        return;
    }

    $("selectedDatePayments").innerHTML = schedule.map(item => {
        const overdue = !item.paid && isBeforeToday(item.dueDate);

        const statusClass = item.paid
            ? "status-paid"
            : overdue
                ? "status-overdue"
                : "status-upcoming";

        const statusLabel = item.paid
            ? "PAID"
            : overdue
                ? "OVERDUE"
                : "UNPAID";

        return `
            <div class="payment-item">
                <div class="payment-info">
                    <strong>${escapeHTML(item.debtName)}</strong>
                    <small>${escapeHTML(item.person)} · ${escapeHTML(debtTypeLabel(item.debtType))}</small>
                    <div style="margin-top:7px">
                        <span class="status-pill ${statusClass}">${statusLabel}</span>
                    </div>
                </div>

                <div class="payment-right">
                    <strong>${money(item.amount)}</strong>
                    <div style="margin-top:7px">
                        <button
                            type="button"
                            class="small-action ${item.paid ? "undo-button" : "pay-button"}"
                            data-action="${item.paid ? "undo" : "pay"}"
                            data-debt-id="${escapeHTML(item.debtId)}"
                            data-due-date="${item.dueDate}"
                        >
                            ${item.paid ? "Undo" : "Mark Paid"}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

/* PAYMENT ACTIONS */

async function setPaymentStatus(debtId, dueDate, paid) {
    const existing = payments.find(payment =>
        String(payment.debt_id) === String(debtId) &&
        String(payment.due_date).slice(0, 10) === dueDate
    );

    try {
        if (existing) {
            const { data, error } = await supabaseClient
                .from("debt_payments")
                .update({ paid })
                .eq("id", existing.id)
                .select()
                .single();

            if (error) throw error;

            payments = payments.map(payment =>
                String(payment.id) === String(existing.id) ? data : payment
            );
        } else {
            const { data, error } = await supabaseClient
                .from("debt_payments")
                .insert({
                    debt_id: debtId,
                    due_date: dueDate,
                    paid
                })
                .select()
                .single();

            if (error) throw error;

            payments.push(data);
        }

        renderEverything();
        showToast(paid ? "Payment marked as paid ♡" : "Payment changed to unpaid.");
    } catch (error) {
        console.error("Payment update failed:", error);
        showToast(error.message || "Unable to update payment.");
    }
}

/* DEBT TYPE OVERVIEW */

function renderDebtTypeOverview() {
    const allSchedule = getAllSchedule();
    const currentMonth = getMonthKey(new Date());

    const unpaid = allSchedule.filter(item => !item.paid);
    const monthUnpaid = unpaid.filter(item =>
        isInMonth(item.dueDate, currentMonth)
    );

    const monthAmount = monthUnpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const overallAmount = unpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    $("typeMonthCount").textContent = monthUnpaid.length;
    $("typeMonthAmount").textContent = `${money(monthAmount)} unpaid`;

    $("typeOverallCount").textContent = unpaid.length;
    $("typeOverallAmount").textContent = `${money(overallAmount)} unpaid`;

    const typesPresent = new Set([
        ...DEBT_TYPE_ORDER,
        ...debts.map(debt => normalizeDebtType(debt.debt_type))
    ]);

    const typeKeys = Array.from(typesPresent);

    $("debtTypeOverview").innerHTML = typeKeys.map(type => {
        const monthItems = monthUnpaid.filter(item => item.debtType === type);
        const allItems = unpaid.filter(item => item.debtType === type);

        const monthTotal = monthItems.reduce(
            (sum, item) => sum + item.amount, 0
        );

        const allTotal = allItems.reduce(
            (sum, item) => sum + item.amount, 0
        );

        return `
            <div class="debt-type-row">
                <div class="debt-type-row-name">
                    <strong>${escapeHTML(debtTypeLabel(type))}</strong>
                </div>

                <div class="debt-type-column">
                    <strong>${monthItems.length}</strong>
                    <small>${money(monthTotal)}</small>
                </div>

                <div class="debt-type-column">
                    <strong>${allItems.length}</strong>
                    <small>${money(allTotal)}</small>
                </div>
            </div>
        `;
    }).join("");
}

/* MONTHLY BREAKDOWN */

function renderMonthlyBreakdown() {
    const currentMonth = getMonthKey(new Date());

    const monthItems = getAllSchedule().filter(item =>
        isInMonth(item.dueDate, currentMonth)
    );

    const paid = monthItems.filter(item => item.paid);
    const unpaid = monthItems.filter(item => !item.paid);

    const dueTotal = monthItems.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const paidTotal = paid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const remainingTotal = unpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    $("monthDueTotal").textContent = money(dueTotal);
    $("monthPaidTotal").textContent = money(paidTotal);
    $("monthRemainingTotal").textContent = money(remainingTotal);

    const people = [
        { name: "Baby", icon: "♡", className: "baby-card" },
        { name: "Sayang", icon: "♡", className: "sayang-card" }
    ];

    $("monthBreakdown").innerHTML = people.map(person => {
        const personItems = monthItems.filter(item =>
            item.person === person.name
        );

        const personPaid = personItems
            .filter(item => item.paid)
            .reduce((sum, item) => sum + item.amount, 0);

        const personUnpaid = personItems
            .filter(item => !item.paid)
            .reduce((sum, item) => sum + item.amount, 0);

        const personTotal = personItems.reduce(
            (sum, item) => sum + item.amount, 0
        );

        return `
            <article class="person-card ${person.className}">
                <div class="person-heading">
                    <span class="person-avatar">${person.icon}</span>
                    <strong>${person.name}</strong>
                </div>

                <div class="person-numbers">
                    <div>
                        <small>Total due</small>
                        <strong>${money(personTotal)}</strong>
                    </div>
                    <div>
                        <small>Paid</small>
                        <strong>${money(personPaid)}</strong>
                    </div>
                    <div>
                        <small>Remaining</small>
                        <strong>${money(personUnpaid)}</strong>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* ALL COMMITMENTS FILTER */

function getFilteredDebts() {
    const search = $("debtSearch").value.trim().toLowerCase();
    const selectedPerson = $("personFilter").value;
    const selectedStatus = $("statusFilter").value;
    const selectedType = $("debtTypeFilter").value;

    return debts.filter(debt => {
        const stats = getDebtStats(debt);

        const name = String(debt.name || "").toLowerCase();
        const note = String(debt.note || "").toLowerCase();

        const matchesSearch =
            !search ||
            name.includes(search) ||
            note.includes(search);

        const matchesPerson =
            selectedPerson === "all" ||
            String(debt.person) === selectedPerson;

        const debtType = normalizeDebtType(debt.debt_type);
        const filterType = normalizeDebtType(selectedType);

        const matchesDebtType =
            selectedType === "all" ||
            debtType === filterType;

        let matchesStatus = true;

        if (selectedStatus === "unpaid") {
            matchesStatus = stats.unpaidCount > 0;
        } else if (selectedStatus === "paid") {
            matchesStatus = stats.completed;
        } else if (selectedStatus === "overdue") {
            matchesStatus = stats.hasOverdue;
        }

        return (
            matchesSearch &&
            matchesPerson &&
            matchesDebtType &&
            matchesStatus
        );
    });
}

function renderDebtList() {
    const filteredDebts = getFilteredDebts();

    $("debtCount").textContent = filteredDebts.length;

    const activeFilters = [
        $("debtSearch").value.trim(),
        $("personFilter").value !== "all",
        $("statusFilter").value !== "all",
        $("debtTypeFilter").value !== "all"
    ].some(Boolean);

    $("filterMessage").textContent = activeFilters
        ? `Showing ${filteredDebts.length} matching debt account(s).`
        : "";

    if (!filteredDebts.length) {
        $("debtList").innerHTML = `
            <div class="empty-state">
                <span>♡</span>
                <p>No matching debts found.</p>
                <p>Try changing your filters or add a new debt.</p>
            </div>
        `;
        return;
    }

    $("debtList").innerHTML = filteredDebts.map(debt => {
        const stats = getDebtStats(debt);

        const nextPayment = stats.schedule.find(item => !item.paid);

        const nextDue = nextPayment
            ? formatDate(nextPayment.dueDate)
            : "Completed";

        const statusClass = stats.completed
            ? "status-paid"
            : stats.hasOverdue
                ? "status-overdue"
                : "status-upcoming";

        const statusLabel = stats.completed
            ? "COMPLETED"
            : stats.hasOverdue
                ? "OVERDUE"
                : "ACTIVE";

        const progressWidth = Math.max(0, Math.min(100, stats.progress));

        const type = normalizeDebtType(debt.debt_type);

        return `
            <article class="debt-card">
                <div class="debt-card-top">
                    <div>
                        <h3>${escapeHTML(debt.name)}</h3>
                        <span class="debt-person">${escapeHTML(debt.person)}</span>
                    </div>

                    <span class="status-pill ${statusClass}">
                        ${statusLabel}
                    </span>
                </div>

                <div class="debt-type-badge">
                    ${escapeHTML(debtTypeLabel(type))}
                </div>

                <div class="debt-amount">${money(debt.amount)}</div>
                <div class="debt-amount-label">Monthly instalment</div>

                <div class="debt-details">
                    <div>
                        <span>Outstanding</span>
                        <strong>${money(stats.outstanding)}</strong>
                    </div>

                    <div>
                        <span>Next due date</span>
                        <strong>${escapeHTML(nextDue)}</strong>
                    </div>

                    <div>
                        <span>Paid instalments</span>
                        <strong>${stats.paidCount} / ${stats.totalCount}</strong>
                    </div>

                    <div>
                        <span>Remaining instalments</span>
                        <strong>${stats.unpaidCount}</strong>
                    </div>
                </div>

                <div class="debt-progress">
                    <div class="debt-progress-fill" style="width:${progressWidth}%"></div>
                </div>

                <div class="debt-progress-label">
                    <span>Payment progress</span>
                    <strong>${progressWidth}%</strong>
                </div>

                ${debt.note ? `
                    <div class="debt-note">${escapeHTML(debt.note)}</div>
                ` : ""}

                <div class="debt-actions">
                    ${nextPayment ? `
                        <button
                            type="button"
                            class="pay-button"
                            data-action="pay"
                            data-debt-id="${escapeHTML(debt.id)}"
                            data-due-date="${nextPayment.dueDate}"
                        >
                            Mark Next Paid
                        </button>
                    ` : ""}

                    ${stats.paidCount > 0 ? `
                        <button
                            type="button"
                            class="undo-button"
                            data-action="undo-latest"
                            data-debt-id="${escapeHTML(debt.id)}"
                        >
                            Undo Latest Paid
                        </button>
                    ` : ""}

                    <button
                        type="button"
                        class="delete-button"
                        data-action="delete"
                        data-debt-id="${escapeHTML(debt.id)}"
                    >
                        Delete
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

/* ADD DEBT MODAL */

function openModal() {
    $("debtModal").hidden = false;
    $("formMessage").textContent = "";
    $("debtName").focus();
}

function closeModal() {
    $("debtModal").hidden = true;
}

function updateEstimatedTotal() {
    const amount = Number($("amount").value) || 0;
    const months = Number($("months").value) || 0;

    $("estimatedTotal").textContent = money(amount * months);
}

async function addDebt(event) {
    event.preventDefault();

    if (isSaving) return;

    const person = $("person").value;
    const name = $("debtName").value.trim();
    const debtType = normalizeDebtType($("debtType").value);
    const amount = Number($("amount").value);
    const months = Number($("months").value);
    const firstDueDate = $("firstDueDate").value;
    const note = $("note").value.trim();

    if (!name || !person || !firstDueDate) {
        $("formMessage").textContent = "Please complete all required fields.";
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        $("formMessage").textContent = "Enter a valid monthly instalment.";
        return;
    }

    if (!Number.isInteger(months) || months < 1 || months > 600) {
        $("formMessage").textContent = "Enter a valid number of months.";
        return;
    }

    isSaving = true;
    $("saveDebtButton").disabled = true;
    $("saveDebtButton").textContent = "Saving...";

    try {
        const { error } = await supabaseClient
            .from("debts")
            .insert({
                person,
                name,
                debt_type: debtType,
                amount,
                months,
                first_due_date: firstDueDate,
                note: note || null
            });

        if (error) throw error;

        $("debtForm").reset();
        $("person").value = "Baby";
        $("debtType").value = "tiktokloan";
        $("estimatedTotal").textContent = money(0);

        closeModal();

        await loadData();

        showToast("New debt added successfully ♡");
    } catch (error) {
        console.error("Unable to save debt:", error);
        $("formMessage").textContent = error.message || "Unable to save debt.";
    } finally {
        isSaving = false;
        $("saveDebtButton").disabled = false;
        $("saveDebtButton").textContent = "Save Debt ♡";
    }
}

/* DELETE DEBT */

async function deleteDebt(debtId) {
    const debt = debts.find(item => String(item.id) === String(debtId));

    if (!debt) return;

    const confirmed = window.confirm(
        `Delete "${debt.name}" and its payment records?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
        const { error: paymentError } = await supabaseClient
            .from("debt_payments")
            .delete()
            .eq("debt_id", debtId);

        if (paymentError) throw paymentError;

        const { error: debtError } = await supabaseClient
            .from("debts")
            .delete()
            .eq("id", debtId);

        if (debtError) throw debtError;

        debts = debts.filter(item => String(item.id) !== String(debtId));
        payments = payments.filter(
            item => String(item.debt_id) !== String(debtId)
        );

        renderEverything();
        showToast("Debt deleted.");
    } catch (error) {
        console.error("Delete failed:", error);
        showToast(error.message || "Unable to delete debt.");
    }
}

/* UNDO LATEST PAYMENT */

async function undoLatestPayment(debtId) {
    const debt = debts.find(item => String(item.id) === String(debtId));

    if (!debt) return;

    const paidItems = getDebtSchedule(debt)
        .filter(item => item.paid)
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

    if (!paidItems.length) {
        showToast("No paid instalments to undo.");
        return;
    }

    await setPaymentStatus(debtId, paidItems[0].dueDate, false);
}

/* EVENT LISTENERS */

function setupEventListeners() {
    $("addDebtButton").addEventListener("click", openModal);
    $("closeModal").addEventListener("click", closeModal);

    $("debtModal").addEventListener("click", event => {
        if (event.target === $("debtModal")) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("debtModal").hidden) {
            closeModal();
        }
    });

    $("debtForm").addEventListener("submit", addDebt);

    $("amount").addEventListener("input", updateEstimatedTotal);
    $("months").addEventListener("input", updateEstimatedTotal);

    $("prevMonth").addEventListener("click", () => changeCalendarMonth(-1));
    $("nextMonth").addEventListener("click", () => changeCalendarMonth(1));

    $("refreshButton").addEventListener("click", loadData);

    $("calendarGrid").addEventListener("click", event => {
        const button = event.target.closest("[data-date]");
        if (!button) return;

        selectedDate = button.dataset.date;

        const date = parseDateKey(selectedDate);

        calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        renderCalendar();
        renderSelectedDatePayments();
    });

    $("selectedDatePayments").addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        const debtId = button.dataset.debtId;
        const dueDate = button.dataset.dueDate;

        if (action === "pay") {
            await setPaymentStatus(debtId, dueDate, true);
        } else if (action === "undo") {
            await setPaymentStatus(debtId, dueDate, false);
        }
    });

    $("debtList").addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        const debtId = button.dataset.debtId;
        const dueDate = button.dataset.dueDate;

        if (action === "pay") {
            await setPaymentStatus(debtId, dueDate, true);
        } else if (action === "undo-latest") {
            await undoLatestPayment(debtId);
        } else if (action === "delete") {
            await deleteDebt(debtId);
        }
    });

    $("debtSearch").addEventListener("input", renderDebtList);
    $("personFilter").addEventListener("change", renderDebtList);
    $("statusFilter").addEventListener("change", renderDebtList);
    $("debtTypeFilter").addEventListener("change", renderDebtList);
}

/* INITIALIZE */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();

    $("firstDueDate").value = toDateKey(new Date());

    updateEstimatedTotal();

    renderCalendar();

    loadData();
});
