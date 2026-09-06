export function clusterPoints<T extends {
    id: string;
}>(items: T[], project: (item: T) => {
    x: number;
    y: number;
}, size = 56, selectedId?: string | null): T[][] {
    const cells = new Map<string, T[]>();
    for (const item of items) {
        const p = project(item);
        const key = item.id === selectedId ? `selected:${item.id}` : `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
        const bucket = cells.get(key) || [];
        bucket.push(item);
        cells.set(key, bucket);
    }
    return [...cells.values()];
}
