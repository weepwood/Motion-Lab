/**
 * CI gate 1 — motion-kit import smoke.
 * Loads the package the way any ESM consumer would and touches every module.
 * Catches syntax errors, broken relative imports and top-level crashes
 * (the v1.0.0 `??`/`||` syntax error shipped once; this gate exists for it).
 */
const mods = [
  'engine.js', 'easing.js', 'flight.js', 'ripple.js', 'gestures.js',
  'scroll-saver.js', 'reveal.js', 'layout.js', 'index.js'
]
for (const mod of mods) {
  const imported = await import(`../packages/motion/${mod}`).catch(error => {
    console.error(`FAIL  packages/motion/${mod}`)
    console.error(error)
    process.exit(1)
  })
  console.log(`ok   packages/motion/${mod}  (${Object.keys(imported).length} exports)`)
}
console.log('motion-kit import smoke passed')
