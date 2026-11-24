/**
 * Stage the demo + the motion-kit package into the production build so the
 * deployed site serves both the app (/) and the demo page (/demo/).
 *
 * demo/index.html imports ../packages/motion/…, so the package must sit next
 * to the demo folder inside dist/, mirroring the repo layout.
 */
import { cp, mkdir, rm } from 'node:fs/promises'

await rm('dist/demo', { recursive: true, force: true })
await rm('dist/packages', { recursive: true, force: true })
await mkdir('dist/demo', { recursive: true })
await cp('demo', 'dist/demo', { recursive: true })
await cp('packages/motion', 'dist/packages/motion', { recursive: true })
console.log('demo staged at dist/demo/ ·_motion-kit at dist/packages/motion/')
