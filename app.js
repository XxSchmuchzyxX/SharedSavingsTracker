const APP_CONFIG = window.APP_CONFIG || {};
const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const ENTRY_TYPES = {
  SAVE: "save",
  SPEND: "spend",
};

const state = {
  authMode: "signup",
  user: null,
  profile: null,
  myEntries: [],
  incomingRequests: [],
  friends: [],
  visibilityMap: new Map(),
  sharedProfiles: [],
  sharedEntries: [],
};

let authSync = Promise.resolve();

const configAlert = document.getElementById("configAlert");
const authCard = document.getElementById("authCard");
const appPanel = document.getElementById("appPanel");

const authTitle = document.getElementById("authTitle");
const authModeText = document.getElementById("authModeText");
const authForm = document.getElementById("authForm");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggleBtn = document.getElementById("authToggleBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordToggleBtn = document.getElementById("passwordToggle");
const confirmPasswordRow = document.getElementById("confirmPasswordRow");
const confirmPasswordInput = document.getElementById("confirmPassword");
const confirmPasswordToggleBtn = document.getElementById("confirmPasswordToggle");
const usernameRow = document.getElementById("usernameRow");
const usernameInput = document.getElementById("username");
const rememberRow = document.getElementById("rememberRow");
const rememberMeInput = document.getElementById("rememberMe");

const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");

const totalSavedEl = document.getElementById("totalSaved");
const totalSpentEl = document.getElementById("totalSpent");
const remainingBudgetEl = document.getElementById("remainingBudget");

const savingsForm = document.getElementById("savingsForm");
const spendingForm = document.getElementById("spendingForm");
const saveAmountInput = document.getElementById("saveAmount");
const saveNoteInput = document.getElementById("saveNote");
const spendAmountInput = document.getElementById("spendAmount");
const spendNoteInput = document.getElementById("spendNote");

const myHistory = document.getElementById("myHistory");
const myEmpty = document.getElementById("myEmpty");
const clearMineBtn = document.getElementById("clearMineBtn");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

const incomingRequestsEl = document.getElementById("incomingRequests");
const incomingEmpty = document.getElementById("incomingEmpty");

const friendsList = document.getElementById("friendsList");
const friendsEmpty = document.getElementById("friendsEmpty");

const friendsFeed = document.getElementById("friendsFeed");
const feedEmpty = document.getElementById("feedEmpty");

const entryTemplate = document.getElementById("entryTemplate");
const themeToggleBtn = document.getElementById("themeToggle");
const THEME_KEY = "money-theme";
const REMEMBER_ME_KEY = "remember-me";
const REMEMBER_EMAIL_KEY = "remember-email";
const toastContainer = document.getElementById("toastContainer");

const hasSupabaseConfig =
  typeof window.supabase !== "undefined" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

if (!hasSupabaseConfig) {
  configAlert.classList.remove("hidden");
  authSubmitBtn.disabled = true;
  authToggleBtn.disabled = true;
  console.warn("Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js or Vercel env vars.");
}

const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

init();

function init() {
  initTheme();
  restoreRememberedLogin();
  bindStaticEvents();
  renderAuthMode();

  if (!supabaseClient) {
    return;
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    queueAuthSync(async () => {
      await applySession(session);
    });
  });

  queueAuthSync(async () => {
    await bootstrapSession();
  });
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = storedTheme ? storedTheme === "dark" : prefersDark;

  document.documentElement.classList.toggle("dark", useDark);
  updateThemeButton(useDark);
}

function toggleTheme() {
  const willUseDark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", willUseDark);
  localStorage.setItem(THEME_KEY, willUseDark ? "dark" : "light");
  updateThemeButton(willUseDark);
}

