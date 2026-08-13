// Shared ref to the per-tab inner scroll container mounted by App.jsx.
// usePullToRefresh reads this to check scrollTop instead of window.scrollY,
// since the document body no longer scrolls with the inner-container layout.
export const tabScrollRef = { current: null }
