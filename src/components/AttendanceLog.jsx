import { useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";

export default function AttendanceLog() {
  const [rows, setRows] = useState([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    attendanceService.membership()
      .then(async (membership) => {
        if (!alive || !membership || !["manager", "admin"].includes(membership.web_role)) return;
        setRole(membership.web_role);
        const data = await attendanceService.report(membership.store_id);
        if (alive) setRows(data);
      })
      .catch((err) => { if (alive) setError(err.message || "Gagal memuat log presensi."); });
    return () => { alive = false; };
  }, []);

  if (!role && !error) return null;
  return <section className="attendance-print-area mb-8 border-t border-gray-300 pt-6">
    <style>{`@media print { body * { visibility: hidden !important; } .attendance-print-area, .attendance-print-area * { visibility: visible !important; } .attendance-print-area { position: absolute; inset: 0; width: 100%; padding: 20px; } .attendance-print-area button { display: none !important; } }`}</style>
    <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-900">Log Presensi</h2><p className="text-xs text-gray-500">Maksimal 1.000 catatan terbaru</p></div>
      <button type="button" onClick={() => window.print()} disabled={!rows.length} className="min-h-10 rounded bg-green-800 px-3 text-sm font-semibold text-white disabled:opacity-50">Cetak / Simpan PDF</button></div>
    {error ? <p role="alert" className="bg-red-50 p-3 text-sm text-red-800">{error}</p> : rows.length ? <div className="overflow-x-auto bg-white"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead><tr className="border-b border-gray-300 text-xs uppercase text-gray-500"><th className="p-3">Shift</th><th className="p-3">Pengguna</th><th className="p-3">Masuk</th><th className="p-3">Keluar</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-gray-200"><td className="p-3">{row.attendance_shifts?.shift_num || "-"}</td><td className="p-3">{row.user_label}</td><td className="p-3">{new Date(row.checked_in_at).toLocaleString("id-ID")}</td><td className="p-3">{row.checked_out_at ? new Date(row.checked_out_at).toLocaleString("id-ID") : "Belum presensi keluar"}</td><td className="p-3">{row.checkout_overwritten ? "Ditutup admin" : row.status === "checked_out" ? "Selesai" : "Sedang bertugas"}</td></tr>)}</tbody></table></div> : <p className="bg-white p-4 text-sm text-gray-500">Belum ada catatan presensi.</p>}
  </section>;
}