import { supabase } from "./supabaseClient";

function resultOrThrow({ data, error }) {
  if (error) throw new Error(error.message || "Permintaan presensi gagal.");
  return data;
}

function getAttendanceDeviceUuid() {
  const key = "denpos.attendance.device_uuid";
  const stored = localStorage.getItem(key);
  if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
  if (!globalThis.crypto?.randomUUID) throw new Error("Browser aman (HTTPS) diperlukan untuk mendaftarkan perangkat.");
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export const attendanceService = {
  deviceUuid: getAttendanceDeviceUuid,

  async membership() {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!authData.user) return null;
    const { data, error } = await supabase.from("store_users")
      .select("store_id, web_role, membership_status, permission")
      .eq("user_id", authData.user.id)
      .eq("membership_status", "active").limit(1).maybeSingle();
    return resultOrThrow({ data, error });
  },

  async shifts(storeId, limit = 50) {
    const { data, error } = await supabase.from("attendance_shifts")
      .select("id, pos_shift_id, shift_num, operator_label, status, opened_at, closed_at, latitude, longitude, radius_m")
      .eq("store_id", storeId).order("opened_at", { ascending: false }).limit(limit);
    return resultOrThrow({ data, error }) || [];
  },

  async settings(storeId) {
    const { data, error } = await supabase.from("attendance_settings")
      .select("radius_m").eq("store_id", storeId).maybeSingle();
    return resultOrThrow({ data, error }) || { radius_m: 20 };
  },

  async sessions(storeId, shiftId) {
    const { data, error } = await supabase.from("attendance_sessions")
      .select("id, shift_id, user_id, user_label, status, checked_in_at, checked_out_at, check_in_distance_m, check_out_distance_m, checkout_overwritten")
      .eq("store_id", storeId).eq("shift_id", shiftId)
      .order("checked_in_at", { ascending: true });
    return resultOrThrow({ data, error }) || [];
  },

  async report(storeId, startDate, endDate) {
    let query = supabase.from("attendance_sessions")
      .select("id, user_label, user_email, status, checked_in_at, checked_out_at, check_in_distance_m, check_out_distance_m, checkout_overwritten, shift_id, attendance_shifts(shift_num, operator_label, opened_at)")
      .eq("store_id", storeId)
      .order("checked_in_at", { ascending: false }).limit(1000);
    if (startDate) query = query.gte("checked_in_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("checked_in_at", `${endDate}T23:59:59`);
    const { data, error } = await query;
    return resultOrThrow({ data, error }) || [];
  },

  async activeLocations(storeId) {
    const { data, error } = await supabase.from("attendance_locations")
      .select("id, name, latitude, longitude, radius_m, max_accuracy_m")
      .eq("store_id", storeId).eq("status", "active").order("name");
    return resultOrThrow({ data, error }) || [];
  },

  async mySessions(storeId, userId) {
    const { data, error } = await supabase.from("attendance_sessions")
      .select("id, status, checked_in_at, checked_out_at, check_in_distance_m, check_out_distance_m, user_email")
      .eq("store_id", storeId).eq("user_id", userId)
      .order("checked_in_at", { ascending: false }).limit(20);
    return resultOrThrow({ data, error }) || [];
  },

  async myActiveSession(userId) {
    const { data, error } = await supabase.from("attendance_sessions")
      .select("id, store_id, status, checked_in_at, user_email")
      .eq("user_id", userId).eq("status", "checked_in").maybeSingle();
    return resultOrThrow({ data, error });
  },

  async registerDevice(storeId) {
    const { data, error } = await supabase.rpc("register_attendance_device", {
      p_store_id: storeId,
      p_device_uuid: getAttendanceDeviceUuid(),
      p_device_name: "Browser karyawan",
    });
    return resultOrThrow({ data, error });
  },

  async recordLocation(deviceUuid, position) {
    const { error } = await supabase.rpc("record_attendance_location", {
      p_device_uuid: deviceUuid,
      p_latitude: position.coords.latitude,
      p_longitude: position.coords.longitude,
      p_accuracy_m: position.coords.accuracy,
    });
    if (error) throw new Error(error.message || "Lokasi perangkat gagal diperbarui.");
  },

  async heartbeat(deviceUuid) {
    const { error } = await supabase.rpc("heartbeat_attendance_device", { p_device_uuid: deviceUuid });
    if (error) throw new Error(error.message || "Heartbeat perangkat gagal.");
  },

  async submit(type, storeId, deviceUuid, position) {
    const { data, error } = await supabase.functions.invoke("submit-attendance", {
      body: {
        storeId,
        deviceId: deviceUuid,
        type,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        requestId: crypto.randomUUID(),
      },
    });
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      throw new Error(body?.code || body?.error || error.message || "Permintaan presensi gagal.");
    }
    if (!data?.ok) throw new Error(data?.code || "Permintaan presensi gagal.");
    return data;
  },

  subscribeLocationRefresh(storeId, callback, onStatus) {
    if (!supabase || !storeId) return () => {};
    const channel = supabase.channel(`attendance-store-${storeId}`, { config: { private: true } })
      .on("broadcast", { event: "refresh-location" }, callback)
      .subscribe(onStatus);
    return () => { supabase.removeChannel(channel); };
  },

  async checkIn(shiftId, position) {
    const { data, error } = await supabase.rpc("attendance_check_in", {
      p_shift_id: shiftId,
      p_latitude: position.coords.latitude,
      p_longitude: position.coords.longitude,
      p_accuracy_m: position.coords.accuracy,
      p_request_id: crypto.randomUUID(),
    });
    return resultOrThrow({ data, error });
  },

  async checkOut(shiftId, position) {
    const { data, error } = await supabase.rpc("attendance_check_out", {
      p_shift_id: shiftId,
      p_latitude: position.coords.latitude,
      p_longitude: position.coords.longitude,
      p_accuracy_m: position.coords.accuracy,
      p_request_id: crypto.randomUUID(),
    });
    return resultOrThrow({ data, error });
  },

  subscribeReminders(userId, callback) {
    if (!supabase || !userId) return () => {};
    const channel = supabase.channel(`attendance-reminders-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_reminders", filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
};