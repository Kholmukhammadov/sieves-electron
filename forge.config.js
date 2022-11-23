module.exports = {
  packagerConfig: {
    icon: "./src/assets/electron-icon/icons/win/icon.ico"
  },
  rebuildConfig: {},
makers: [
  {
    name: '@electron-forge/maker-squirrel',
    config: {
      setupIcon: "./src/assets/electron-icon/icons/win/icon.ico"
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
        owner: 'Kholmukhammadov',
        name: 'sieves-electron'
      },
      authToken: process.env.GIT_AUTH?.trim(),
      prerelease: true,
      tagPrefix: 'v',
    }
  }
]
};
