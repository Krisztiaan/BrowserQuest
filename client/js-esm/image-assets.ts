/// <reference types="vite/client" />

const imageModules = import.meta.glob('../img/*/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const imageAssetByKey: Record<string, string> = {};
for (const [modulePath, moduleUrl] of Object.entries(imageModules)) {
  const match = modulePath.match(/\/img\/([^/]+)\/([^/.]+)\.png$/);
  if (!match) {
    continue;
  }
  const scale = match[1];
  const imageName = match[2];
  imageAssetByKey[`${scale}/${imageName}`] = moduleUrl;
}

function resolveImageAssetPath(scale: number | string, imageName: string): string {
  const key = `${String(scale)}/${imageName}`;
  const imagePath = imageAssetByKey[key];
  if (typeof imagePath === 'string') {
    return imagePath;
  }
  throw new Error(`Unknown image asset: ${key}.png`);
}

export { resolveImageAssetPath };
