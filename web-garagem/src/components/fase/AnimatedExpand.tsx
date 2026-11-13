// ── Animate height ────────────────────────────────────────────────────────────

export function AnimatedExpand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
      <div style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 220ms cubic-bezier(0.4,0,0.2,1)"
      }}>
        <div style={{ overflow: "hidden" }}>{children}</div>
      </div>
  )
}
