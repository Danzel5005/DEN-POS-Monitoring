import { supabase, usernameToEmail, emailToUsername, supabaseConfigured } from "./supabaseClient";

// ── Auth Supabase (satu project, banyak user) ───────────────────────────────
// User mendaftar sendiri di web-app. Supabase Auth menangani penyimpanan
// password (hash) & sesi. Kita hanya memetakan username → email internal.

export const authService = {
  configured: supabaseConfigured,

  /** Daftar akun baru: username + password (+ nama opsional). */
  async signUp({ username, password, name }) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const uname = String(username || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) {
      return { ok: false, error: "Username 3–30 karakter (huruf kecil, angka, . _ -)." };
    }
    if (String(password || "").length < 6) {
      return { ok: false, error: "Password minimal 6 karakter." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(uname),
      password,
      options: { data: { username: uname, name: name || uname } },
    });
    if (error) return { ok: false, error: error.message };

    // Bila "Confirm email" aktif di dashboard, tidak ada sesi setelah signUp.
    if (!data.session) {
      return {
        ok: true,
        needsEmailConfirmation: true,
        user: normalizeUser(data.user),
      };
    }
    return { ok: true, user: normalizeUser(data.user), session: data.session };
  },

  /** Masuk: username + password. */
  async signIn({ username, password }) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    return { ok: true, user: normalizeUser(data.user), session: data.session };
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  /** Sesi tersimpan (saat reload). */
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  },

  /** Ganti password sendiri (user sudah login). */
  async changePassword(newPassword) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    if (String(newPassword || "").length < 6) {
      return { ok: false, error: "Password minimal 6 karakter." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  /** Langganan perubahan sesi (login/logout/refresh) — untuk React. */
  onAuthStateChange(callback) {
    if (!supabase) return { unsubscribe: () => {} };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session ? normalizeUser(session.user) : null, session);
    });
    return data.subscription;
  },
};

function normalizeUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    username: meta.username || emailToUsername(user.email),
    name: meta.name || meta.username || emailToUsername(user.email),
    createdAt: user.created_at,
  };
}

function friendlyAuthError(msg) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Username atau password salah.";
  if (m.includes("email not confirmed")) return "Akun belum dikonfirmasi. Cek email konfirmasi.";
  if (m.includes("user already registered")) return "Username sudah dipakai.";
  return msg;
}