function updateThemeButton(isDark) {
  if (!themeToggleBtn) return;
  themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
}
function bindStaticEvents() {
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  if (passwordToggleBtn) {
    passwordToggleBtn.addEventListener("click", () => togglePasswordVisibility(passwordInput, passwordToggleBtn));
  }

  if (confirmPasswordToggleBtn) {
    confirmPasswordToggleBtn.addEventListener("click", () => togglePasswordVisibility(confirmPasswordInput, confirmPasswordToggleBtn));
  }
  authToggleBtn.addEventListener("click", () => {
    state.authMode = state.authMode === "signup" ? "signin" : "signup";
    renderAuthMode();
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim().toLowerCase();

    if (state.authMode === "signup") {
      if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
        showToast("Username must be 3-32 chars using lowercase letters, numbers, or _.", "warning");
        return;
      }

      if (password !== confirmPasswordInput.value) {
        showToast("Passwords do not match.", "warning");
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) {
        showToast(error.message, "error");
        return;
      }

      if (!data.session) {
        showToast("Sign up successful. Check your email to confirm, then sign in.", "success");
        state.authMode = "signin";
        renderAuthMode();
      }

      authForm.reset();
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }
    persistRememberChoice(email, rememberMeInput?.checked === true);
    showToast("Welcome back!", "success");
    authForm.reset();
  });

  logoutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error && !isSupabaseLockAbort(error)) {
        showToast(error.message, "error");
      } else if (!error) {
        showToast("You have been logged out.", "info");
      }
    } catch (error) {
      if (!isSupabaseLockAbort(error)) {
        showToast(error.message || "Could not sign out. Please try again.", "error");
      }
    }
  });

  savingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addEntry(ENTRY_TYPES.SAVE, saveAmountInput, saveNoteInput);
  });

  spendingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addEntry(ENTRY_TYPES.SPEND, spendAmountInput, spendNoteInput);
  });

  clearMineBtn.addEventListener("click", async () => {
    if (!state.user || state.myEntries.length === 0) return;

    const ok = window.confirm("Delete all of your entries?");
    if (!ok) return;

    const { error } = await supabaseClient
      .from("entries")
      .delete()
      .eq("user_id", state.user.id);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    await loadMyEntries();
    renderMyEntries();
    await loadSharedFeed();
    renderFeed();
  });

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.user) return;

    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, username, full_name")
      .ilike("username", `%${query}%`)
      .neq("id", state.user.id)
      .limit(20);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    await renderSearchResults(data || []);
  });
}

async function bootstrapSession() {
  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) {
    if (!isSupabaseLockAbort(error)) {
      showToast(error.message, "error");
    }
    return;
  }

  await applySession(session);
}

async function applySession(session) {
  if (session?.user) {
    await onSignedIn(session.user);
    return;
  }

  onSignedOut();
}

function queueAuthSync(work) {
  authSync = authSync
    .then(work)
    .catch((error) => {
      if (!isSupabaseLockAbort(error)) {
        console.error("Auth sync error:", error);
      }
    });
}

function isSupabaseLockAbort(error) {
  if (!error) return false;
  const message = String(error.message || error);
  return (
    error.name === "AbortError" ||
    message.includes("Lock broken by another request") ||
    message.includes("was not released within")
  );
}

function onSignedOut() {
  state.user = null;
  state.profile = null;
  state.myEntries = [];
  state.incomingRequests = [];
  state.friends = [];
  state.visibilityMap = new Map();
  state.sharedProfiles = [];
  state.sharedEntries = [];

  authCard.classList.remove("hidden");
  appPanel.classList.add("hidden");
}

async function onSignedIn(user) {
  state.user = user;
  authCard.classList.add("hidden");
  appPanel.classList.remove("hidden");

  await ensureMyProfile();
  await refreshAllData();
}

function renderAuthMode() {
  const isSignup = state.authMode === "signup";

  authTitle.textContent = isSignup ? "Create Account" : "Sign In";
  authModeText.textContent = isSignup
    ? "Create an account to get started."
    : "Use your account credentials to continue.";

  authSubmitBtn.textContent = isSignup ? "Sign Up" : "Sign In";
  authToggleBtn.textContent = isSignup
    ? "I already have an account"
    : "Need an account? Sign up";

  usernameRow.classList.toggle("hidden", !isSignup);
  usernameInput.required = isSignup;
  confirmPasswordRow.classList.toggle("hidden", !isSignup);
  confirmPasswordInput.required = isSignup;
  rememberRow.classList.toggle("hidden", isSignup);
}

async function ensureMyProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, username, full_name")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    showToast(error.message, "error");
    return;
  }

  if (data) {
    state.profile = data;
    return;
  }

  const fallbackUsername = buildUsernameFromEmail(state.user.email);

  const tryInsert = async (username) => {
    return supabaseClient.from("profiles").insert({
      id: state.user.id,
      username,
      full_name: "",
    });
  };

  let username = fallbackUsername;
  let insertResult = await tryInsert(username);

  if (insertResult.error) {
    username = `${fallbackUsername}_${Math.floor(Math.random() * 9000 + 1000)}`;
    insertResult = await tryInsert(username);
  }

  if (insertResult.error) {
    showToast(insertResult.error.message, "error");
    return;
  }

  const { data: profileData, error: reloadError } = await supabaseClient
    .from("profiles")
    .select("id, username, full_name")
    .eq("id", state.user.id)
    .single();

  if (reloadError) {
    showToast(reloadError.message, "error");
    return;
  }

  state.profile = profileData;
}

