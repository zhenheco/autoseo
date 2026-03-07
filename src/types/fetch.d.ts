// Override Response.json() to return `any` instead of `unknown` (TypeScript 5.9+)
// This restores the previous behavior and avoids adding type assertions to 37+ fetch calls
interface Body {
  json(): Promise<any>;
}
