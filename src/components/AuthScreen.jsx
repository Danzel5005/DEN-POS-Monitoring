import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

// AuthScreen — Login & Daftar akun (Supabase Auth, satu project milik pemilik
// aplikasi). User cukup mengetik USERNAME (bukan email); konversi ke email
// internal dilakukan di authService.
export default function AuthScreen({ onLogin }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ username: "", password: "", name: "", confirm: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!form.username || !form.password) { setError("Username dan password wajib diisi."); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await authService.signIn({ username: form.username, password: form.password });
        if (!res.ok) { setError(res.error); return; }
        onLogin(res.user);
        navigate("/laporan", { replace: true });
      } else {
        if (form.password !== form.confirm) { setError("Konfirmasi password tidak sama."); return; }
        const res = await authService.signUp({ username: form.username, password: form.password, name: form.name });
        if (!res.ok) { setError(res.error); return; }
        if (res.needsEmailConfirmation) {
          setInfo("Akun dibuat. Cek email konfirmasi, lalu login.");
          setMode("login");
          return;
        }
        onLogin(res.user);
        navigate("/laporan", { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { border: "1.5px solid #e0e0d8", fontSize: 13, outline: "none" };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #1a5c38 0%, #0f3d24 100%)", fontFamily: "'Segoe UI', sans-serif" }}>
      <div className="w-full max-w-md p-8" style={{ background: "#ffffff", borderRadius: 18, boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "#1a5c38" }}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a5c38" }}>DEN POS Monitor</h1>
          <p className="mt-1" style={{ color: "#888", fontSize: 12 }}>
            {mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}
          </p>
        </div>

        {!authService.configured && (
          <div className="px-4 py-3 rounded-lg text-xs mb-4" style={{ background: "#fff0e8", border: "1px solid #e0e0d8", color: "#c05a00" }}>
            Supabase belum dikonfigurasi. Isi <code>VITE_SUPABASE_URL</code> dan
            <code> VITE_SUPABASE_ANON_KEY</code> di file <code>.env</code>.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <input type="text" value={form.name} onChange={set("name")} className="w-full px-4 py-3 rounded-lg" style={inputStyle} placeholder="Nama Anda (opsional)" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input type="text" value={form.username} onChange={set("username")} className="w-full px-4 py-3 rounded-lg" style={inputStyle} placeholder="mis. admin" autoComplete="username" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={form.password} onChange={set("password")} className="w-full px-4 py-3 rounded-lg" style={inputStyle} placeholder="Minimal 6 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ulangi Password</label>
              <input type="password" value={form.confirm} onChange={set("confirm")} className="w-full px-4 py-3 rounded-lg" style={inputStyle} placeholder="Ulangi password" autoComplete="new-password" />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#ffebee", color: "#d32f2f" }}>{error}</div>
          )}
          {info && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#e8f5ee", color: "#1a5c38" }}>{info}</div>
          )}

          <button type="submit" disabled={loading} className="w-full text-white py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: loading ? "#aaa" : "#1a5c38", fontSize: 13, fontWeight: 700 }}>
            {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm" style={{ color: "#888" }}>
          {mode === "login" ? (
            <>Belum punya akun?{" "}
              <button onClick={() => { setMode("register"); setError(""); setInfo(""); }} style={{ color: "#1a5c38", fontWeight: 700 }}>Daftar</button>
            </>
          ) : (
            <>Sudah punya akun?{" "}
              <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} style={{ color: "#1a5c38", fontWeight: 700 }}>Masuk</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
