/**
 * Module declaration for Markdown template files imported via esbuild's text loader.
 * When bundled, the content of the .md file is inlined as a plain string.
 */
declare module '*.md' {
  const content: string;
  export default content;
}
