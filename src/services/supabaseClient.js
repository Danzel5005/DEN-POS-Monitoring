import { createClient } from "@supabase/supabase-js";

// ── Supabase client (SATU project milik pemilik aplikasi) ───────────────────
// Semua user memakai project yang SAMA; isolasi data dilakukan oleh RLS di
// database (lihat supabase/migrations/0001_init.sql), bukan di React.
//
// Konfigurasi lewat file `.env` di folder monitoring-frontend:
//   VITE_SUPABASE_URL      = https://<ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY = <anon key>   (AMAN untuk browser; dilindungi RLS)
//
// Catatan: anon key memang dipakai di browser — itu memang perannya. JANGAN
// memakai service_role key di sini.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ── Konvensi username → email ───────────────────────────────────────────────
// Supabase Auth memakai EMAIL. Supaya user cukup mengetik "admin" (bukan
// "admin@simpan"), kita bikin email internal dari username. Domain ini TIDAK
// perlu menerima surat — hanya penanda unik di dalam project.
export const USERNAME_DOMAIN = "pos.local";

export function usernameToEmail(username) {
  return `${String(username || "").trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email) {
  return String(email || "").split("@")[0];
}
