import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { attendanceService } from "../services/attendanceService";

const ERROR_MESSAGES = {
  DEVICE_NOT_APPROVED: "Perangkat ini menunggu persetujuan admin di DEN POS.",
  DEVICE_REVOKED: "Perangkat ini sudah dinonaktifkan oleh admin.",
  DEVICE_LIMIT_REACHED: "Batas dua perangkat untuk akun ini sudah tercapai. Minta admin menonaktifkan perangkat lama.",
  NO_ACTIVE_LOCATION: "Admin belum mengaktifkan lokasi presensi.",
  OUTSIDE_GEOFENCE: "Anda berada di luar radius lokasi presensi.",
  ACCURACY_TOO_LOW: "Akurasi GPS belum memenuhi batas. Coba lagi di area terbuka.",
  ALREADY_CHECKED_IN: "Masih ada sesi presensi aktif. Lakukan presensi keluar terlebih dahulu.",
  ATTENDANCE_NOT_STARTED: "Tidak ada sesi presensi aktif untuk ditutup.",
  ATTENDANCE_OTHER_STORE: "Sesi aktif Anda berasal dari toko lain. Minta admin toko tersebut membantu.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.",
  INVALID_LOCATION: "Koordinat atau akurasi GPS tidak valid. Coba ambil lokasi kembali.",
};

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser ini tidak menyediakan GPS. Gunakan browser modern melalui HTTPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const message = error.code === 1
        ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini."
        : error.code === 2
        ? "GPS tidak tersedia. Aktifkan layanan lokasi dan coba di area terbuka."
        : error.code === 3
        ? "Pencarian GPS melewati batas waktu. Silakan coba lagi."
        : "Lokasi tidak tersedia. Pastikan situs dibuka melalui HTTPS.";
      reject(new Error(message));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

