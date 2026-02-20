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
      { text: 'User Guide', link: '/users/' },
      { text: 'Developers', link: '/developers/' },
      { text: 'VS Marketplace', link: 'https://marketplace.visualstudio.com/items?itemName=selfagency.beans-vscode' },
      { text: 'Open VSX', link: 'https://open-vsx.org/extension/selfagency/beans' },
      { text: 'GitHub', link: 'https://github.com/selfagency/beans-vscode' },
    ],
    sidebar: {
      '/users/': [
        { text: 'Core features', link: '/users/' },
        { text: 'AI features', link: '/users/ai' },
        { text: 'Commands reference', link: '/users/commands' },
        { text: 'Keyboard shortcuts', link: '/users/keyboard' },
        { text: 'Settings', link: '/users/settings' },
        { text: 'Troubleshooting', link: '/users/troubleshooting' },
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
