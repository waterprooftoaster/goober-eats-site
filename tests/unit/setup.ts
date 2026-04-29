/**
 * @file setup.ts
 * @description Vitest global setup that loads jest-dom custom matchers for all unit tests.
 *   Also installs a tiny jsdom shim so vaul's drag-translate logic
 *   (which reads `getComputedStyle(el).transform`) does not throw on close-button
 *   clicks. jsdom returns undefined for transform fields; vaul calls .match() on
 *   the value. The shim returns the string 'none' which matches vaul's "no
 *   transform" branch and short-circuits the drag math safely.
 *   Called by: vitest.config.ts (setupFiles)
 */

import '@testing-library/jest-dom'

const originalGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
  const result = originalGetComputedStyle(el, pseudo ?? null)
  // Only patch if the underlying jsdom result lacks a string transform value
  if (typeof (result as CSSStyleDeclaration).transform !== 'string' || (result as CSSStyleDeclaration).transform === '') {
    return new Proxy(result, {
      get(target, prop, receiver) {
        if (prop === 'transform' || prop === 'webkitTransform' || prop === 'mozTransform') {
          return 'none'
        }
        return Reflect.get(target, prop, receiver)
      },
    }) as CSSStyleDeclaration
  }
  return result
}) as typeof window.getComputedStyle

// vaul reads window.matchMedia for reduced-motion + viewport queries.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

// vaul calls setPointerCapture / releasePointerCapture on pointer-down to claim
// the drag gesture. jsdom does not implement Pointer Events API.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function () {}
  Element.prototype.releasePointerCapture = function () {}
  Element.prototype.hasPointerCapture = function () { return false }
}

// jsdom does not implement HTMLDialogElement.showModal/close. Minimal shim that
// toggles the `open` attribute and fires the native `close` event so listeners
// (e.g., parent-controlled `onClose`) behave like a real browser.
if (typeof window !== 'undefined' && typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
  }
  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function close() {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}
