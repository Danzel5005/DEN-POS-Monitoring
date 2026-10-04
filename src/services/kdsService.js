import { supabase } from "./supabaseClient";

function requireClient() {
  if (!supabase) throw new Error("Koneksi data belum dikonfigurasi.");
  return supabase;
}

function throwIfError(error) {
  if (error) throw error;
}

export async function loadKdsStores(userId) {
  const client = requireClient();
  const membership = await client.from("store_users").select("store_id").eq("user_id", userId);
  throwIfError(membership.error);
  const ids = (membership.data || []).map((row) => row.store_id).filter(Boolean);
  if (!ids.length) return [];
  const stores = await client.from("stores").select("id, name").in("id", ids).order("name");
  throwIfError(stores.error);
  return stores.data || [];
}

export async function loadKdsStations(storeId) {
  const { data, error } = await requireClient()
    .from("kds_stations")
    .select("id, label, sort_order")
    .eq("store_id", storeId)
    .order("sort_order")
    .order("label");
  throwIfError(error);
  return data || [];
}

export async function loadKdsTickets(storeId, { activeOffset = 0, activeLimit = 300 } = {}) {
  const client = requireClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [active, served] = await Promise.all([
    client.from("kds_tickets").select("*").eq("store_id", storeId)
      .in("status", ["new", "preparing", "ready", "cancelled"])
      .order("created_at", { ascending: false }).range(activeOffset, activeOffset + activeLimit - 1),
    client.from("kds_tickets").select("*").eq("store_id", storeId).eq("status", "served")
      .gte("created_at", dayAgo).order("served_at", { ascending: false }).limit(50),
  ]);
  throwIfError(active.error);
  throwIfError(served.error);
  return {
    active: active.data || [],
    served: served.data || [],
    hasMoreActive: (active.data || []).length === activeLimit,
  };
}

export async function setKdsTicketStatus(ticketId, status) {
  const { error } = await requireClient().rpc("kds_set_status", {
    p_ticket_id: ticketId,
    p_new_status: status,
  });
  throwIfError(error);
}

export function subscribeKdsTickets(storeId, onChange, onStatus) {
  const client = requireClient();
  const channel = client.channel(`kds-tickets-${storeId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "kds_tickets",
      filter: `store_id=eq.${storeId}`,
    }, onChange)
    .subscribe(onStatus);
  return () => client.removeChannel(channel);
}