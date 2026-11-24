/**
 * Scroll anchoring, following tweb's `scrollSaver.ts`: when the message list
 * changes (history prepended, rows removed), the browser's scroll position is
 * measured against a stable anchor instead of hoping the scroll coincidentally
 * lands somewhere sane.
 *
 * save()   – before the DOM change: pick the topmost fully-visible message row
 *            and remember its offset relative to the scroller's viewport.
 * restore()– after the change: same row, same offset → lift `scrollTop` by the
 *            difference. Visually nothing moves.
 */

export interface ScrollSaver {
  save: () => void
  restore: () => void
  forget: () => void
}

export function createScrollSaver(scroller: () => HTMLElement | null, rowSelector = '.message-row'): ScrollSaver {
  let anchor: { key: string; offset: number } | null = null

  const visibleRow = (el: HTMLElement) => {
    const box = el.getBoundingClientRect()
    const row = [...el.querySelectorAll<HTMLElement>(rowSelector)].find(r => {
      const rect = r.getBoundingClientRect()
      return rect.bottom >= box.top && rect.top <= box.bottom && rect.height > 0
    })
    if (!row) return null
    const rect = row.getBoundingClientRect()
    return { key: row.dataset.row ?? '', offset: rect.top - box.top }
  }

  return {
    save() {
      const el = scroller()
      if (!el) return
      anchor = visibleRow(el)
    },
    restore() {
      const el = scroller()
      if (!el || !anchor || !anchor.key) { anchor = null; return }
      const row = el.querySelector<HTMLElement>(`[data-row="${anchor.key}"]`)
      if (!row) { anchor = null; return }
      const delta = row.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset
      anchor = null
      if (Math.abs(delta) > 0.5) el.scrollTop += delta
    },
    forget() { anchor = null }
  }
}
