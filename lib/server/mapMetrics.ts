/** Operational events only: no user IDs, search text, note text, IPs or coordinates. */
export type MapOperation = 'walking_route' | 'map_search' | 'route_save' | 'library_change' | 'meeting_preview' | 'meeting_send' | 'gav_publish' | 'gav_response';
export async function measuredMapOperation(operation: MapOperation, _request: Request, run: () => Promise<Response>): Promise<Response> {
    const started = performance.now();
    const eventId = crypto.randomUUID();
    const base = { channel: 'pso.map-gav', eventId, operation, provider: ['map_search','walking_route'].includes(operation) ? 'osm' : 'pso', version: 'map-gav-20260907' };
    console.info(JSON.stringify({ ...base, stage: 'start' }));
    try {
        const response = await run();
        const payload = await response.clone().json().catch(() => null);
        console.info(JSON.stringify({ ...base, stage: response.ok ? (payload?.replayed === true ? 'replay' : 'success') : 'error', status: response.status, durationMs: Math.round(performance.now() - started) }));
        return response;
    }
    catch (error) {
        console.info(JSON.stringify({ ...base, stage: 'error', status: 500, durationMs: Math.round(performance.now() - started) }));
        throw error;
    }
}
