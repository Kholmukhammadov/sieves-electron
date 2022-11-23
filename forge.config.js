module.exports = {
  packagerConfig: {},
  rebuildConfig: {},
makers: [
  {
    name: '@electron-forge/maker-squirrel',
    config: {
      setupIcon: '/path/to/icon.ico'
  }
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin'],
  },
  {
    name: '@electron-forge/maker-deb',
    config: {},
  },
  {
    name: '@electron-forge/maker-rpm',
    config: {},
  },
],
publishers: [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'kholmukhammadov',
        name: 'sieves-electron'
      },
      prerelease: true
    }
  }
]
};
