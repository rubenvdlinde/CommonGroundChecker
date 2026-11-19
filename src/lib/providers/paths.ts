/** Encodes each segment of a slash-separated repository path or branch name for use in a URL. */
export function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
