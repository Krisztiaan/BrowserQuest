const modules = import.meta.glob("../sprites/*.json", { eager: true });

const sprites = {};
for (const mod of Object.values(modules)) {
  const sprite = (mod && typeof mod === "object" && "default" in mod ? mod.default : mod);
  if (sprite && sprite.id) {
    sprites[sprite.id] = sprite;
  }
}

export default sprites;

