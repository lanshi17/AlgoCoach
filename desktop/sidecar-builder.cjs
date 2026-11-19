const { readFileSync } = require('node:fs')
const { Arch } = require('builder-util')
const { build } = require('./package.json')
module.exports = {
  ...build,
  beforePack: async context => {
    const manifest = JSON.parse(readFileSync('sidecar-stage/platform.json', 'utf8'))
    const platform = context.electronPlatformName === 'darwin' ? 'darwin' : context.electronPlatformName
    if (manifest.platform !== platform || manifest.arch !== Arch[context.arch]) {
      throw new Error(`侧车 ${manifest.platform}/${manifest.arch} 与目标 ${platform}/${Arch[context.arch]} 不一致`)
    }
  },
  extraResources: [{ from: 'sidecar-stage', to: 'sidecar' }],
}