async function refreshAllData() {
  meLabel.textContent = `@${state.profile?.username || "user"}`;

  await loadMyEntries();
  renderMyEntries();

  await loadIncomingRequests();
  renderIncomingRequests();

  await loadFriends();
  renderFriends();

  await loadSharedFeed();
  renderFeed();
}

async function loadMyEntries() {
  const { data, error } = await supabaseClient
    .from("entries")
    .select("id, kind, amount, note, created_at")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  state.myEntries = data || [];
}

function renderMyEntries() {
  const totals = state.myEntries.reduce(
    (acc, entry) => {
      if (entry.kind === ENTRY_TYPES.SAVE) {
        acc.saved += Number(entry.amount);
      }

      if (entry.kind === ENTRY_TYPES.SPEND) {
        acc.spent += Number(entry.amount);
      }

      return acc;
    },
    { saved: 0, spent: 0 }
  );

  totalSavedEl.textContent = formatCurrency(totals.saved);
  totalSpentEl.textContent = formatCurrency(totals.spent);
  remainingBudgetEl.textContent = formatCurrency(totals.saved - totals.spent);
  animateStat(totalSavedEl);
  animateStat(totalSpentEl);
  animateStat(remainingBudgetEl);

  myHistory.innerHTML = "";

  for (const entry of state.myEntries) {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    const amountEl = node.querySelector(".entry-amount");

    if (entry.kind === ENTRY_TYPES.SAVE) {
      amountEl.textContent = `+ ${formatCurrency(entry.amount)}`;
      amountEl.classList.add("text-emerald-700", "dark:text-emerald-300");
    } else {
      amountEl.textContent = `- ${formatCurrency(entry.amount)}`;
      amountEl.classList.add("text-orange-700", "dark:text-orange-300");
    }

    node.querySelector(".entry-note").textContent = entry.note || "No note";
    node.querySelector(".entry-date").textContent = formatDate(entry.created_at);

    node.querySelector(".delete").addEventListener("click", async () => {
      const { error } = await supabaseClient
        .from("entries")
        .delete()
        .eq("id", entry.id)
        .eq("user_id", state.user.id);

      if (error) {
        showToast(error.message, "error");
        return;
      }

      await loadMyEntries();
      renderMyEntries();
      await loadSharedFeed();
      renderFeed();
    });

    node.classList.add("fade-in-up");
    myHistory.appendChild(node);
  }

  myEmpty.hidden = state.myEntries.length > 0;
}

async function addEntry(kind, amountInput, noteInput) {
  if (!state.user) return;

  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }

  const { error } = await supabaseClient.from("entries").insert({
    user_id: state.user.id,
    kind,
    amount,
    note,
  });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  if (kind === ENTRY_TYPES.SAVE) {
    savingsForm.reset();
    saveAmountInput.focus();
  } else {
    spendingForm.reset();
    spendAmountInput.focus();
  }

  await loadMyEntries();
  renderMyEntries();
  await loadSharedFeed();
  renderFeed();
}

