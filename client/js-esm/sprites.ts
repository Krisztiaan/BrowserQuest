/// <reference types="vite/client" />

type SpriteAnimationData = {
  length: number;
  row: number;
};

type SpriteJson = {
  id: string;
  width: number;
  height: number;
  offset_x?: number;
  offset_y?: number;
  animations: Record<string, SpriteAnimationData>;
};

const modules = import.meta.glob('../sprites/*.json', { eager: true });

const sprites: Record<string, SpriteJson> = {};
for (const mod of Object.values(modules)) {
  const sprite = (mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod) as
    | SpriteJson
    | undefined;
  if (sprite && sprite.id) {
    sprites[sprite.id] = sprite;
  }
}

export type { SpriteJson, SpriteAnimationData };
export default sprites;
