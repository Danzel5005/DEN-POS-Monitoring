import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiMaximize, FiMinimize, FiRefreshCw, FiVolume2, FiVolumeX } from "react-icons/fi";
import { KDS_KIND_LABEL, KDS_STATUS_LABEL } from "../../../shared/kds-contract.js";
import {
  loadKdsStores,
  loadKdsStations,
  loadKdsTickets,
  setKdsTicketStatus,
  subscribeKdsTickets,
} from "../services/kdsService";
import "./kds.css";

const PAGE_SIZE = 300;
const STORE_KEY = "denpos-kds-store";
const STAGES = ["new", "preparing", "ready"];
const NEXT_STATUS = { new: "preparing", preparing: "ready", ready: "served" };
const PREVIOUS_STATUS = { preparing: "new", ready: "preparing", served: "ready" };

function ageLabel(createdAt, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  return minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)}j ${String(minutes % 60).padStart(2, "0")}m`;
}

function ageTone(createdAt, now) {
  const minutes = (now - new Date(createdAt).getTime()) / 60000;
  return minutes >= 30 ? "late" : minutes >= 15 ? "aging" : "fresh";
}

function playTicketSound() {
  try {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextImpl) return;
    const context = new AudioContextImpl();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.onended = () => context.close();
  } catch { /* Audio may be blocked until a user gesture. */ }
}

function Ticket({ ticket, now, busy, onSetStatus, onDismiss }) {
  const cancelled = ticket.kind === "cancel" || ticket.status === "cancelled";
  const statusLabel = ticket.kind === "cancel" ? KDS_KIND_LABEL.cancel : KDS_STATUS_LABEL[ticket.status] || "Status tidak dikenal";
  const nextStatus = cancelled ? null : NEXT_STATUS[ticket.status];
  const previousStatus = cancelled ? null : PREVIOUS_STATUS[ticket.status];
  return (
    <article className={`kds-ticket ${cancelled ? "kds-ticket-cancelled" : ""}`}>
      <header className="kds-ticket-head">
        <div>
          <span className={`kds-kind kds-kind-${ticket.kind}`}>{ticket.kind_label || "Pesanan"}</span>
          <strong className="kds-ticket-source">{ticket.source_label || "Pesanan"}</strong>
        </div>
        <div className={`kds-age kds-age-${ageTone(ticket.created_at, now)}`} aria-label={`Umur pesanan ${ageLabel(ticket.created_at, now)}`}>
          {ageLabel(ticket.created_at, now)}
        </div>
      </header>
      <div className="kds-ticket-meta">
        {ticket.table_label && <strong>{ticket.table_label}</strong>}
        <span className="kds-ticket-station">{ticket.station_label || "Lainnya"}</span>
        <span>{statusLabel}</span>
      </div>
      <ul className="kds-ticket-items">
        {(ticket.items || []).map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <div className="kds-item-line">
              <b>{item.qty} ×</b>
              <span>{item.label}</span>
              {item.unit_label && <small>{item.unit_label}</small>}
            </div>
            {item.category_label && <small className="kds-category-label">{item.category_label}</small>}
            {item.note && <p className="kds-item-note">{item.note}</p>}
          </li>
        ))}
      </ul>
      {ticket.note && <p className="kds-ticket-note">{ticket.note}</p>}
      {ticket.extras?.length > 0 && <div className="kds-ticket-extras">{ticket.extras.map((extra, index) => (
        <span key={`${extra.label}-${index}`}><b>{extra.label}:</b> {extra.value}</span>
      ))}</div>}
      <footer className="kds-ticket-foot">
        <span>{ticket.created_by_label || ticket.device_label || "Kasir"}</span>
        <div>
          {cancelled && <button className="kds-back-button" onClick={() => onDismiss(ticket.id)}>Sembunyikan</button>}
          {previousStatus && <button className="kds-back-button" disabled={busy} onClick={() => onSetStatus(ticket, previousStatus)}>Kembalikan</button>}
          {nextStatus && <button className="kds-action-button" disabled={busy} onClick={() => onSetStatus(ticket, nextStatus)}>
            {nextStatus === "served" ? "Diantar" : KDS_STATUS_LABEL[nextStatus]}
          </button>}
        </div>
      </footer>
    </article>
  );
}

export default function KdsView({ user, onLogout }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [stations, setStations] = useState([]);
  const [stationLabel, setStationLabel] = useState("all");
  const [activeTickets, setActiveTickets] = useState([]);
  const [dismissedTicketIds, setDismissedTicketIds] = useState(() => new Set());
  const [servedTickets, setServedTickets] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("denpos-kds-sound") !== "off");
  const [fullScreen, setFullScreen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef(null);

  const selectedStore = stores.find((store) => store.id === storeId);
  const refreshTickets = useCallback(async () => {
    if (!storeId) return;
    try {
      const [result, stationRows] = await Promise.all([
        loadKdsTickets(storeId),
        loadKdsStations(storeId),
      ]);
      setActiveTickets(result.active);
      setServedTickets(result.served);
      setStations(stationRows);
      setHasMore(result.hasMoreActive);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err?.message || "Pesanan belum dapat dimuat.");
    }
  }, [storeId, soundEnabled]);

  useEffect(() => {
    let alive = true;
    loadKdsStores(user.id).then((rows) => {
      if (!alive) return;
      setStores(rows);
      const savedStoreId = localStorage.getItem(`${STORE_KEY}:${user.id}`);
      setStoreId(rows.find((store) => store.id === savedStoreId)?.id || rows[0]?.id || "");
      setLoading(false);
    }).catch((err) => {
      if (alive) { setError(err?.message || "Toko belum dapat dimuat."); setLoading(false); }
    });
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    if (!storeId) return undefined;
    localStorage.setItem(`${STORE_KEY}:${user.id}`, storeId);
    setActiveTickets([]);
    setServedTickets([]);
    setLoading(true);
    setConnection("connecting");
    refreshTickets().finally(() => setLoading(false));
    const unsubscribe = subscribeKdsTickets(storeId, (event) => {
      if (event.eventType === "INSERT" && event.new?.kind !== "cancel" && event.new?.status === "new" && soundEnabled) playTicketSound();
      refreshTickets();
    }, (status) => {
      if (status === "SUBSCRIBED") {
        setConnection("live");
        refreshTickets();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        setConnection("offline");
      }
    });
    return unsubscribe;
  }, [storeId, user.id, refreshTickets, soundEnabled]);

  useEffect(() => {
    if (!storeId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`denpos-kds-dismissed:${user.id}:${storeId}`) || "[]");
      setDismissedTicketIds(new Set(Array.isArray(stored) ? stored : []));
    } catch { setDismissedTicketIds(new Set()); }
  }, [storeId, user.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const stationOptions = useMemo(() => {
    const labels = new Set(stations.map((station) => station.label).filter(Boolean));
    activeTickets.forEach((ticket) => {
      if (ticket.station_label) labels.add(ticket.station_label);
    });
    servedTickets.forEach((ticket) => { if (ticket.station_label) labels.add(ticket.station_label); });
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [stations, activeTickets, servedTickets]);

  const visibleActive = activeTickets.filter((ticket) => stationLabel === "all" || ticket.station_label === stationLabel);
  const visibleServed = servedTickets.filter((ticket) => stationLabel === "all" || ticket.station_label === stationLabel);
  const dismissTicket = (ticketId) => setDismissedTicketIds((current) => {
    const next = new Set(current).add(ticketId);
    localStorage.setItem(`denpos-kds-dismissed:${user.id}:${storeId}`, JSON.stringify([...next]));
    return next;
  });

  const handleSetStatus = async (ticket, status) => {
    setBusyId(ticket.id);
    try {
      await setKdsTicketStatus(ticket.id, status);
      await refreshTickets();
    } catch (err) {
      await refreshTickets();
      setError(err?.message?.includes("INVALID_STATUS_TRANSITION")
        ? "Pesanan berubah di perangkat lain. Data sudah diperbarui."
        : err?.message || "Status pesanan gagal diperbarui.");
    } finally {
      setBusyId("");
    }
  };

  const loadOlder = async () => {
    setLoadingMore(true);
    try {
      const result = await loadKdsTickets(storeId, { activeOffset: activeTickets.length });
      setActiveTickets((current) => [...current, ...result.active]);
      setHasMore(result.hasMoreActive);
    } catch (err) {
      setError(err?.message || "Pesanan lama gagal dimuat.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("denpos-kds-sound", next ? "on" : "off");
    if (next) playTicketSound();
  };

  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { setError("Mode layar penuh tidak tersedia di browser ini."); }
  };

  const lanes = STAGES.map((status) => ({
    status,
    tickets: visibleActive.filter((ticket) => ticket.kind !== "cancel" && ticket.status === status),
  }));
  const cancelled = visibleActive.filter((ticket) => (ticket.kind === "cancel" || ticket.status === "cancelled") && !dismissedTicketIds.has(ticket.id));

  return (
    <main className="kds-shell" ref={rootRef}>
      <header className="kds-topbar">
        <div className="kds-brand-block">
          <Link to="/laporan" className="kds-exit" aria-label="Kembali ke monitoring"><FiArrowLeft /></Link>
          <div><strong>Layar Dapur</strong><span>{selectedStore?.name || "DEN POS"}</span></div>
        </div>
        <div className="kds-controls">
          {stores.length > 1 && <label className="kds-select-wrap"><span>Toko</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
          {stationOptions.length > 0 && <label className="kds-select-wrap"><span>Stasiun</span><select value={stationLabel} onChange={(event) => setStationLabel(event.target.value)}><option value="all">Semua</option>{stationOptions.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>}
          <button className="kds-icon-button" title={soundEnabled ? "Matikan bunyi pesanan" : "Nyalakan bunyi pesanan"} aria-label={soundEnabled ? "Matikan bunyi pesanan" : "Nyalakan bunyi pesanan"} onClick={toggleSound}>{soundEnabled ? <FiVolume2 /> : <FiVolumeX />}</button>
          <button className="kds-icon-button" title={fullScreen ? "Keluar layar penuh" : "Layar penuh"} aria-label={fullScreen ? "Keluar layar penuh" : "Layar penuh"} onClick={toggleFullScreen}>{fullScreen ? <FiMinimize /> : <FiMaximize />}</button>
          <button className="kds-icon-button" title="Muat ulang pesanan" aria-label="Muat ulang pesanan" onClick={refreshTickets}><FiRefreshCw /></button>
          <button className="kds-logout" onClick={onLogout}>Keluar</button>
        </div>
      </header>

      <div className={`kds-connection kds-connection-${connection}`}>
        <span className="kds-connection-dot" />
        {connection === "live" ? "Tersambung langsung" : connection === "offline" ? `Terputus${lastUpdated ? ` · data terakhir ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : " · menunggu koneksi"}` : "Menghubungkan…"}
        {lastUpdated && <span className="kds-updated">Pembaruan {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>

      {error && <div className="kds-error" role="alert"><span>{error}</span><button onClick={() => { setError(""); refreshTickets(); }}>Coba lagi</button></div>}
      {loading ? <div className="kds-empty">Memuat pesanan…</div>
        : !stores.length ? <div className="kds-empty">Akun ini belum terhubung ke toko.</div>
          : !stationOptions.length && !activeTickets.length ? <div className="kds-empty">Belum ada stasiun atau pesanan.</div>
            : !visibleActive.length && !visibleServed.length ? <div className="kds-empty">Belum ada pesanan.</div>
              : <section className="kds-board" aria-label="Antrean pesanan">
                {lanes.map(({ status, tickets }) => <section className={`kds-lane kds-lane-${status}`} key={status}>
                  <header className="kds-lane-head"><h2>{KDS_STATUS_LABEL[status]}</h2><span>{tickets.length}</span></header>
                  <div className="kds-lane-list">
                    {tickets.map((ticket) => <Ticket key={ticket.id} ticket={ticket} now={now} busy={busyId === ticket.id} onSetStatus={handleSetStatus} onDismiss={dismissTicket} />)}
                    {!tickets.length && <p className="kds-lane-empty">Kosong</p>}
                  </div>
                </section>)}
              </section>}

      {hasMore && <button className="kds-load-more" disabled={loadingMore} onClick={loadOlder}>{loadingMore ? "Memuat…" : "Muat pesanan sebelumnya"}</button>}

      {cancelled.length > 0 && <section className="kds-cancelled-section">
        <button className="kds-cancelled-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
          {KDS_STATUS_LABEL.cancelled} · {cancelled.length} {historyOpen ? "−" : "+"}
        </button>
        {historyOpen && <div className="kds-cancelled-list">{cancelled.map((ticket) => <Ticket key={ticket.id} ticket={ticket} now={now} busy={busyId === ticket.id} onSetStatus={handleSetStatus} onDismiss={dismissTicket} />)}</div>}
      </section>}

      {visibleServed.length > 0 && <section className="kds-history-section">
        <button className="kds-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>Riwayat singkat · {visibleServed.length}</button>
        {historyOpen && <div className="kds-history-list">{visibleServed.map((ticket) => <Ticket key={ticket.id} ticket={ticket} now={now} busy={busyId === ticket.id} onSetStatus={handleSetStatus} onDismiss={dismissTicket} />)}</div>}
      </section>}
    </main>
  );
}