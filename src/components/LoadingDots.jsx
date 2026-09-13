function Dots() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '160ms' }} />
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '320ms' }} />
    </div>
  )
}

// Page-level: fixed overlay, visually centered in the content area (above nav bar)
export default function LoadingDots() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ paddingBottom: '68px' }}>
      <Dots />
    </div>
  )
}

// Inline: centered within a constrained panel (PrayerProfile, ResourcesTab sub-panels)
export function InlineLoadingDots() {
  return (
    <div className="flex items-center justify-center w-full py-12">
      <Dots />
    </div>
  )
}
