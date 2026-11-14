
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

const DEBT_TYPES = {
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

/* APPLICATION STATE */

let debts = [];
let payments = [];

let calendarMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

let selectedDate = dateKey(new Date());
let savingDebt = false;
let toastTimer = null;

/* BASIC HELPERS */

function $(id) {
    return document.getElementById(id);
}

function amount(value) {
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

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(value) {
    if (!value) return null;

    const parts = String(value).slice(0, 10).split("-").map(Number);

    if (parts.length !== 3 || parts.some(number => !Number.isFinite(number))) {
        return null;
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    if (Number.isNaN(date.getTime())) return null;

    return date;
}

function formatDate(value) {
    const date = value instanceof Date ? value : parseDate(value);

    if (!date) return "Not set";

    return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthsClamped(date, count) {
    const day = date.getDate();

    const result = new Date(
        date.getFullYear(),
        date.getMonth() + count,
        1
    );

    const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
    ).getDate();

    result.setDate(Math.min(day, lastDay));

    return result;
}

function isOverdue(dueDate) {
    return dueDate < dateKey(new Date());
}

function normalizeType(value) {
    const cleaned = String(value || "other")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    const aliases = {
        tiktokloan: "tiktokloan",
        tiktokpaylater: "tiktokpaylater",
        sloan: "sloan",
        spaylater: "spaylater",
        atomeloan: "atomeloan",
        atomecard: "atomecard",
        atomepaylater: "atomepaylater",
        boostloan: "boostloan",
        other: "other"
    };

    return aliases[cleaned] || cleaned || "other";
}

function typeLabel(value) {
    const type = normalizeType(value);

    return DEBT_TYPES[type] ||
        type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function normalizePerson(value) {
    const person = String(value || "").trim().toLowerCase();

    if (person === "baby" || person === "eisya") return "Baby";
    if (person === "sayang" || person === "capiq") return "Sayang";
    if (person === "everyone" || person === "shared" || person === "both") {
        return "Everyone";
    }

    return value || "Everyone";
}

function personLabel(value) {
    const person = normalizePerson(value);

    if (person === "Baby") return "Eisya";
    if (person === "Sayang") return "Capiq";
    if (person === "Everyone") return "Shared (Both)";

    return String(person);
}

function showToast(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function setConnectionStatus(message, state = "loading") {
    $("connectionStatus").textContent = message;

    const dot = $("statusDot");
    dot.className = "status-dot";

    if (state === "connected") {
        dot.classList.add("connected");
    } else if (state === "error") {
        dot.classList.add("error");
    }
}

/* PAYMENT SCHEDULE */

function getDebtSchedule(debt) {
    const monthlyAmount = Number(debt.amount) || 0;
    const months = Math.max(0, Number(debt.months) || 0);
    const firstDueDate = parseDate(debt.first_due_date);

    if (!firstDueDate || months <= 0 || monthlyAmount <= 0) {
        return [];
    }

    const schedule = [];

    for (let index = 0; index < months; index++) {
        const dueDate = dateKey(addMonthsClamped(firstDueDate, index));

        const payment = payments.find(item =>
            String(item.debt_id) === String(debt.id) &&
            String(item.due_date).slice(0, 10) === dueDate
        );

        schedule.push({
            debtId: debt.id,
            debtName: debt.name,
            person: normalizePerson(debt.person),
            debtType: normalizeType(debt.debt_type),
            amount: monthlyAmount,
            dueDate,
            paid: payment ? Boolean(payment.paid) : false
        });
    }

    return schedule;
}

function getAllSchedule() {
    return debts.flatMap(debt => getDebtSchedule(debt));
}

function getDebtStats(debt) {
    const schedule = getDebtSchedule(debt);

    const paidItems = schedule.filter(item => item.paid);
    const unpaidItems = schedule.filter(item => !item.paid);
    const overdueItems = unpaidItems.filter(item => isOverdue(item.dueDate));

    const paidAmount = paidItems.reduce((sum, item) => sum + item.amount, 0);
    const outstanding = unpaidItems.reduce((sum, item) => sum + item.amount, 0);

    return {
        schedule,
        paidCount: paidItems.length,
        unpaidCount: unpaidItems.length,
        overdueCount: overdueItems.length,
        paidAmount,
        outstanding,
        completed: schedule.length > 0 && unpaidItems.length === 0,
        hasOverdue: overdueItems.length > 0,
        totalCount: schedule.length,
        progress: schedule.length
            ? Math.round((paidItems.length / schedule.length) * 100)
            : 0
    };
}

/* LOAD DATA */

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
        console.error("Supabase loading error:", error);

        setConnectionStatus("Connection error", "error");

        $("debtList").innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">!</span>
                <p>Unable to load your debts.</p>
                <p>${escapeHTML(error.message || "Please check your Supabase settings.")}</p>
            </div>
        `;

        showToast("Unable to connect to your debt database.");
    }
}

/* RENDER ALL SECTIONS */

function renderEverything() {
    renderDashboard();
    renderCalendar();
    renderSelectedDatePayments();
    renderMonthlyBreakdown();
    renderDebtList();
}

/* SELECTED MONTH DATA
   IMPORTANT:
   All monthly dashboard calculations use calendarMonth.
   Changing the calendar month refreshes these figures.
*/

function getSelectedMonthSchedule() {
    const selectedMonth = monthKey(calendarMonth);

    return getAllSchedule().filter(item =>
        item.dueDate.slice(0, 7) === selectedMonth
    );
}

/* DASHBOARD */

function renderDashboard() {
    const allSchedule = getAllSchedule();
    const selectedMonthSchedule = getSelectedMonthSchedule();

    const monthUnpaid = selectedMonthSchedule.filter(item => !item.paid);
    const allUnpaid = allSchedule.filter(item => !item.paid);
    const allPaid = allSchedule.filter(item => item.paid);

    const overdueItems = allUnpaid.filter(item => isOverdue(item.dueDate));

    const outstandingThisMonth = monthUnpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const dueThisMonth = selectedMonthSchedule.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const overallOutstanding = allUnpaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const totalPaid = allPaid.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const overdueTotal = overdueItems.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const activeThisMonth = new Set(
        monthUnpaid.map(item => String(item.debtId))
    );

    const activeOverall = new Set(
        allUnpaid.map(item => String(item.debtId))
    );

    $("totalOutstandingMonth").textContent = amount(outstandingThisMonth);
    $("activeDebtMonth").textContent = activeThisMonth.size;

    $("totalOverallOutstanding").textContent = amount(overallOutstanding);
    $("totalOverallActiveDebt").textContent = activeOverall.size;

    $("totalPaid").textContent = amount(totalPaid);
    $("dueThisMonth").textContent = amount(dueThisMonth);
    $("overdueTotal").textContent = amount(overdueTotal);
}

/* CALENDAR */

function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    $("calendarTitle").textContent = calendarMonth.toLocaleDateString(
        "en-MY",
        { month: "long", year: "numeric" }
    );

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();

    const allSchedule = getAllSchedule();

    let html = "";

    for (let cell = 0; cell < 42; cell++) {
        let currentDate;
        let outsideMonth = false;

        if (cell < firstWeekday) {
            currentDate = new Date(
                year,
                month - 1,
                previousMonthDays - firstWeekday + cell + 1
            );
            outsideMonth = true;
        } else if (cell >= firstWeekday + daysInMonth) {
            currentDate = new Date(
                year,
                month + 1,
                cell - firstWeekday - daysInMonth + 1
            );
            outsideMonth = true;
        } else {
            currentDate = new Date(year, month, cell - firstWeekday + 1);
        }

        const key = dateKey(currentDate);

        const dayItems = allSchedule.filter(item => item.dueDate === key);
        const hasPaid = dayItems.some(item => item.paid);
        const hasOverdue = dayItems.some(
            item => !item.paid && isOverdue(item.dueDate)
        );
        const hasUnpaid = dayItems.some(item => !item.paid);

        const today = key === dateKey(new Date());
        const selected = key === selectedDate;

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
                    ${outsideMonth ? "outside-month" : ""}
                    ${today ? "today" : ""}
                    ${selected ? "selected" : ""}"
                data-date="${key}"
                aria-label="${escapeHTML(formatDate(key))}"
            >
                <span class="calendar-day-number">${currentDate.getDate()}</span>
                <span class="day-markers">${markers}</span>
            </button>
        `;
    }

    $("calendarGrid").innerHTML = html;
}

function changeCalendarMonth(direction) {
    calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + direction,
        1
    );

    /* Select the first day of the newly displayed month. */
    selectedDate = dateKey(calendarMonth);

    /* Refresh every month-dependent section. */
    renderEverything();
}

/* PAYMENT DETAILS */

function renderSelectedDatePayments() {
    const items = getAllSchedule().filter(item =>
        item.dueDate === selectedDate
    );

    $("selectedDateTitle").textContent = formatDate(selectedDate);

    const unpaidTotal = items
        .filter(item => !item.paid)
        .reduce((sum, item) => sum + item.amount, 0);

    $("selectedDateTotal").textContent = amount(unpaidTotal);

    if (!items.length) {
        $("selectedDatePayments").innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">♡</span>
                <p>No scheduled payments for this date.</p>
                <p>Choose another date on the calendar.</p>
            </div>
        `;
        return;
    }

    const sortedItems = [...items].sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        return a.debtName.localeCompare(b.debtName);
    });

    $("selectedDatePayments").innerHTML = sortedItems.map(item => {
        const overdue = !item.paid && isOverdue(item.dueDate);

        const statusClass = item.paid
            ? "status-paid"
            : overdue
                ? "status-overdue"
                : "status-upcoming";

        const statusLabel = item.paid
            ? "✓ PAID"
            : overdue
                ? "! OVERDUE"
                : "● UNPAID";

        const button = item.paid
            ? `
                <button
                    type="button"
                    class="payment-action undo-paid-button"
                    data-action="undo"
                    data-debt-id="${escapeHTML(item.debtId)}"
                    data-due-date="${item.dueDate}"
                >
                    ↶ Undo payment
                </button>
            `
            : `
                <button
                    type="button"
                    class="payment-action mark-paid-button"
                    data-action="pay"
                    data-debt-id="${escapeHTML(item.debtId)}"
                    data-due-date="${item.dueDate}"
                >
                    ✓ Mark as paid
                </button>
            `;

        return `
            <article class="payment-item">
                <div class="payment-info">
                    <strong>${escapeHTML(item.debtName)}</strong>
                    <small>${escapeHTML(personLabel(item.person))} · ${escapeHTML(typeLabel(item.debtType))}</small>
                    <div style="margin-top:8px">
                        <span class="status-pill ${statusClass}">${statusLabel}</span>
                    </div>
                </div>

                <div class="payment-right">
                    <strong>${amount(item.amount)}</strong>
                    <div style="margin-top:9px">${button}</div>
                </div>
            </article>
        `;
    }).join("");
}

/* UPDATE PAYMENT STATUS */

async function setPaymentStatus(debtId, dueDate, paid) {
    const existing = payments.find(item =>
        String(item.debt_id) === String(debtId) &&
        String(item.due_date).slice(0, 10) === dueDate
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

            payments = payments.map(item =>
                String(item.id) === String(existing.id) ? data : item
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

        showToast(
            paid
                ? "Payment successfully marked as paid ♡"
                : "Payment changed back to unpaid."
        );
    } catch (error) {
        console.error("Payment update failed:", error);
        showToast(error.message || "Unable to update payment.");
    }
}

/* MONTHLY BREAKDOWN */

function renderMonthlyBreakdown() {
    const selectedMonth = calendarMonth.toLocaleDateString(
        "en-MY",
        { month: "long", year: "numeric" }
    );

    $("monthlyBreakdownTitle").textContent = `${selectedMonth} summary`;
    $("monthlyBreakdownLabel").textContent =
        `A breakdown of commitments for ${selectedMonth}.`;

    const items = getSelectedMonthSchedule();

    const paidItems = items.filter(item => item.paid);
    const unpaidItems = items.filter(item => !item.paid);

    const totalScheduled = items.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const totalPaid = paidItems.reduce(
        (sum, item) => sum + item.amount, 0
    );

    const totalRemaining = unpaidItems.reduce(
        (sum, item) => sum + item.amount, 0
    );

    $("monthDueTotal").textContent = amount(totalScheduled);
    $("monthPaidTotal").textContent = amount(totalPaid);
    $("monthRemainingTotal").textContent = amount(totalRemaining);
    $("monthUnpaidCount").textContent = unpaidItems.length;

    const people = [
        { key: "Baby", label: "Eisya" },
        { key: "Sayang", label: "Capiq" },
        { key: "Everyone", label: "Shared (Both)" }
    ];

    $("monthBreakdown").innerHTML = people.map(person => {
        const personItems = items.filter(item =>
            normalizePerson(item.person) === person.key
        );

        const personPaid = personItems
            .filter(item => item.paid)
            .reduce((sum, item) => sum + item.amount, 0);

        const personUnpaid = personItems
            .filter(item => !item.paid)
            .reduce((sum, item) => sum + item.amount, 0);

        const personScheduled = personItems.reduce(
            (sum, item) => sum + item.amount, 0
        );

        const personUnpaidCount = personItems.filter(
            item => !item.paid
        ).length;

        return `
            <article class="person-card">
                <div class="person-heading">
                    <span class="person-avatar">♡</span>
                    <strong>${person.label}</strong>
                </div>

                <div class="person-numbers">
                    <div>
                        <small>Scheduled</small>
                        <strong>${amount(personScheduled)}</strong>
                    </div>
                    <div>
                        <small>Paid</small>
                        <strong>${amount(personPaid)}</strong>
                    </div>
                    <div>
                        <small>Remaining</small>
                        <strong>${amount(personUnpaid)}</strong>
                    </div>
                    <div>
                        <small>Unpaid instalments</small>
                        <strong>${personUnpaidCount}</strong>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* ALL DEBTS FILTER */

function getFilteredDebts() {
    const search = $("debtSearch").value.trim().toLowerCase();
    const selectedPerson = $("personFilter").value;
    const selectedStatus = $("statusFilter").value;
    const selectedType = $("debtTypeFilter").value;

    return debts.filter(debt => {
        const stats = getDebtStats(debt);

        const debtName = String(debt.name || "").toLowerCase();
        const note = String(debt.note || "").toLowerCase();

        const matchesSearch =
            !search ||
            debtName.includes(search) ||
            note.includes(search);

        const matchesPerson =
            selectedPerson === "all" ||
            normalizePerson(debt.person) === selectedPerson;

        const matchesType =
            selectedType === "all" ||
            normalizeType(debt.debt_type) === normalizeType(selectedType);

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
            matchesType &&
            matchesStatus
        );
    });
}

function renderDebtList() {
    const filtered = getFilteredDebts();

    $("debtCount").textContent = filtered.length;

    const hasFilters =
        $("debtSearch").value.trim() !== "" ||
        $("personFilter").value !== "all" ||
        $("statusFilter").value !== "all" ||
        $("debtTypeFilter").value !== "all";

    $("filterMessage").textContent = hasFilters
        ? `Showing ${filtered.length} matching debt account(s).`
        : "";

    if (!filtered.length) {
        $("debtList").innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">♡</span>
                <p>No matching debts found.</p>
                <p>Try changing your filters.</p>
            </div>
        `;
        return;
    }

    $("debtList").innerHTML = filtered.map(debt => {
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

        return `
            <article class="debt-card">
                <div class="debt-card-top">
                    <div>
                        <h3>${escapeHTML(debt.name)}</h3>
                        <span class="debt-person">${escapeHTML(personLabel(debt.person))}</span>
                    </div>
                    <span class="status-pill ${statusClass}">${statusLabel}</span>
                </div>

                <span class="debt-type-badge">${escapeHTML(typeLabel(debt.debt_type))}</span>

                <div class="debt-amount">${amount(debt.amount)}</div>
                <div class="debt-amount-label">Monthly instalment</div>

                <div class="debt-details">
                    <div>
                        <span>Outstanding</span>
                        <strong>${amount(stats.outstanding)}</strong>
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
                    <div class="debt-progress-fill" style="width:${stats.progress}%"></div>
                </div>

                <div class="debt-progress-label">
                    <span>Payment progress</span>
                    <strong>${stats.progress}%</strong>
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
    const monthlyAmount = Number($("amount").value) || 0;
    const months = Number($("months").value) || 0;

    $("estimatedTotal").textContent = amount(monthlyAmount * months);
}

async function addDebt(event) {
    event.preventDefault();

    if (savingDebt) return;

    const person = $("person").value;
    const name = $("debtName").value.trim();
    const debtType = normalizeType($("debtType").value);
    const monthlyAmount = Number($("amount").value);
    const months = Number($("months").value);
    const firstDueDate = $("firstDueDate").value;
    const note = $("note").value.trim();

    if (!name || !person || !firstDueDate) {
        $("formMessage").textContent = "Please complete all required fields.";
        return;
    }

    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
        $("formMessage").textContent = "Enter a valid monthly instalment.";
        return;
    }

    if (!Number.isInteger(months) || months < 1 || months > 600) {
        $("formMessage").textContent = "Enter a valid number of months.";
        return;
    }

    savingDebt = true;
    $("saveDebtButton").disabled = true;
    $("saveDebtButton").textContent = "Saving...";

    try {
        const { error } = await supabaseClient
            .from("debts")
            .insert({
                person,
                name,
                debt_type: debtType,
                amount: monthlyAmount,
                months,
                first_due_date: firstDueDate,
                note: note || null
            });

        if (error) throw error;

        $("debtForm").reset();
        $("person").value = "Baby";
        $("debtType").value = "tiktokloan";
        $("estimatedTotal").textContent = amount(0);

        closeModal();

        await loadData();

        showToast("New debt added successfully ♡");
    } catch (error) {
        console.error("Unable to save debt:", error);
        $("formMessage").textContent =
            error.message || "Unable to save debt. Please try again.";
    } finally {
        savingDebt = false;
        $("saveDebtButton").disabled = false;
        $("saveDebtButton").textContent = "Save Debt ♡";
    }
}

/* DELETE DEBT */

async function deleteDebt(debtId) {
    const debt = debts.find(item =>
        String(item.id) === String(debtId)
    );

    if (!debt) return;

    const confirmed = window.confirm(
        `Delete "${debt.name}" and all its payment records?\n\nThis cannot be undone.`
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

        debts = debts.filter(item =>
            String(item.id) !== String(debtId)
        );

        payments = payments.filter(item =>
            String(item.debt_id) !== String(debtId)
        );

        renderEverything();
        showToast("Debt deleted successfully.");
    } catch (error) {
        console.error("Delete failed:", error);
        showToast(error.message || "Unable to delete debt.");
    }
}

/* UNDO LATEST PAYMENT */

async function undoLatestPayment(debtId) {
    const debt = debts.find(item =>
        String(item.id) === String(debtId)
    );

    if (!debt) return;

    const paidItems = getDebtSchedule(debt)
        .filter(item => item.paid)
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

    if (!paidItems.length) {
        showToast("There are no paid instalments to undo.");
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

    $("prevMonth").addEventListener("click", () => {
        changeCalendarMonth(-1);
    });

    $("nextMonth").addEventListener("click", () => {
        changeCalendarMonth(1);
    });

    $("refreshButton").addEventListener("click", loadData);

    $("calendarGrid").addEventListener("click", event => {
        const dayButton = event.target.closest("[data-date]");

        if (!dayButton) return;

        selectedDate = dayButton.dataset.date;

        const selected = parseDate(selectedDate);

        calendarMonth = new Date(
            selected.getFullYear(),
            selected.getMonth(),
            1
        );

        renderEverything();
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

    $("firstDueDate").value = dateKey(new Date());

    updateEstimatedTotal();

    renderEverything();
    loadData();
});
