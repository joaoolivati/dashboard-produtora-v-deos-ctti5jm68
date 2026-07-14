const PATCHED = '_cssRulesSecurityPatched'

export function applyCssRulesSecurityPatch() {
  if ((CSSStyleSheet.prototype as any)[PATCHED]) return
  ;(CSSStyleSheet.prototype as any)[PATCHED] = true

  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules')

  if (!descriptor || !descriptor.get) return

  const originalGetter = descriptor.get

  Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
    get(this: CSSStyleSheet) {
      try {
        return originalGetter.call(this)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'SecurityError') {
          return [] as CSSRuleList
        }
        throw e
      }
    },
    configurable: true,
  })
}
