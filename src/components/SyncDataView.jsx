import { useState, useEffect } from "react";
import { syncDataService } from "../services/syncService";

const G = "#1a5c38", W = "#fff", BD = "#e0e0d8", TX = "#1a1a1a", MT = "#888";

function rupiah(n) {
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}
function fmt(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

// SyncDataView — transaksi yang tersinkron dari perangkat POS ke cloud.
// RLS di database menjamin user hanya melihat data store miliknya.
export default function SyncDataView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    syncDataService.listTransactions({ limit }).then((data) => {
      if (alive) { setRows(data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [limit]);

  const total = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);

  const card = { background: W, border: `1px solid ${BD}`, borderRadius: 12, overflow: "hidden" };

  return (
    <div>
      <h1 style={{ color: G, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Data Tersinkron</h1>
      <p style={{ color: MT, fontSize: 13, marginBottom: 16 }}>
        Transaksi yang dikirim otomatis dari perangkat POS Anda.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140, background: W, border: `1px solid ${BD}`, borderRadius: 12, padding: 14 }}>
          <div style={{ color: MT, fontSize: 11 }}>Jumlah transaksi</div>
          <div style={{ color: G, fontSize: 22, fontWeight: 800 }}>{rows.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: W, border: `1px solid ${BD}`, borderRadius: 12, padding: 14 }}>
          <div style={{ color: MT, fontSize: 11 }}>Total nilai</div>
          <div style={{ color: G, fontSize: 22, fontWeight: 800 }}>{rupiah(total)}</div>
        </div>
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ padding: 20, color: MT, fontSize: 13 }}>Memuat…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 20, color: MT, fontSize: 13 }}>
            Belum ada data tersinkron. Hubungkan perangkat & tunggu sinkronisasi otomatis (tiap 5 menit).
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fafaf7", color: MT, textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Waktu</th>
                  <th style={{ padding: "10px 12px" }}>No. Transaksi</th>
                  <th style={{ padding: "10px 12px" }}>Pelanggan</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "10px 12px" }}>Metode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.trxId || i} style={{ borderTop: `1px solid ${BD}`, color: TX }}>
                    <td style={{ padding: "9px 12px" }}>{fmt(r.occurredAt || r.createdAt)}</td>
                    <td style={{ padding: "9px 12px", fontFamily: "monospace" }}>{r.trxId || r.id || "—"}</td>
                    <td style={{ padding: "9px 12px" }}>{r.customerName || r.customer || "—"}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>{rupiah(r.total)}</td>
                    <td style={{ padding: "9px 12px" }}>{r.metode || r.paymentMethod || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length >= limit && (
        <button onClick={() => setLimit((n) => n + 100)}
          style={{ marginTop: 12, padding: "8px 16px", background: W, border: `1px solid ${BD}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: G, cursor: "pointer" }}>
          Muat 100 lagi
        </button>
      )}
    </div>
  );
}
