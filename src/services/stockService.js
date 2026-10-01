import { supabase } from "./supabaseClient";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
}

export const stockService = {
  async listStores(userId) {
    requireSupabase();
    const { data: memberships, error: memberError } = await supabase
      .from("store_users").select("store_id, permission").eq("user_id", userId);
    if (memberError) throw memberError;
    if (!memberships?.length) return [];

    const { data: stores, error: storesError } = await supabase
      .from("stores").select("id, name").in("id", memberships.map((row) => row.store_id))
      .order("name", { ascending: true });
    if (storesError) throw storesError;
    const permissionByStore = new Map(memberships.map((row) => [row.store_id, row.permission]));
    return (stores || []).map((store) => ({ ...store, permission: permissionByStore.get(store.id) || "viewer" }));
  },

  async load(storeId) {
    requireSupabase();
    const [items, syncState, events] = await Promise.all([
      supabase.from("stock_items").select("item_type, item_id, name, unit, current_stock, min_stock, pos_updated_at")
        .eq("store_id", storeId).order("name", { ascending: true }),
      supabase.from("stock_sync_state").select("ingredients_enabled, last_seen_at").eq("store_id", storeId).maybeSingle(),
      supabase.from("restock_events").select("id, batch_id, item_type, item_id, item_name, qty, unit, note, status, reject_reason, stock_after, requester_name, requester_email, created_at, applied_at")
        .eq("store_id", storeId).order("created_at", { ascending: false }).limit(100),
    ]);
    if (items.error) throw items.error;
    if (syncState.error) throw syncState.error;
    if (events.error) throw events.error;
    return { items: items.data || [], syncState: syncState.data, events: events.data || [] };
  },

  async submitBatch({ storeId, batchId, itemType, items }) {
    requireSupabase();
    const { data, error } = await supabase.rpc("submit_restock", {
      p_store_id: storeId,
      p_batch_id: batchId,
      p_item_type: itemType,
      p_items: items,
    });
    if (error) throw error;
    return data;
  },

  async cancel(storeId, eventId) {
    requireSupabase();
    const { data, error } = await supabase.rpc("cancel_restock", { p_store_id: storeId, p_id: eventId });
    if (error) throw error;
    return data === true;
  },
};