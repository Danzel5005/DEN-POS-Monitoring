import { useState } from "react";
import { authService } from "../services/authService";

const G = "#1a5c38", W = "#fff", BD = "#e0e0d8", MT = "#888";

// AccountView — ganti password sendiri (user sudah login).
export default function AccountView({ user }) {
  const [form, setForm] = useState({ next: "", confirm: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.next !== form.confirm) { setMsg({ type: "err", text: "Konfirmasi password tidak sama." }); return; }
    setBusy(true);
    const res = await authService.changePassword(form.next);
    setBusy(false);
    if (res.ok) { setMsg({ type: "ok", text: "Password berhasil diubah." }); setForm({ next: "", confirm: "" }); }
    else setMsg({ type: "err", text: res.error });
  };

  const input = { width: "100%", padding: "10px 12px", border: `1px solid ${BD}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div>
      <h1 style={{ color: G, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Akun Saya</h1>
      <p style={{ color: MT, fontSize: 13, marginBottom: 16 }}>Kelola akun dan password Anda.</p>

      <div style={{ background: W, border: `1px solid ${BD}`, borderRadius: 12, padding: 16, maxWidth: 420 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: MT, fontSize: 11 }}>Username</div>
          <div style={{ color: G, fontWeight: 700 }}>@{user?.username}</div>
        </div>
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#555" }}>Password baru</label>
            <input type="password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} placeholder="Minimal 6 karakter" style={input} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#555" }}>Ulangi password baru</label>
            <input type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Ulangi password" style={input} />
          </div>
          {msg && (
            <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, background: msg.type === "ok" ? "#e8f5ee" : "#ffebee", color: msg.type === "ok" ? G : "#d32f2f" }}>
              {msg.text}
            </div>
          )}
          <button type="submit" disabled={busy || form.next.length < 6}
            style={{ padding: "10px 16px", background: busy ? "#aaa" : G, color: W, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Menyimpan…" : "Simpan Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
