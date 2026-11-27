"use strict";
/* Perhutangan enhancements: loaded after app.js, before DOMContentLoaded. */
let editingDebtId = null;
let activityHistory = [];
const originalRenderEverything = renderEverything;
const originalLoadData = loadData;
const originalAddDebt = addDebt;
const originalSetPaymentStatus = setPaymentStatus;
const originalDeleteDebt = deleteDebt;

function canonicalPerson(value) {
    return normalizePerson(value).toLowerCase();
}
function canonicalType(value) {
    return normalizeType(value);
}
function syncTypeOptions() {
    const select = $("debtTypeFilter");
    const current = select.value;
    const types = new Map(Object.entries(DEBT_TYPES));
    debts.forEach(debt => {
        const key = canonicalType(debt.debt_type);
        if (!types.has(key)) types.set(key, typeLabel(debt.debt_type));
    });
    select.innerHTML = '<option value="all">All debt types</option>';
    types.forEach((label, key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
    });
    select.value = [...select.options].some(option => option.value === current) ? current : "all";
}
function enhancedGetFilteredDebts() {
    const query = $("debtSearch").value.trim().toLowerCase();
    const person = $("personFilter").value;
    const status = $("statusFilter").value;
    const type = $("debtTypeFilter").value;
    return debts.filter(debt => {
        const stats = getDebtStats(debt);
        const text = [debt.name, debt.note, personLabel(debt.person), typeLabel(debt.debt_type)]
            .join(" ").toLowerCase();
        if (query && !text.includes(query)) return false;
        if (person !== "all" && canonicalPerson(debt.person) !== canonicalPerson(person)) return false;
        if (type !== "all" && canonicalType(debt.debt_type) !== canonicalType(type)) return false;
        if (status === "paid" && !stats.completed) return false;
        if (status === "unpaid" && stats.unpaidCount === 0) return false;
        if (status === "overdue" && !stats.hasOverdue) return false;
        return true;
    });
}
function enhancedRenderEverything() {
    syncTypeOptions();
    originalRenderEverything();
    addEditButtons();
    renderActivityHistory();
}
function addEditButtons() {
    const cards = $("debtList").querySelectorAll(".debt-card");
    const visible = getFilteredDebts();
    cards.forEach((card, index) => {
        const debt = visible[index];
        const actions = card.querySelector(".debt-actions");
        if (!debt || !actions || actions.querySelector('[data-action="edit"]')) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "undo-button";
        button.dataset.action = "edit";
        button.dataset.debtId = debt.id;
        button.textContent = "✎ Edit Debt";
        actions.insertBefore(button, actions.lastElementChild);
    });
}
function resetDebtModal() {
    editingDebtId = null;
    $("debtForm").reset();
    $("person").value = "Baby";
    $("debtType").value = "tiktokloan";
    $("firstDueDate").value = dateKey(new Date());
    $("modalTitle").textContent = "Add a new debt ♡";
    $("saveDebtButton").textContent = "Save Debt ♡";
    $("formMessage").textContent = "";
    updateEstimatedTotal();
}
function openEditDebt(debtId) {
    const debt = debts.find(item => String(item.id) === String(debtId));
    if (!debt) return;
    editingDebtId = debt.id;
    $("person").value = normalizePerson(debt.person);
    $("debtName").value = debt.name || "";
    const type = normalizeType(debt.debt_type);
    if (![...$("debtType").options].some(option => option.value === type)) {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = typeLabel(type);
        $("debtType").appendChild(option);
    }
    $("debtType").value = type;
    $("amount").value = debt.amount;
    $("months").value = debt.months;
    $("firstDueDate").value = String(debt.first_due_date).slice(0, 10);
    $("note").value = debt.note || "";
    $("modalTitle").textContent = "Edit debt ♡";
    $("saveDebtButton").textContent = "Save Changes ♡";
    $("formMessage").textContent = "";
    updateEstimatedTotal();
    $("debtModal").hidden = false;
    $("debtName").focus();
}
async function enhancedAddDebt(event) {
    event.preventDefault();
    if (!financeReady || !await requireFinanceSession()) return;
    if (!editingDebtId) return originalAddDebt(event);
    event.preventDefault();
    if (savingDebt) return;
    const debt = debts.find(item => String(item.id) === String(editingDebtId));
    if (!debt) return;
    const changes = {
        person: $("person").value,
        name: $("debtName").value.trim(),
        debt_type: normalizeType($("debtType").value),
        amount: Number($("amount").value),
        months: Number($("months").value),
        first_due_date: $("firstDueDate").value,
        note: $("note").value.trim()
    };
    if (!changes.name || !changes.person || !changes.first_due_date ||
        !Number.isFinite(changes.amount) || changes.amount <= 0 ||
        !Number.isInteger(changes.months) || changes.months < 1 || changes.months > 600) {
        $("formMessage").textContent = "Please enter valid debt details.";
        return;
    }
    if (changes.name.length > 80 || changes.note.length > 160) {
        $("formMessage").textContent = "Name must be at most 80 characters and note at most 160.";
        return;
    }
    const oldDates = new Set(getDebtSchedule(debt).map(item => item.dueDate));
    const newDates = new Set(getDebtSchedule({...debt, ...changes}).map(item => item.dueDate));
    const removedPaidDates = payments.filter(item => String(item.debt_id) === String(debt.id) &&
        item.paid && oldDates.has(String(item.due_date).slice(0,10)) && !newDates.has(String(item.due_date).slice(0,10)));
    if (removedPaidDates.length && !confirm(`This edit removes ${removedPaidDates.length} paid instalment date(s) from the schedule. The old payment records will remain in the database but will no longer count toward this debt. Continue?`)) return;
    savingDebt = true;
    $("saveDebtButton").disabled = true;
    $("saveDebtButton").textContent = "Saving...";
    try {
        const {error} = await supabaseClient.from("debts").update(changes).eq("id", debt.id);
        if (error) throw error;
        closeModal();
        resetDebtModal();
        await loadData();
        showToast("Debt updated successfully ♡");
    } catch (error) {
        $("formMessage").textContent = error.message || "Unable to edit debt.";
    } finally {
        savingDebt = false;
        $("saveDebtButton").disabled = false;
        $("saveDebtButton").textContent = editingDebtId ? "Save Changes ♡" : "Save Debt ♡";
    }
}
async function loadActivityHistory() {
    if (!financeReady || !await requireFinanceSession()) return;
    const {data, error} = await supabaseClient.from("debt_history")
        .select("*").order("created_at", {ascending:false}).limit(200);
    if (error) {
        console.error("History loading failed:", error);
        $("historyList").textContent = "Unable to load history. Run the database upgrade SQL first. " + error.message;
        return;
    }
    if (!await requireFinanceSession()) return;
    activityHistory = data || [];
    renderActivityHistory();
}
function renderActivityHistory() {
    const target = $("historyList");
    if (!target) return;
    const filter = $("historyFilter").value;
    const records = activityHistory.filter(item => filter === "all" || item.action === filter);
    target.replaceChildren();
    if (!records.length) {
        target.textContent = "No matching activity yet.";
        return;
    }
    records.forEach(item => {
        const article = document.createElement("article");
        article.className = "history-item";
        const heading = document.createElement("strong");
        heading.textContent = ({add:"➕ Added",edit:"✎ Edited",delete:"🗑 Deleted",pay:"✓ Paid",undo:"↶ Payment undone"})[item.action] || item.action;
        const detail = document.createElement("p");
        detail.textContent = `${item.debt_name || "Unknown debt"} — ${item.description || ""}`;
        const time = document.createElement("small");
        time.textContent = new Date(item.created_at).toLocaleString("en-MY");
        article.append(heading, detail, time);
        target.appendChild(article);
    });
}
function installEnhancements() {
    const addButton = $("addDebtButton");
    addButton.addEventListener("click", resetDebtModal);
    $("closeModal").addEventListener("click", resetDebtModal);
    $("debtModal").addEventListener("click", event => {
        if (event.target === $("debtModal")) resetDebtModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("debtModal").hidden) resetDebtModal();
    });
    $("debtList").addEventListener("click", event => {
        const button = event.target.closest('[data-action="edit"]');
        if (button) openEditDebt(button.dataset.debtId);
    });
    $("historyFilter").addEventListener("change", renderActivityHistory);
    $("debtSearch").addEventListener("input", addEditButtons);
    ["personFilter","statusFilter","debtTypeFilter"].forEach(id =>
        $(id).addEventListener("change", addEditButtons));

    // loadData() also refreshes history.
}
getFilteredDebts = enhancedGetFilteredDebts;
renderEverything = enhancedRenderEverything;
addDebt = enhancedAddDebt;
const baseRenderDebtList = renderDebtList;
renderDebtList = function() { baseRenderDebtList(); addEditButtons(); };
setPaymentStatus = async function(debtId, dueDate, paid) {
    await originalSetPaymentStatus(debtId, dueDate, paid);
    await loadActivityHistory();
};
deleteDebt = async function(debtId) {
    await originalDeleteDebt(debtId);
    await loadActivityHistory();
};
const baseLoadData = loadData;
loadData = async function() { const ok = await baseLoadData(); if (ok) await loadActivityHistory(); return ok; };
document.addEventListener("DOMContentLoaded", installEnhancements);
