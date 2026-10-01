import { useCallback, useEffect, useMemo, useState } from "react";
import { stockService } from "../services/stockService";
import { printRestockSummary } from "../utils/restockPdf";
import "./StokView.css";

const GREEN = "#1a5c38";
const MUTED = "#66716a";
const TYPES = { ingredient: "Bahan Baku", menu: "Item Menu" };
const STATUS = {
  pending: { label: "Menunggu POS", color: "#9a5b00", bg: "#fff2dc" },
  processing: { label: "Sedang diproses POS", color: "#285b80", bg: "#e9f2f8" },
  applied: { label: "Diterapkan", color: GREEN, bg: "#e8f5ee" },
  rejected: { label: "Ditolak", color: "#aa3030", bg: "#fdecec" },
  cancelled: { label: "Dibatalkan", color: MUTED, bg: "#eef1ee" },
};

const formatDate = (value) => value
  ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
  : "Belum ada pembaruan";

function errorText(error) {
  const message = String(error?.message || error || "Gagal memuat data");
  if (message.includes("RESTOCK_NOT_ALLOWED")) return "Akun ini hanya dapat melihat stok.";
  if (message.includes("PENDING_LIMIT_REACHED")) return "Antrean POS penuh. Tunggu permintaan sebelumnya diproses.";
  if (message.includes("ITEM_NOT_FOUND")) return "Item sudah tidak ada di POS. Muat ulang daftar stok.";
  if (message.includes("Failed to fetch")) return "Koneksi ke cloud gagal. Periksa internet lalu coba lagi.";
  return message;
}