function distanceMeters(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

export default function EmployeeAttendanceView({ user }) {
  const [membership, setMembership] = useState(null);
  const [device, setDevice] = useState(null);
  const [locations, setLocations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deviceError, setDeviceError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const member = await attendanceService.membership();
      setMembership(member);
      if (!member) {
        setDevice(null);
        setLocations([]);
        setSessions([]);
        setActiveSession(null);
        return;
      }

      const [activeLocations, ownSessions, active] = await Promise.all([
        attendanceService.activeLocations(member.store_id),
        attendanceService.mySessions(member.store_id, user?.id),
        attendanceService.myActiveSession(user?.id),
      ]);
      setLocations(activeLocations);
      setSessions(ownSessions);
      setActiveSession(active);

      try {
        const registration = await attendanceService.registerDevice(member.store_id);
        setDevice(registration);
        setDeviceError("");
      } catch (deviceRegistrationError) {
        setDevice(null);
        setDeviceError(ERROR_MESSAGES[deviceRegistrationError.message] || deviceRegistrationError.message);
      }
    } catch (loadError) {
      setError(loadError.message || "Data presensi belum dapat dimuat. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshLocation = useCallback(async () => {
    setLocationError("");
    try {
      const next = await getPosition();
      setPosition({
        latitude: next.coords.latitude,
        longitude: next.coords.longitude,
        accuracy: next.coords.accuracy,
      });
      if (device?.status === "active") {
        await attendanceService.recordLocation(attendanceService.deviceUuid(), next);
      }
    } catch (locationErr) {
      setLocationError(locationErr.message || "Lokasi gagal diperbarui.");
    }
  }, [device?.status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (device?.status === "active") refreshLocation();
  }, [device?.status, membership?.store_id, refreshLocation]);

  useEffect(() => {
    if (!membership || device?.status !== "active") return undefined;
    const stop = attendanceService.subscribeLocationRefresh(
      membership.store_id,
      () => { refreshLocation(); },
    );
    return stop;
  }, [membership?.store_id, device?.status, refreshLocation]);

  useEffect(() => {
    if (!device || device.status !== "active") return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        attendanceService.heartbeat(attendanceService.deviceUuid()).catch((heartbeatError) => {
          setDeviceError(heartbeatError.message || "Status perangkat gagal diperbarui.");
        });
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [device?.status]);

  const nearestLocation = useMemo(() => {
    if (!position || !locations.length) return null;
    return locations
      .map((location) => ({ ...location, distance: distanceMeters(position, location) }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [locations, position]);

  const submit = async (type) => {
    if (!membership || !device || device.status !== "active" || busy) return;
    const label = type === "check_in" ? "presensi masuk" : "presensi keluar";
    if (!window.confirm(`Lanjutkan ${label} menggunakan lokasi GPS saat ini?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const freshPosition = await getPosition();
      setPosition({
        latitude: freshPosition.coords.latitude,
        longitude: freshPosition.coords.longitude,
        accuracy: freshPosition.coords.accuracy,
      });
      const result = await attendanceService.submit(
        type,
        membership.store_id,
        attendanceService.deviceUuid(),
        freshPosition,
      );
      setNotice(`${label[0].toUpperCase()}${label.slice(1)} berhasil dicatat pada ${formatTime(result.recordedAt)}.`);
      await load();
    } catch (submitError) {
      setError(ERROR_MESSAGES[submitError.message] || submitError.message || "Presensi gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const activeElsewhere = activeSession && activeSession.store_id !== membership?.store_id;
  const canSubmit = device?.status === "active" && locations.length > 0 && !activeElsewhere;

  return <section className="mx-auto max-w-4xl px-4 py-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">DEN POS Monitor</p>
        <h1 className="text-2xl font-bold text-gray-900">Presensi</h1>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={refreshLocation} disabled={busy} className="min-h-11 rounded border border-gray-300 bg-white px-4 text-sm font-semibold">Perbarui lokasi</button>
        <button type="button" onClick={load} disabled={loading} className="min-h-11 rounded border border-gray-300 bg-white px-4 text-sm font-semibold">Muat ulang</button>
      </div>
    </header>

    {loading ? <p className="py-10 text-center text-gray-600">Memuat presensi…</p> : error ?
      <div role="alert" className="border-l-4 border-red-500 bg-white p-5 text-sm text-red-800">
        {error} Fitur kasir dan halaman web lainnya tetap dapat digunakan.
        <button type="button" onClick={load} className="ml-2 font-bold underline">Coba lagi</button>
      </div>
      : !membership ?
        <div className="border-l-4 border-orange-500 bg-white p-5">
          <h2 className="font-bold">Akun belum terhubung ke toko</h2>
          <p className="mt-1 text-sm text-gray-600">Minta admin menghubungkan akun ini ke toko DEN POS.</p>
        </div>
        : <>
          <div className="mb-4 border-b border-gray-300 bg-white p-4">
            <p className="text-sm text-gray-600">{user?.email || user?.name || user?.username}</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {device?.status === "active" ? "Perangkat disetujui" : device?.status === "pending" ? "Menunggu persetujuan perangkat" : "Status perangkat belum tersedia"}
            </p>
          </div>

          {deviceError && <p role="alert" className="mb-4 border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900">{deviceError}</p>}
          {locationError && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{locationError}</p>}
          {error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mb-4 border border-green-300 bg-green-50 p-4 text-sm text-green-900">{notice}</p>}

          <div className="mb-4 border-b border-gray-300 bg-white p-5">
            <h2 className="mb-2 font-bold text-gray-900">Lokasi perangkat</h2>
            {position ? <>
              <p className="text-sm text-gray-700">Akurasi GPS: <b>{Math.round(position.accuracy)} m</b></p>
              {nearestLocation && <p className="mt-1 text-sm text-gray-700">
                Jarak ke {nearestLocation.name}: <b>{Math.round(nearestLocation.distance)} m</b> (radius {nearestLocation.radius_m} m)
              </p>}
            </> : <p className="text-sm text-gray-600">Belum ada lokasi. Izinkan akses lokasi lalu pilih “Perbarui lokasi”.</p>}
            {!locations.length && <p className="mt-2 text-sm text-orange-800">Belum ada lokasi aktif dari admin DEN POS.</p>}
          </div>

          <div className="border-b border-gray-300 bg-white p-5">
            {activeElsewhere ? <p role="alert" className="border-l-4 border-orange-600 bg-orange-50 p-4 text-sm text-orange-900">Anda masih memiliki sesi aktif di toko lain. Selesaikan presensi di toko asal.</p>
              : activeSession ? <div>
                <p className="mb-3 text-sm text-green-900">Presensi masuk: <b>{formatTime(activeSession.checked_in_at)}</b></p>
                <button onClick={() => submit("check_out")} disabled={!canSubmit || busy} className="min-h-12 w-full rounded bg-orange-700 px-5 font-bold text-white disabled:opacity-60">
                  {busy ? "Memvalidasi lokasi…" : "Presensi Keluar"}
                </button>
              </div> : <button onClick={() => submit("check_in")} disabled={!canSubmit || busy} className="min-h-12 w-full rounded bg-green-800 px-5 font-bold text-white disabled:opacity-60">
                {busy ? "Memvalidasi lokasi…" : "Presensi Masuk"}
              </button>}
            <p className="mt-3 text-xs text-gray-500">Lokasi hanya diambil saat halaman dibuka, tombol ditekan, atau admin meminta pembaruan. Browser harus mengizinkan lokasi dan memakai HTTPS.</p>
          </div>

          <div className="mt-6 border-t border-gray-300 pt-4">
            <h2 className="mb-3 font-bold text-gray-900">Riwayat presensi</h2>
            {sessions.length ? <div className="divide-y divide-gray-200 bg-white">
              {sessions.map((session) => <div key={session.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                <span>Masuk {formatTime(session.checked_in_at)} · {session.user_email || user?.email}</span>
                <span className={session.status === "checked_in" ? "font-semibold text-green-800" : "text-gray-500"}>
                  {session.status === "checked_in" ? "Sedang bekerja" : session.status === "overridden" ? "Ditutup admin" : `Keluar ${formatTime(session.checked_out_at)}`}
                </span>
              </div>)}
            </div> : <p className="bg-white p-4 text-sm text-gray-500">Belum ada riwayat presensi.</p>}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Butuh presensi shift POS lama? <Link to="/presensi-shift" className="font-semibold text-green-800 underline">Buka presensi shift</Link>
          </p>
        </>}
  </section>;
}
