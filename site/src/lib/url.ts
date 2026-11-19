// BASE_URL is "/kai-artifact" or "/kai-artifact/" depending on config; always return a path under it.
export function url(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
