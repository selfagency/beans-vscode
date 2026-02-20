export default {
  title: 'Beans for VS Code',
  description: 'Documentation for the Beans VS Code extension',
  base: '/',
  srcDir: 'docs',
  outDir: './.gh-pages',
  themeConfig: {
    logo: '/icon.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting started', link: '/getting-started' },
      { text: 'User Guide', link: '/user-guide' },
      { text: 'Developers', link: '/developers/' },
      { text: 'VS Marketplace', link: 'https://marketplace.visualstudio.com/items?itemName=selfagency.beans-vscode' },
      { text: 'Open VSX', link: 'https://open-vsx.org/extension/selfagency/beans' },
      { text: 'GitHub', link: 'https://github.com/selfagency/beans-vscode' },
    ],
    sidebar: {
      '/user-guide/': [
        { text: 'Core features', link: '/user-guide' },
        { text: 'AI features', link: '/user-guide/ai' },
        { text: 'Commands reference', link: '/user-guide/commands' },
        { text: 'Keyboard shortcuts', link: '/user-guide/keyboard' },
        { text: 'Settings', link: '/user-guide/settings' },
        { text: 'Troubleshooting', link: '/user-guide/troubleshooting' },
      ],
      '/developers/': [
        { text: 'Getting started', link: '/developers/' },
        { text: 'Contributing', link: '/developers/contributing' },
        { text: 'Testing', link: '/developers/testing' },
        { text: 'Remote compatibility', link: '/developers/remote-testing' },
      ],
    },
  },
};
