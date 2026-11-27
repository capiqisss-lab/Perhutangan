"use strict";
let activeFinanceUser = null;
function markFinanceUnavailable() {
    for (const id of ['totalOutstandingMonth','activeDebtMonth','totalOverallOutstanding','totalOverallActiveDebt','totalPaid','dueThisMonth','overdueTotal','selectedDateTotal','monthDueTotal','monthPaidTotal','monthRemainingTotal','monthUnpaidCount','debtCount']) {
        if ($(id)) $(id).textContent = '—';
    }
}
function lockFinance(message) {
    activeFinanceUser = null;
    financeReady = false;
    debts = []; payments = []; activityHistory = [];
    document.querySelector('.app-shell').hidden = true;
    $('debtModal').hidden = true;
    $('debtForm').reset();
    for (const id of ['debtList','historyList','calendarGrid','selectedDatePayments','monthBreakdown']) $(id).replaceChildren();
    markFinanceUnavailable();
    $('authPanel').hidden = false;
    $('authMessage').textContent = message;
}
async function requireFinanceSession() {
    const {data,error} = await supabaseClient.auth.getSession();
    return !error && !!activeFinanceUser && data.session?.user.id === activeFinanceUser;
}
async function openFinance() {
    const {data,error} = await supabaseClient.auth.getUser();
    if (error || !data.user) { lockFinance('Please sign in to continue.'); return; }
    activeFinanceUser = data.user.id;
    $('authPanel').hidden = true;
    document.querySelector('.app-shell').hidden = false;
    markFinanceUnavailable();
    await loadData();
}
async function initializeFinanceAuth() {
    $('authForm').addEventListener('submit', async event => {
        event.preventDefault();
        $('authSubmit').disabled = true;
        $('authMessage').textContent = 'Signing in…';
        try {
            const {error} = await supabaseClient.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});
            $('authPassword').value = '';
            if (error) throw error;
            await openFinance();
        } catch (error) { $('authMessage').textContent = error.message || 'Sign in failed.'; }
        finally { $('authSubmit').disabled = false; }
    });
    $('logoutButton').addEventListener('click', async () => {
        lockFinance('Signing out…');
        const {error} = await supabaseClient.auth.signOut({scope:'local'});
        $('authMessage').textContent = error ? 'Sign out failed. Please retry by reloading.' : 'Signed out.';
    });
    supabaseClient.auth.onAuthStateChange((event,session) => {
        if (event === 'SIGNED_OUT' || (activeFinanceUser && session?.user.id !== activeFinanceUser)) lockFinance('Please sign in to continue.');
    });
    try { await openFinance(); } catch { lockFinance('Unable to check session. Please sign in.'); }
}
