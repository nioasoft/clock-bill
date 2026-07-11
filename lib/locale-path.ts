export function localePrefixFromPath(pathname: string): "he" | "en" | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "he" || first === "en" ? first : null;
}
