export function haptic(pattern = 10) {
  navigator.vibrate?.(pattern)
}
