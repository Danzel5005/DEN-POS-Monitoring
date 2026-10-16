import { supabase } from "./supabaseClient";

function resultOrThrow({ data, error }) {
  if (error) throw new Error(error.message || "Permintaan presensi gagal.");
  return data;
}

export const attendanceService = {
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

  async saveRadius(storeId, radius) {
    const { data, error } = await supabase.rpc("set_attendance_radius", {
      p_store_id: storeId,
      p_radius_m: Number(radius),
    });
    return resultOrThrow({ data, error });
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
      .select("id, user_label, status, checked_in_at, checked_out_at, check_in_distance_m, check_out_distance_m, checkout_overwritten, attendance_shifts!inner(shift_num, operator_label, opened_at, store_id)")
      .eq("attendance_shifts.store_id", storeId)
      .order("checked_in_at", { ascending: false }).limit(1000);
    if (startDate) query = query.gte("checked_in_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("checked_in_at", `${endDate}T23:59:59`);
    const { data, error } = await query;
    return resultOrThrow({ data, error }) || [];
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