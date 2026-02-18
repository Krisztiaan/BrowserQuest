function resolveImageAssetPath(scale: number | string, imageName: string): string {
  return `/img/${encodeURIComponent(String(scale))}/${encodeURIComponent(imageName)}.webp`;
}

export { resolveImageAssetPath };
