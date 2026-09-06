import { getSupabaseAdmin } from './supabase';
let localNext = 0;
export async function takeMapSearchSlot(): Promise<boolean> {
    const db = getSupabaseAdmin();
    if (db) {
        const { data, error } = await db.rpc('take_map_search_slot');
        return !error && data === true;
    }
    // Local/demo process only. Deployed environments share the database gate across instances.
    const now = Date.now();
    if (now < localNext)
        return false;
    localNext = now + 1100;
    return true;
}
