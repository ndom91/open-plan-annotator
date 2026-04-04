// tsgo does not resolve the "./*" → "./dist/*" wildcard export in shiki's
// package.json. These declarations cover the subpath imports we use.

declare module "shiki/langs/*" {
  const grammar: import("shiki").LanguageRegistration[];
  export default grammar;
}

declare module "shiki/themes/*" {
  const theme: import("shiki").ThemeRegistrationRaw;
  export default theme;
}
