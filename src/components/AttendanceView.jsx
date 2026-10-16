import { useCallback, useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";

const ROLE_NAMES = { kasir: "Kasir", bar: "Bar", purchasing: "Purchasing", manager: "Manager", admin: "Admin" };
const ERROR_MESSAGES = {
  OUTSIDE_GEOFENCE: "Lokasi Anda berada di luar batas presensi. Pastikan GPS aktif dan Anda berada dekat perangkat DEN POS.",
  POS_LOCATION_UNAVAILABLE: "DEN POS belum mengirim lokasi. Minta admin membuka shift setelah mengaktifkan lokasi perangkat.",
  SHIFT_NOT_OPEN: "Shift sudah ditutup. Presensi hanya dapat dilakukan saat shift aktif.",
  ALREADY_CHECKED_IN: "Anda sudah presensi masuk pada shift ini.",
  ALREADY_CHECKED_OUT: "Anda sudah presensi keluar pada shift ini.",
  ATTENDANCE_NOT_STARTED: "Anda belum presensi masuk pada shift ini.",
};

function locationError(error) {
  if (error?.code === 1) return "Izin lokasi ditolak. Aktifkan izin Lokasi untuk browser ini di pengaturan perangkat, lalu muat ulang halaman.";
  if (error?.code === 2) return "Lokasi tidak ditemukan. Aktifkan GPS/Layanan Lokasi, matikan mode pesawat, lalu coba di area terbuka.";
  if (error?.code === 3) return "Pencarian lokasi terlalu lama. Pastikan GPS aktif dan coba lagi.";
  return "Perangkat tidak mendukung lokasi atau halaman tidak menggunakan HTTPS. Buka kembali melalui koneksi aman.";
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error(locationError())); return; }
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(locationError(error))), {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

export default function AttendanceView({ user }) {
  const [membership, setMembership] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [radius, setRadius] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const member = await attendanceService.membership();
      setMembership(member);
      if (!member) return;
      const [shiftRows, settings] = await Promise.all([
        attendanceService.shifts(member.store_id), attendanceService.settings(member.store_id),
      ]);
      setShifts(shiftRows);
      setRadius(settings.radius_m || 20);
      const openShift = shiftRows.find((shift) => shift.status === "open");
      setSessions(openShift ? await attendanceService.sessions(member.store_id, openShift.id) : []);
    } catch (err) { setError(err.message || "Gagal memuat data presensi."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeShift = shifts.find((shift) => shift.status === "open");
  const ownSession = sessions.find((session) => session.user_id === user?.id);
  const submitAttendance = async (type) => {
    if (!activeShift || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const position = await getPosition();
      await attendanceService[type](activeShift.id, position);
      setNotice(type === "checkIn" ? "Presensi masuk berhasil dicatat." : "Presensi keluar berhasil dicatat.");
      await load();
    } catch (err) {
      const key = String(err.message || "").match(/[A-Z_]{4,}/)?.[0];
      setError(ERROR_MESSAGES[key] || err.message || "Presensi gagal. Periksa koneksi lalu coba lagi.");
    } finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-4xl px-4 py-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wide text-orange-700">DEN POS Monitor</p><h1 className="text-2xl font-bold text-gray-900">Presensi</h1></div>
      <button type="button" onClick={load} className="min-h-11 rounded border border-gray-300 bg-white px-4 text-sm font-semibold" disabled={loading}>Muat ulang</button>
    </header>
    {loading ? <p className="py-10 text-center text-gray-600">Memuat presensi…</p> : !membership ?
      <div className="border-l-4 border-orange-500 bg-white p-5"><h2 className="font-bold">Akun belum terhubung ke toko</h2><p className="mt-1 text-sm text-gray-600">Minta admin DEN POS menambahkan akun web-app Anda ke toko yang tersinkron.</p></div> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 bg-white p-4">
        <div><p className="text-sm text-gray-600">{ROLE_NAMES[membership.web_role] || membership.web_role} · {user?.name || user?.username}</p>
          {activeShift ? <p className="mt-1 font-semibold text-green-800">Shift {activeShift.shift_num || "aktif"} · {activeShift.operator_label || "DEN POS"}</p> : <p className="mt-1 font-semibold text-red-700">Belum ada shift aktif dari DEN POS</p>}</div>
        <p className="text-xs text-gray-600">Batas lokasi presensi ditetapkan oleh admin di software DEN POS.</p>
      </div>
      {error && <div role="alert" className="mb-4 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-4 border border-green-300 bg-green-50 p-4 text-sm text-green-900">{notice}</div>}
      {activeShift ? <div className="border-b border-gray-300 bg-white p-5">
        <p className="mb-4 text-sm text-gray-700">Jarak maksimum dari perangkat kasir: <b>{activeShift.radius_m || radius} m</b>.</p>
        {!ownSession ? <button onClick={() => submitAttendance("checkIn")} disabled={busy} className="min-h-12 w-full rounded bg-green-800 px-5 font-bold text-white disabled:opacity-60">{busy ? "Mencari lokasi…" : "Presensi Masuk"}</button> : ownSession.status === "checked_in" ? <button onClick={() => submitAttendance("checkOut")} disabled={busy} className="min-h-12 w-full rounded bg-orange-700 px-5 font-bold text-white disabled:opacity-60">{busy ? "Mencari lokasi…" : "Presensi Keluar"}</button> : <p className="border-l-4 border-green-700 bg-green-50 p-4 font-semibold">Presensi shift ini selesai{ownSession.status === "overridden" ? " (ditutup oleh admin DEN POS)" : ""}.</p>}
        <p className="mt-3 text-xs text-gray-500">Lokasi hanya digunakan saat Anda menekan tombol presensi. Izinkan akses lokasi saat diminta.</p>
      </div> : <div className="bg-white p-5 text-sm text-gray-600">Presensi tersedia setelah perangkat DEN POS tersinkron membuka shift.</div>}
      <div className="mt-6 border-t border-gray-300 pt-4"><h2 className="mb-3 font-bold text-gray-900">Riwayat shift</h2>{shifts.length ? <div className="divide-y divide-gray-200 bg-white">{shifts.slice(0, 10).map((shift) => <div key={shift.id} className="flex justify-between gap-3 p-3 text-sm"><span>Shift {shift.shift_num || "-"} · {shift.operator_label || "DEN POS"}</span><span className={shift.status === "open" ? "font-semibold text-green-800" : "text-gray-500"}>{shift.status === "open" ? "Aktif" : "Ditutup"}</span></div>)}</div> : <p className="text-sm text-gray-500">Belum ada shift tersinkron.</p>}</div>
    </>}
  </section>;
}