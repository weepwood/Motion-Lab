/**
 * motion-kit — scroll anchoring (tweb scrollSaver)
 * --------------------------------------------------------------------
 * Keeps the viewport pinned to a visible row across DOM changes that would
 * otherwise make the list jump (history prepends, row removals):
 *
 *   const saver = createScrollSaver(scroller)
 *   saver.save()     // before the change: remember the topmost visible row
 *   list.prepend(...)  // mutate DOM
 *   saver.restore()  // after (± next frame): scrollTop += the row's delta
 *
 * If the anchor row disappeared, the anchor is simply forgotten (no jump).
 */

/**
 * @param {HTMLElement | (() => HTMLElement | null)} scroller
 * @param {string} [rowSelector='.mk-anchor-row']  selector for anchorable rows
 * @param {string} [keyAttr='data-anchor']         attribute identifying a row
 */
export function createScrollSaver(scroller, rowSelector = '.mk-anchor-row', keyAttr = 'data-anchor') {
  const get = () => (typeof scroller === 'function' ? scroller() : scroller)
  let anchor = null

  const findVisibleRow = el => {
    const box = el.getBoundingClientRect()
    for (const row of el.querySelectorAll(rowSelector)) {
      const rect = row.getBoundingClientRect()
      if (rect.height > 0 && rect.bottom >= box.top && rect.top <= box.bottom) {
        const key = row.getAttribute(keyAttr)
        return { key, offset: rect.top - box.top }
      }
    }
    return null
  }

  return {
    save() {
      const el = get()
      if (!el) return
      anchor = findVisibleRow(el)
    },
    restore() {
      const el = get()
      if (!el || !anchor?.key) { anchor = null; return }
      const row = el.querySelector(`[${keyAttr}="${anchor.key}"]`)
      const had = anchor
      anchor = null
      if (!row) return
      const delta = row.getBoundingClientRect().top - el.getBoundingClientRect().top - had.offset
      if (Math.abs(delta) > 0.5) el.scrollTop += delta
    },
    forget() { anchor = null }
  }
}
