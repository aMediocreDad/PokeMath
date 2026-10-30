// Served without a login (worker/login.js), so a school can read it before anyone is invited. It is
// bare, so the player side never starts for a visitor, and it ships no JavaScript, so its links are
// plain page loads that go through the Worker's login check.
export const load = () => ({ bare: true });
export const csr = false;