export default function StokView({ user }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [syncState, setSyncState] = useState(null);
  const [type, setType] = useState("menu");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retryBatch, setRetryBatch] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const activeStore = stores.find((store) => store.id === storeId);
  const canRestock = ["owner", "staff"].includes(activeStore?.permission);
  const ingredientsEnabled = syncState?.ingredients_enabled === true;

  const loadStores = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await stockService.listStores(user.id);
      setStores(result);
      setStoreId((current) => current && result.some((store) => store.id === current) ? current : result[0]?.id || "");
    } catch (err) {
      setError(errorText(err));
    }
  }, [user?.id]);

  const loadStock = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await stockService.load(storeId);
      setItems(result.items);
      setEvents(result.events);
      setSyncState(result.syncState);
      if (type === "ingredient" && !result.syncState?.ingredients_enabled) setType("menu");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [storeId, type]);

  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => {
    if (!storeId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadStock();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [storeId, loadStock]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return items.filter((item) => item.item_type === type &&
      (!query || `${item.name} ${item.item_id}`.toLocaleLowerCase("id-ID").includes(query)));
  }, [items, search, type]);

  const setItemType = (nextType) => {
    setType(nextType);
    setSearch("");
    setQuantities({});
    setSuccess(null);
  };

  const toggleItem = (item) => {
    setQuantities((current) => {
      const next = { ...current };
      if (Object.hasOwn(next, item.item_id)) delete next[item.item_id];
      else next[item.item_id] = "1";
      return next;
    });
  };

  const selectedItems = items.filter((item) => item.item_type === type && Object.hasOwn(quantities, item.item_id));

  const submit = async () => {
    const chosen = items.filter((item) => item.item_type === type && Object.hasOwn(quantities, item.item_id));
    const rows = chosen.map((item) => ({ item, qty: Number(quantities[item.item_id]) }));
    if (!retryBatch && (!rows.length || rows.some(({ item, qty }) => !Number.isFinite(qty) || qty <= 0 || qty > 1000000 ||
      (type === "menu" && !Number.isInteger(qty)) || (type === "ingredient" && Number(qty.toFixed(3)) !== qty) || item.current_stock === null))) {
      setError(type === "menu" ? "Pilih item dengan stok terukur dan jumlah bulat lebih dari 0." : "Jumlah bahan harus lebih dari 0 dan maksimal tiga angka desimal.");
      return;
    }
    if (!retryBatch && rows.length > 200) { setError("Maksimal 200 item per pengiriman."); return; }

    setBusy(true);
    setError("");
    try {
      const summary = rows.map(({ item, qty }) => ({
        name: item.name,
        quantity: qty,
        unit: type === "ingredient" ? item.unit || "satuan" : "pcs",
      }));
      const batch = retryBatch || {
        storeId,
        batchId: crypto.randomUUID(),
        itemType: type,
        summary,
        items: rows.map(({ item, qty }) => ({ id: crypto.randomUUID(), itemId: item.item_id, qty, note: note.trim() })),
      };
      setRetryBatch(batch);
      await stockService.submitBatch(batch);
      setSuccess({ batchId: batch.batchId, type: TYPES[batch.itemType], items: batch.summary, createdAt: new Date() });
      setRetryBatch(null);
      setQuantities({});
      setNote("");
      await loadStock();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelEvent = async (eventId) => {
    setBusy(true);
    setError("");
    try {
      const cancelled = await stockService.cancel(storeId, eventId);
      if (!cancelled) setError("Permintaan sudah diproses POS dan tidak bisa dibatalkan.");
      await loadStock();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const freshness = syncState?.last_seen_at ? Date.now() - new Date(syncState.last_seen_at).getTime() : Infinity;
  const posOnline = freshness <= 15 * 60 * 1000;

  return (
    <div className="stock-page">
      <header className="stock-heading">
        <div>
          <p className="stock-eyebrow">DEN POS · INVENTARIS</p>
          <h1>Isi Stok</h1>
          <p className="stock-subtitle">Ajukan penambahan stok ke POS untuk ditinjau sebelum diterapkan.</p>
        </div>
        {stores.length > 1 && (
          <label className="stock-store-select">
            Toko
            <select value={storeId} disabled={!!retryBatch} onChange={(event) => { setStoreId(event.target.value); setSuccess(null); }}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <div className="stock-message stock-message-error" role="alert">{error}</div>}
      {!canRestock && activeStore && <div className="stock-message">Akses lihat saja. Hubungi pemilik toko untuk mengajukan isi stok.</div>}

      {success && (
        <section className="stock-success" aria-live="polite">
          <div>
            <strong>Permintaan dikirim untuk persetujuan POS</strong>
            <span>{success.items.length} item · Batch {success.batchId.slice(0, 8)}</span>
          </div>
          <button type="button" onClick={() => { if (!printRestockSummary(success)) setError("Izinkan pop-up untuk mencetak ringkasan PDF."); }}>Cetak ringkasan PDF</button>
          <button type="button" className="stock-quiet-button" onClick={() => setSuccess(null)} aria-label="Tutup ringkasan">×</button>
        </section>
      )}

      <section className="stock-toolbar">
        <div className="stock-freshness">
          <span className={`stock-live-dot ${posOnline ? "is-online" : ""}`} />
          <span>{syncState ? (posOnline ? "POS tersambung" : "POS offline · data mungkin basi") : "Menunggu sinkronisasi POS"}</span>
          {syncState && <small>Terakhir terlihat {formatDate(syncState.last_seen_at)}</small>}
        </div>
        <div className="stock-segment" role="tablist" aria-label="Jenis stok">
          {ingredientsEnabled && <button type="button" role="tab" aria-selected={type === "ingredient"} className={type === "ingredient" ? "is-selected" : ""} disabled={!!retryBatch} onClick={() => setItemType("ingredient")}>Bahan Baku</button>}
          <button type="button" role="tab" aria-selected={type === "menu"} className={type === "menu" ? "is-selected" : ""} disabled={!!retryBatch} onClick={() => setItemType("menu")}>Item Menu</button>
        </div>
      </section>

      <section className="stock-catalog">
        <div className="stock-catalog-heading">
          <div>
            <h2>{TYPES[type]}</h2>
            <span>{visibleItems.length} item tersedia</span>
          </div>
          {items.filter((item) => item.item_type === type).length > 8 && (
            <label className="stock-search">
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari ${TYPES[type].toLocaleLowerCase("id-ID")}…`} />
            </label>
          )}
          {canRestock && <button type="button" className="stock-primary-button" onClick={() => { setModalOpen(true); setError(""); }}>Tambah stok</button>}
        </div>

        {loading ? <div className="stock-empty">Memuat daftar stok…</div> : !syncState ? (
          <div className="stock-empty">
            <strong>Belum ada data dari POS</strong>
            <span>Hubungkan dan sinkronkan perangkat POS terlebih dahulu. Item akan muncul otomatis dari data POS.</span>
          </div>
        ) : !visibleItems.length ? (
          <div className="stock-empty">
            <strong>{search ? "Tidak ada item yang cocok" : `Belum ada ${TYPES[type].toLocaleLowerCase("id-ID")}`}</strong>
            <span>{search ? "Coba kata kunci lain." : "Daftar mengikuti item yang tersedia di software POS."}</span>
          </div>
        ) : (
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead><tr><th>Nama item</th><th>Stok POS</th><th>Minimum</th><th>Status</th><th /></tr></thead>
              <tbody>{visibleItems.map((item) => {
                const noLimit = item.current_stock === null;
                const low = !noLimit && Number(item.current_stock) <= Number(item.min_stock || 0);
                return <tr key={`${item.item_type}:${item.item_id}`}>
                  <td><strong>{item.name}</strong><small>ID {item.item_id}</small></td>
                  <td>{noLimit ? "Tidak dibatasi" : `${item.current_stock} ${item.unit || ""}`}</td>
                  <td>{item.min_stock} {item.unit || ""}</td>
                  <td><span className={`stock-badge ${noLimit ? "stock-badge-neutral" : low ? "stock-badge-low" : "stock-badge-good"}`}>{noLimit ? "Tanpa batas" : low ? "Menipis" : "Tersedia"}</span></td>
                  <td>{events.some((event) => event.status === "pending" && event.item_type === item.item_type && event.item_id === item.item_id) && <span className="stock-pending-tag">Permintaan menunggu</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stock-history">
        <div className="stock-section-heading"><div><h2>Riwayat permintaan</h2><span>Persetujuan dilakukan dari aplikasi POS</span></div><button type="button" onClick={loadStock} disabled={loading}>Muat ulang</button></div>
        {!events.length ? <div className="stock-empty stock-empty-compact">Belum ada permintaan isi stok.</div> : (
          <div className="stock-event-list">
            {events.map((event) => {
              const status = STATUS[event.status] || STATUS.pending;
              return <article className="stock-event" key={event.id}>
                <div className="stock-event-main">
                  <span className="stock-event-mark" aria-hidden="true">{event.item_type === "ingredient" ? "B" : "M"}</span>
                  <div><strong>{event.item_name}</strong><small>{TYPES[event.item_type]} · +{event.qty} {event.unit || "pcs"}{event.requester_email ? ` · ${event.requester_email}` : ""}</small></div>
                </div>
                <div className="stock-event-meta"><span className="stock-badge" style={{ color: status.color, background: status.bg }}>{status.label}</span><small>{formatDate(event.created_at)}</small></div>
                {event.status === "rejected" && event.reject_reason && <p className="stock-reject-reason">{event.reject_reason}</p>}
                {event.status === "applied" && event.stock_after !== null && <small className="stock-after">Stok setelah diterapkan: {event.stock_after} {event.unit || "pcs"}</small>}
                {event.status === "pending" && canRestock && <button type="button" className="stock-cancel-button" disabled={busy} onClick={() => cancelEvent(event.id)}>Batalkan</button>}
              </article>;
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="stock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModalOpen(false); }}>
          <section className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title">
            <header className="stock-modal-header">
              <div><p>{TYPES[type]}</p><h2 id="stock-modal-title">Tambah stok</h2></div>
              <button type="button" className="stock-quiet-button" onClick={() => setModalOpen(false)} disabled={busy} aria-label="Tutup">×</button>
            </header>
            <p className="stock-modal-hint">Pilih satu atau beberapa item. Permintaan baru diterapkan setelah diterima di POS.</p>
            {error && <div className="stock-message stock-message-error stock-modal-error" role="alert">{error}{retryBatch && <button type="button" onClick={() => setRetryBatch(null)}>Batalkan kiriman lama</button>}</div>}
            {items.filter((item) => item.item_type === type).length > 8 && (
              <label className="stock-search stock-modal-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari ${TYPES[type].toLocaleLowerCase("id-ID")}…`} /></label>
            )}
            <div className="stock-select-list">
              {visibleItems.map((item) => {
                const selected = Object.hasOwn(quantities, item.item_id);
                const disabled = item.current_stock === null;
                return <div className={`stock-select-row ${selected ? "is-checked" : ""}`} key={item.item_id}>
                  <label className="stock-select-label">
                    <input type="checkbox" checked={selected} disabled={disabled || !!retryBatch} onChange={() => toggleItem(item)} />
                    <span><strong>{item.name}</strong><small>Stok {disabled ? "tidak dibatasi" : `${item.current_stock} ${item.unit || ""}`}</small></span>
                  </label>
                  {selected && <label className="stock-qty-input"><span>Tambah ({type === "ingredient" ? item.unit || "satuan" : "pcs"})</span><input type="number" min="0.001" step={type === "ingredient" ? "0.001" : "1"} value={quantities[item.item_id]} disabled={!!retryBatch} onChange={(event) => setQuantities((current) => ({ ...current, [item.item_id]: event.target.value }))} /></label>}
                  {disabled && <small className="stock-unlimited-label">Stok tidak dibatasi</small>}
                </div>;
              })}
              {!visibleItems.length && <div className="stock-empty stock-empty-compact">Tidak ada item yang cocok.</div>}
            </div>
            <label className="stock-note-label">Catatan untuk POS <span>Opsional</span><textarea value={note} maxLength={500} rows={2} disabled={!!retryBatch} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: pembelian dari pemasok…" /></label>
            <footer className="stock-modal-footer">
              <span>{selectedItems.length} item dipilih</span>
              <button type="button" className="stock-secondary-button" onClick={() => setModalOpen(false)} disabled={busy}>Batal</button>
              <button type="button" className="stock-primary-button" onClick={submit} disabled={busy || (!retryBatch && !selectedItems.length)}>{busy ? "Mengirim…" : retryBatch ? "Coba kirim ulang" : "Kirim ke POS"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}