async function renderSearchResults(users) {
  searchResults.innerHTML = "";

  if (users.length === 0) {
    searchResults.innerHTML = '<li class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">No users found.</li>';
    return;
  }

  for (const person of users) {
    const relation = await getRelationshipWith(person.id);

    const li = document.createElement("li");
    li.className = "fade-in-up flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-slate-900/45";

    const left = document.createElement("div");
    const name = document.createElement("p");
    name.textContent = `@${person.username}`;
    name.style.margin = "0";
    name.style.fontWeight = "700";

    const sub = document.createElement("p");
    sub.textContent = person.full_name || "User";
    sub.className = "mt-1 text-xs text-slate-600 dark:text-slate-300";

    left.appendChild(name);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "flex flex-wrap items-center gap-2";

    const statusChip = document.createElement("span");
    statusChip.className = "rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200";

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className =
      "rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

    if (!relation) {
      statusChip.textContent = "Not connected";
      actionBtn.textContent = "Add Friend";
      actionBtn.addEventListener("click", async () => {
        await sendFriendRequest(person.id);
      });
      right.appendChild(actionBtn);
    } else if (relation.status === "pending") {
      if (relation.requester_id === state.user.id) {
        statusChip.textContent = "Request sent";
      } else {
        statusChip.textContent = "Wants to connect";
        actionBtn.textContent = "Review below";
        actionBtn.disabled = true;
        right.appendChild(actionBtn);
      }
    } else if (relation.status === "accepted") {
      statusChip.textContent = "Already friends";
    } else {
      statusChip.textContent = "Previously declined";
      actionBtn.textContent = "Send Again";
      actionBtn.addEventListener("click", async () => {
        await deleteFriendship(relation.id);
        await sendFriendRequest(person.id);
      });
      right.appendChild(actionBtn);
    }

    right.appendChild(statusChip);
    li.appendChild(left);
    li.appendChild(right);
    searchResults.appendChild(li);
  }
}

