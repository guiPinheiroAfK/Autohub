// ── Skeleton ─────────────────────────────────────────────────────────────────
export function VeiculoSkeleton() {
    return (
        <div className="flex flex-col gap-8 animate-pulse">
            <div className="flex flex-col gap-3 border-b border-border pb-8">
                <div className="h-3 w-32 rounded bg-surface" />
                <div className="h-9 w-64 rounded-lg bg-surface" />
                <div className="h-3 w-44 rounded bg-surface" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0,1,2,3].map(i => (
                    <div key={i} className="h-[72px] rounded-xl border border-border bg-surface" />
                ))}
            </div>
            <div className="flex flex-col gap-2.5">
                {[0,1,2].map(i => (
                    <div key={i} className="h-[54px] rounded-xl border border-border bg-surface" />
                ))}
            </div>
        </div>
    )
}
