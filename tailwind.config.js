import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/**
 * Theme tokens. Every palette shade is a CSS variable, so dark mode is a remap of the
 * variables (`.dark`), not `dark:` variants scattered through components.
 *  - slate (neutrals): fully inverted, so text-slate-900 is near-white in dark mode.
 *  - accent palettes: tints (50-300) and deep shades (700-950) swap; 400-600 stay put so
 *    buttons and icons keep their brand colour and white text stays readable.
 *  - `white` as a *surface* (bg/border/ring/gradient) follows --surface; text-white stays white.
 */
const ACCENTS = ['blue', 'violet', 'indigo', 'emerald', 'green', 'rose', 'red', 'amber', 'orange', 'sky', 'teal', 'purple', 'pink']
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const darkShade = (palette, s) => (palette === 'slate' || s <= 300 || s >= 700 ? 1000 - s : s)

const palettes = ['slate', ...ACCENTS]
const colorTokens = Object.fromEntries(
  palettes.map((p) => [p, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${p}-${s}) / <alpha-value>)`]))]),
)
const surface = { white: 'rgb(var(--surface) / <alpha-value>)' }

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: colorTokens,
      backgroundColor: surface,
      borderColor: surface,
      ringColor: surface,
      ringOffsetColor: surface,
      gradientColorStops: surface,
      boxShadow: { card: '0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px rgb(16 24 40 / 0.04)' },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const light = { '--surface': '255 255 255' }
      const dark = { '--surface': '22 27 38', 'color-scheme': 'dark' }
      for (const p of palettes) {
        for (const s of SHADES) {
          light[`--c-${p}-${s}`] = channels(colors[p][s])
          dark[`--c-${p}-${s}`] = channels(colors[p][darkShade(p, s)])
        }
      }
      addBase({ ':root': light, '.dark': dark })
    }),
  ],
}
