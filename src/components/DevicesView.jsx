import { useState, useEffect, useCallback } from "react";
import { deviceService } from "../services/syncService";

const G = "#1a5c38", OR = "#e87c2a", W = "#fff", BG = "#f5f5f0", BD = "#e0e0d8", TX = "#1a1a1a", MT = "#888";

const STATUS_STYLE = {
  active: { bg: "#e8f5ee", color: G, label: "Aktif" },
  pending: { bg: "#fff0e8", color: "#c05a00", label: "Menunggu" },
  revoked: { bg: "#ffebee", color: "#d32f2f", label: "Dicabut" },
};

function Pill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "#eee", color: MT, label: status || "-" };
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
}

function fmt(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

export default function DevicesView() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setDevices(await deviceService.listDevices());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doPair = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await deviceService.pair(code);
    if (res.ok) {
      setMsg({ type: "ok", text: `Berhasil! Perangkat terhubung ke "${res.storeName || "toko Anda"}".` });
      setCode("");
      await load();
    } else {
      setMsg({ type: "err", text: res.error });
    }
    setBusy(false);
  };

  const toggle = async (dev) => {
    const isRevoked = dev.status === "revoked";
    const fn = isRevoked ? deviceService.activateDevice : deviceService.revokeDevice;
    const res = await fn(dev.device_id);
    if (res.ok) { setMsg({ type: "ok", text: isRevoked ? "Perangkat diaktifkan." : "Perangkat dicabut." }); await load(); }
    else setMsg({ type: "err", text: res.error });
  };

  const card = { background: W, border: `1px solid ${BD}`, borderRadius: 12, padding: 16, marginBottom: 16 };

  return (
    <div>
      <h1 style={{ color: G, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Hubungkan Perangkat</h1>
      <p style={{ color: MT, fontSize: 13, marginBottom: 16 }}>
        Masukkan kode pairing dari aplikasi DEN POS (Pengaturan → Sync Cloud).
      </p>

      {/* Form pairing */}
      <div style={card}>
        <form onSubmit={doPair} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kode pairing (mis. 9WMF3J99)"
            maxLength={12}
            style={{ flex: 1, minWidth: 200, padding: "10px 12px", border: `1px solid ${BD}`, borderRadius: 8, fontSize: 16, letterSpacing: 2, fontFamily: "monospace", outline: "none" }}
            disabled={busy}
          />
          <button type="submit" disabled={busy || code.trim().length < 4}
            style={{ padding: "10px 18px", background: busy ? "#aaa" : G, color: W, border: "none", borderRadius: 8, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontSize: 13 }}>
            {busy ? "Menghubungkan…" : "Hubungkan"}
          </button>
        </form>
        {msg && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12, background: msg.type === "ok" ? "#e8f5ee" : "#ffebee", color: msg.type === "ok" ? G : "#d32f2f" }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Daftar perangkat */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BD}`, fontWeight: 700, color: G, fontSize: 14 }}>
          Perangkat Terhubung ({devices.length})
        </div>
        {loading ? (
          <div style={{ padding: 20, color: MT, fontSize: 13 }}>Memuat…</div>
        ) : devices.length === 0 ? (
          <div style={{ padding: 20, color: MT, fontSize: 13 }}>Belum ada perangkat. Hubungkan lewat kode di atas.</div>
        ) : (
          devices.map((d) => (
            <div key={d.device_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: `1px solid ${BD}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: TX, fontSize: 13 }}>{d.device_name || "Perangkat POS"}</div>
                <div style={{ color: MT, fontSize: 11, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{d.device_id}</div>
                <div style={{ color: MT, fontSize: 11 }}>Terakhir online: {fmt(d.last_seen_at)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Pill status={d.status} />
                <button onClick={() => toggle(d)}
                  style={{ padding: "6px 12px", background: W, border: `1px solid ${d.status === "revoked" ? G : "#d32f2f"}`, color: d.status === "revoked" ? G : "#d32f2f", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {d.status === "revoked" ? "Aktifkan" : "Cabut"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <p style={{ color: MT, fontSize: 11 }}>
        Perangkat yang dicabut akan berhenti mengirim data; aplikasi POS menandai perangkat "belum terpasang" otomatis.
      </p>
    </div>
  );
}
