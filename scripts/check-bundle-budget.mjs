import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const assets = (await readdir('dist/assets')).filter((name) => name.endsWith('.js'))
if (!assets.length) throw new Error('No JavaScript assets found in dist/assets.')
const measurements = await Promise.all(assets.map(async (name) => {
  const source = await readFile(`dist/assets/${name}`)
  return { name, raw: source.byteLength, gzip: gzipSync(source).byteLength }
}))
const largest = measurements.toSorted((left, right) => right.raw - left.raw)[0]
const totalGzip = measurements.reduce((sum, asset) => sum + asset.gzip, 0)
const maximumLargestKiB = 1280
const maximumTotalGzipKiB = 570
if (largest.raw > maximumLargestKiB * 1024) throw new Error(`Largest JavaScript chunk ${largest.name} is ${(largest.raw / 1024).toFixed(1)} KiB; budget is ${maximumLargestKiB} KiB.`)
if (totalGzip > maximumTotalGzipKiB * 1024) throw new Error(`Total JavaScript is ${(totalGzip / 1024).toFixed(1)} KiB gzip; budget is ${maximumTotalGzipKiB} KiB.`)
console.log(`Bundle evidence: largest ${(largest.raw / 1024).toFixed(1)} KiB raw; total ${(totalGzip / 1024).toFixed(1)} KiB gzip.`)