async function getRelationshipWith(otherUserId) {
  const { data, error } = await supabaseClient
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${state.user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${state.user.id})`
    )
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

async function sendFriendRequest(targetId) {
  const { error } = await supabaseClient.from("friendships").insert({
    requester_id: state.user.id,
    addressee_id: targetId,
    status: "pending",
  });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast("Friend request sent.", "success");
  searchResults.innerHTML = "";
  searchInput.value = "";
  await loadIncomingRequests();
  renderIncomingRequests();
  await loadFriends();
  renderFriends();
}

async function loadIncomingRequests() {
  const { data, error } = await supabaseClient
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .eq("addressee_id", state.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  const requesterIds = (data || []).map((row) => row.requester_id);
  let profiles = [];

  if (requesterIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, username, full_name")
      .in("id", requesterIds);

    if (profileError) {
      showToast(profileError.message, "error");
      return;
    }

    profiles = profileRows || [];
  }

  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  state.incomingRequests = (data || []).map((request) => ({
    ...request,
    profile: byId.get(request.requester_id) || null,
  }));
}

function renderIncomingRequests() {
  incomingRequestsEl.innerHTML = "";

  for (const request of state.incomingRequests) {
    const li = document.createElement("li");
    li.className = "fade-in-up flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-slate-900/45";

    const left = document.createElement("div");
    const name = document.createElement("p");
    name.textContent = request.profile
      ? `@${request.profile.username}`
      : "Unknown user";
    name.style.margin = "0";
    name.style.fontWeight = "700";

    const sub = document.createElement("p");
    sub.className = "mt-1 text-xs text-slate-600 dark:text-slate-300";
    sub.textContent = `Requested ${formatDate(request.created_at)}`;

    left.appendChild(name);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-2";

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className =
      "rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", async () => {
      await respondToRequest(request.id, "accepted");
    });

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.className = "rounded-xl border border-rose-300/70 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20";
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", async () => {
      await respondToRequest(request.id, "rejected");
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);

    li.appendChild(left);
    li.appendChild(actions);
    incomingRequestsEl.appendChild(li);
  }

  incomingEmpty.hidden = state.incomingRequests.length > 0;
}

async function respondToRequest(friendshipId, status) {
  const { error } = await supabaseClient
    .from("friendships")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", friendshipId);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  await loadIncomingRequests();
  renderIncomingRequests();
  await loadFriends();
  renderFriends();
}

async function loadFriends() {
  const { data, error } = await supabaseClient
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  const friendIds = (data || []).map((row) =>
    row.requester_id === state.user.id ? row.addressee_id : row.requester_id
  );

  if (friendIds.length === 0) {
    state.friends = [];
    state.visibilityMap = new Map();
    return;
  }

  const [{ data: profiles, error: profileError }, { data: visibilityRows, error: visibilityError }] =
    await Promise.all([
      supabaseClient.from("profiles").select("id, username, full_name").in("id", friendIds),
      supabaseClient
        .from("profile_visibility")
        .select("owner_id, viewer_id, can_view")
        .eq("owner_id", state.user.id)
        .in("viewer_id", friendIds),
    ]);

  if (profileError) {
    showToast(profileError.message, "error");
    return;
  }

  if (visibilityError) {
    showToast(visibilityError.message, "error");
    return;
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const visibilityMap = new Map(
    (visibilityRows || []).map((row) => [row.viewer_id, Boolean(row.can_view)])
  );

  state.visibilityMap = visibilityMap;
  state.friends = friendIds
    .map((id) => ({
      friendshipId: (data || []).find((row) =>
        (row.requester_id === state.user.id && row.addressee_id === id) ||
        (row.addressee_id === state.user.id && row.requester_id === id)
      )?.id,
      profile: profileMap.get(id),
    }))
    .filter((row) => row.profile);
}

function renderFriends() {
  friendsList.innerHTML = "";

  for (const friend of state.friends) {
    const li = document.createElement("li");
    li.className = "fade-in-up flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-slate-900/45";

    const left = document.createElement("div");
    const name = document.createElement("p");
    name.textContent = `@${friend.profile.username}`;
    name.style.margin = "0";
    name.style.fontWeight = "700";

    const sub = document.createElement("p");
    sub.className = "mt-1 text-xs text-slate-600 dark:text-slate-300";
    sub.textContent =
      state.visibilityMap.get(friend.profile.id) === true
        ? "Can view your data"
        : "Cannot view your data";

    left.appendChild(name);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-2";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className =
      "rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500";

    const enabled = state.visibilityMap.get(friend.profile.id) === true;
    toggleBtn.textContent = enabled ? "Revoke View" : "Allow View";
    if (enabled) {
      toggleBtn.className = "rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-white/20 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08]";
    }

    toggleBtn.addEventListener("click", async () => {
      await setVisibility(friend.profile.id, !enabled);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "rounded-xl border border-rose-300/70 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      await deleteFriendship(friend.friendshipId);
      await loadFriends();
      renderFriends();
      await loadSharedFeed();
      renderFeed();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(removeBtn);

    li.appendChild(left);
    li.appendChild(actions);
    friendsList.appendChild(li);
  }

  friendsEmpty.hidden = state.friends.length > 0;
}

async function setVisibility(viewerId, canView) {
  const { error } = await supabaseClient.from("profile_visibility").upsert(
    {
      owner_id: state.user.id,
      viewer_id: viewerId,
      can_view: canView,
    },
    { onConflict: "owner_id,viewer_id" }
  );

  if (error) {
    showToast(error.message, "error");
    return;
  }

  await loadFriends();
  renderFriends();
}

async function deleteFriendship(friendshipId) {
  const { error } = await supabaseClient
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    showToast(error.message, "error");
  }
}

async function loadSharedFeed() {
  const { data: visibilityRows, error: visibilityError } = await supabaseClient
    .from("profile_visibility")
    .select("owner_id")
    .eq("viewer_id", state.user.id)
    .eq("can_view", true);

  if (visibilityError) {
    showToast(visibilityError.message, "error");
    return;
  }

  const ownerIds = [...new Set((visibilityRows || []).map((row) => row.owner_id))];

  if (ownerIds.length === 0) {
    state.sharedProfiles = [];
    state.sharedEntries = [];
    return;
  }

  const [{ data: profiles, error: profileError }, { data: entries, error: entryError }] =
    await Promise.all([
      supabaseClient.from("profiles").select("id, username, full_name").in("id", ownerIds),
      supabaseClient
        .from("entries")
        .select("id, user_id, kind, amount, note, created_at")
        .in("user_id", ownerIds)
        .order("created_at", { ascending: false }),
    ]);

  if (profileError) {
    showToast(profileError.message, "error");
    return;
  }

  if (entryError) {
    showToast(entryError.message, "error");
    return;
  }

  state.sharedProfiles = profiles || [];
  state.sharedEntries = entries || [];
}

function renderFeed() {
  friendsFeed.innerHTML = "";

  for (const profile of state.sharedProfiles) {
    const mine = state.sharedEntries.filter((entry) => entry.user_id === profile.id);

    const totals = mine.reduce(
      (acc, entry) => {
        if (entry.kind === ENTRY_TYPES.SAVE) {
          acc.saved += Number(entry.amount);
        } else {
          acc.spent += Number(entry.amount);
        }

        return acc;
      },
      { saved: 0, spent: 0 }
    );

    const card = document.createElement("article");
    card.className = "fade-in-up rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/45";

    const name = document.createElement("h4");
    name.textContent = `@${profile.username}`;
    card.appendChild(name);

    const stats = document.createElement("div");
    stats.className = "mt-2 flex flex-wrap gap-2";

    stats.innerHTML = `
      <span class="rounded-full border border-emerald-300/70 bg-emerald-100 px-3 py-1 text-xs text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-200">Saved: ${formatCurrency(totals.saved)}</span>
      <span class="rounded-full border border-orange-300/70 bg-orange-100 px-3 py-1 text-xs text-orange-800 dark:border-orange-300/30 dark:bg-orange-500/10 dark:text-orange-200">Spent: ${formatCurrency(totals.spent)}</span>
      <span class="rounded-full border border-indigo-300/70 bg-indigo-100 px-3 py-1 text-xs text-indigo-800 dark:border-indigo-300/30 dark:bg-indigo-500/10 dark:text-indigo-200">Remaining: ${formatCurrency(totals.saved - totals.spent)}</span>
    `;

    card.appendChild(stats);

    const recent = mine.slice(0, 5);
    if (recent.length === 0) {
      const empty = document.createElement("p");
      empty.className = "text-xs text-slate-600 dark:text-slate-300";
      empty.textContent = "No entries shared yet.";
      card.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "mt-2 space-y-2";

      for (const entry of recent) {
        const item = document.createElement("li");
        item.className = "fade-in-up flex items-start justify-between gap-3 rounded-xl border border-slate-300 bg-white p-3 dark:border-white/10 dark:bg-slate-900/55";

        const left = document.createElement("div");
        const amount = document.createElement("p");
        amount.className = `text-sm font-semibold ${entry.kind === ENTRY_TYPES.SAVE ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}`;
        amount.textContent = `${entry.kind === ENTRY_TYPES.SAVE ? "+" : "-"} ${formatCurrency(entry.amount)}`;

        const note = document.createElement("p");
        note.className = "mt-1 text-xs text-slate-600 dark:text-slate-300";
        note.textContent = entry.note || "No note";

        left.appendChild(amount);
        left.appendChild(note);

        const right = document.createElement("div");
        right.className = "flex flex-col items-end gap-2";
        const date = document.createElement("span");
        date.className = "text-xs text-slate-500 dark:text-slate-400";
        date.textContent = formatDate(entry.created_at);
        right.appendChild(date);

        item.appendChild(left);
        item.appendChild(right);
        list.appendChild(item);
      }

      card.appendChild(list);
    }

    friendsFeed.appendChild(card);
  }

  feedEmpty.hidden = state.sharedProfiles.length > 0;
}


function restoreRememberedLogin() {
  const remember = localStorage.getItem(REMEMBER_ME_KEY) === "1";
  const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";

  if (rememberMeInput) {
    rememberMeInput.checked = remember;
  }

  if (remember && rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    state.authMode = "signin";
  }
}

function persistRememberChoice(email, shouldRemember) {
  if (shouldRemember) {
    localStorage.setItem(REMEMBER_ME_KEY, "1");
    localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    return;
  }

  localStorage.setItem(REMEMBER_ME_KEY, "0");
  localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

function togglePasswordVisibility(input, toggleButton) {
  if (!input || !toggleButton) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  toggleButton.textContent = isHidden ? "Hide" : "Show";
}

function animateStat(element) {
  if (!element) return;
  element.classList.remove("value-pop");
  void element.offsetWidth;
  element.classList.add("value-pop");
}

function showToast(message, type = "info") {
  if (!toastContainer || !message) return;

  const palette = {
    success: "border-emerald-300/70 bg-emerald-100 text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-500/15 dark:text-emerald-100",
    error: "border-rose-300/70 bg-rose-100 text-rose-900 dark:border-rose-300/40 dark:bg-rose-500/15 dark:text-rose-100",
    warning: "border-amber-300/70 bg-amber-100 text-amber-900 dark:border-amber-300/40 dark:bg-amber-500/15 dark:text-amber-100",
    info: "border-indigo-300/70 bg-indigo-100 text-indigo-900 dark:border-indigo-300/40 dark:bg-indigo-500/15 dark:text-indigo-100",
  };

  const toast = document.createElement("div");
  toast.className = `toast-in pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-soft ${palette[type] || palette.info}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.remove("toast-in");
    toast.classList.add("toast-out");
    window.setTimeout(() => toast.remove(), 180);
  }, 2800);
}
function buildUsernameFromEmail(email) {
  const base = (email || "user")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  if (base.length >= 3) {
    return base.slice(0, 28);
  }

  return `user${Math.floor(Math.random() * 9000 + 1000)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}









































