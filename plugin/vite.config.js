const path = require('path')
const fs = require('fs')
const { defineConfig } = require('vite')
const markdownRawPlugin = require('vite-raw-plugin')

module.exports = defineConfig({
  build: {
    minify: true,
    lib: {
      entry: path.resolve(__dirname, 'main.ts'),
      fileName: 'main',
      name: 'AudiopenObsidian',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['obsidian'],
      output: {},
    },
  },
  plugins: [
    markdownRawPlugin({
      fileRegex: /\.md$/,
    }),
    {
      name: 'copy-assets',
      closeBundle() {
        const manifestSource = path.resolve(__dirname, 'manifest.json')
        const manifestDest = path.resolve(__dirname, 'dist', 'manifest.json')
        fs.copyFileSync(manifestSource, manifestDest)

        const linkSource = path.resolve(__dirname, 'template-links.md')
        const linkDest = path.resolve(__dirname, 'dist', 'template-links.md')
        fs.copyFileSync(linkSource, linkDest)

        const tagSource = path.resolve(__dirname, 'template-tags.md')
        const tagDest = path.resolve(__dirname, 'dist', 'template-tags.md')
        fs.copyFileSync(tagSource, tagDest)
      },
    },
  ],
})
