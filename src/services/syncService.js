import { supabase } from "./supabaseClient";

// ── Cloud sync service (baca data via RLS + pairing) ────────────────────────
// Semua query di bawah dilindungi RLS di database: user hanya bisa melihat
// store miliknya. Frontend TIDAK perlu (dan tidak boleh) memfilter store_id
// sendiri — backend yang menegakkan.

export const deviceService = {
  /**
   * Pasangkan perangkat dengan kode pairing (mis. "9WMF3J99").
   * Memanggil RPC `pair_device` (security definer) — satu-satunya cara web-app
   * menulis ke tabel pairing/devices.
   */
  async pair(code) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const clean = String(code || "").replace(/\s/g, "").toUpperCase();
    if (clean.length < 4) return { ok: false, error: "Kode pairing tidak valid." };

    const { data, error } = await supabase.rpc("pair_device", { p_code: clean });
    if (error) {
      const m = String(error.message || "");
      if (m.includes("PAIRING_CODE_INVALID")) return { ok: false, error: "Kode salah atau sudah kedaluwarsa." };
      if (m.includes("AUTH_REQUIRED")) return { ok: false, error: "Anda harus login dulu." };
      return { ok: false, error: m };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, storeId: row?.store_id, storeName: row?.store_name };
  },

  /** Daftar perangkat yang bisa dilihat user (RLS membatasi ke store miliknya). */
  async listDevices() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("devices")
      .select("device_id, device_name, status, last_seen_at, created_at, store_id")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[deviceService.listDevices]", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Cabut (revoke) perangkat lewat RPC aman — hanya kolom `status` yang
   * berubah, dan hanya untuk device milik user (lihat migrasi 0002).
   */
  async revokeDevice(deviceId) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const { error } = await supabase.rpc("revoke_device", { p_device_id: deviceId });
    if (error) return { ok: false, error: friendlyDeviceError(error.message) };
    return { ok: true };
  },

  /** Aktifkan kembali perangkat yang di-revoke (RPC aman). */
  async activateDevice(deviceId) {
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const { error } = await supabase.rpc("activate_device", { p_device_id: deviceId });
    if (error) return { ok: false, error: friendlyDeviceError(error.message) };
    return { ok: true };
  },

  /** Store milik user (dari keanggotaan). */
  async listStores() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[deviceService.listStores]", error.message);
      return [];
    }
    return data || [];
  },
};

export const syncDataService = {
  /** Transaksi tersinkron (RLS membatasi ke store milik user). */
  async listTransactions({ limit = 200 } = {}) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("synced_transactions")
      .select("trx_id, store_id, device_id, payload, occurred_at, synced_at")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[syncDataService.listTransactions]", error.message);
      return [];
    }
    return (data || []).map((row) => ({
      ...(row.payload || {}),
      trxId: row.trx_id,
      storeId: row.store_id,
      deviceId: row.device_id,
      occurredAt: row.occurred_at,
      syncedAt: row.synced_at,
    }));
  },

  /** Ringkasan cepat: jumlah transaksi & total nilai. */
  async summary() {
    const rows = await this.listTransactions({ limit: 5000 });
    const total = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    return { count: rows.length, total };
  },
};

function friendlyDeviceError(msg) {
  const m = String(msg || "");
  if (m.includes("STORE_ACCESS_DENIED")) return "Anda tidak punya akses ke perangkat ini.";
  if (m.includes("DEVICE_NOT_FOUND")) return "Perangkat tidak ditemukan.";
  if (m.includes("AUTH_REQUIRED")) return "Anda harus login dulu.";
  return m;
}

// ── Laporan & Riwayat dari data tersinkron (Supabase, dilindungi RLS) ───────
// Menghasilkan BENTUK yang sama dengan backend Express lama supaya komponen
// LaporanView / RiwayatView bisa dipakai tanpa banyak diubah.

const isVoided = (t) => t?.status === "voided" || t?.voided === true;

function transactionDate(t) {
  return t?.createdAt || t?.occurredAt || t?.date || t?.syncedAt || null;
}

export const reportService = {
  /** Semua transaksi store milik user (RLS). */
  async _all() {
    return syncDataService.listTransactions({ limit: 5000 });
  },

  /**
   * Laporan ringkas: { summary, data: { transactions, topProducts } }
   * (kompatibel dengan LaporanView).
   */
  async getLaporan({ days } = {}) {
    const all = await this._all();
    let rows = all;
    if (days) {
      const cutoff = Date.now() - days * 86400000;
      rows = all.filter((t) => {
        const d = transactionDate(t);
        return d ? new Date(d).getTime() >= cutoff : true;
      });
    }

    const active = rows.filter((t) => !isVoided(t));
    const totalRevenue = active.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const voidedTransactions = rows.filter(isVoided).length;
    const averageOrderValue = active.length ? totalRevenue / active.length : 0;

    // Top produk: agregasi qty + omzet per item.
    const byProduct = new Map();
    for (const t of active) {
      for (const it of t.items || []) {
        const key = it.id ?? it.nama ?? it.name;
        if (key === undefined || key === null) continue;
        const cur = byProduct.get(key) || { id: key, name: it.nama || it.name || String(key), qty: 0, revenue: 0 };
        const qty = Number(it.qty ?? it.baseQty) || 0;
        cur.qty += qty;
        cur.revenue += (Number(it.harga ?? it.price) || 0) * qty;
        byProduct.set(key, cur);
      }
    }
    const topProducts = [...byProduct.values()].sort((a, b) => b.qty - a.qty);

    return {
      summary: { totalRevenue, totalTransactions: active.length, averageOrderValue, voidedTransactions },
      data: { transactions: rows, topProducts },
    };
  },
};

export const historyService = {
  /**
   * Riwayat dengan filter. Bentuk balikan mengikuti backend lama yang dipakai
   * RiwayatView: `{ data: [transaksi...] }` (array, bukan objek).
   */
  async getRiwayat(filters = {}) {
    const { startDate, endDate, paymentMethod, status, search, limit = 500 } = filters;
    let rows = await syncDataService.listTransactions({ limit: 5000 });

    if (startDate) rows = rows.filter((t) => (transactionDate(t) || "") >= startDate);
    if (endDate) rows = rows.filter((t) => (transactionDate(t) || "") <= `${endDate}T23:59:59`);
    if (paymentMethod) rows = rows.filter((t) => (t.metodeBayar || t.metode || t.paymentMethod) === paymentMethod);
    if (status === "voided") rows = rows.filter(isVoided);
    else if (status === "completed") rows = rows.filter((t) => !isVoided(t));
    if (search) {
      const q = String(search).toLowerCase();
      rows = rows.filter((t) =>
        String(t.id || t.trxId || "").toLowerCase().includes(q) ||
        String(t.customerName || t.customer || "").toLowerCase().includes(q));
    }

    rows.sort((a, b) => new Date(transactionDate(b) || 0) - new Date(transactionDate(a) || 0));

    return { data: rows.slice(0, limit) };
  },
};
