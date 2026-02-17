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

import agent from './sprites/agent.json';
import arrow from './sprites/arrow.json';
import axe from './sprites/axe.json';
import bat from './sprites/bat.json';
import beachnpc from './sprites/beachnpc.json';
import bluesword from './sprites/bluesword.json';
import boss from './sprites/boss.json';
import chest from './sprites/chest.json';
import clotharmor from './sprites/clotharmor.json';
import coder from './sprites/coder.json';
import crab from './sprites/crab.json';
import death from './sprites/death.json';
import deathknight from './sprites/deathknight.json';
import desertnpc from './sprites/desertnpc.json';
import eye from './sprites/eye.json';
import firefox from './sprites/firefox.json';
import forestnpc from './sprites/forestnpc.json';
import goblin from './sprites/goblin.json';
import goldenarmor from './sprites/goldenarmor.json';
import goldensword from './sprites/goldensword.json';
import guard from './sprites/guard.json';
import hand from './sprites/hand.json';
import impact from './sprites/impact.json';
import item_axe from './sprites/item-axe.json';
import item_bluesword from './sprites/item-bluesword.json';
import item_burger from './sprites/item-burger.json';
import item_cake from './sprites/item-cake.json';
import item_clotharmor from './sprites/item-clotharmor.json';
import item_firepotion from './sprites/item-firepotion.json';
import item_flask from './sprites/item-flask.json';
import item_goldenarmor from './sprites/item-goldenarmor.json';
import item_goldensword from './sprites/item-goldensword.json';
import item_leatherarmor from './sprites/item-leatherarmor.json';
import item_mailarmor from './sprites/item-mailarmor.json';
import item_morningstar from './sprites/item-morningstar.json';
import item_platearmor from './sprites/item-platearmor.json';
import item_redarmor from './sprites/item-redarmor.json';
import item_redsword from './sprites/item-redsword.json';
import item_sword1 from './sprites/item-sword1.json';
import item_sword2 from './sprites/item-sword2.json';
import king from './sprites/king.json';
import lavanpc from './sprites/lavanpc.json';
import leatherarmor from './sprites/leatherarmor.json';
import loot from './sprites/loot.json';
import mailarmor from './sprites/mailarmor.json';
import morningstar from './sprites/morningstar.json';
import nyan from './sprites/nyan.json';
import octocat from './sprites/octocat.json';
import ogre from './sprites/ogre.json';
import platearmor from './sprites/platearmor.json';
import priest from './sprites/priest.json';
import rat from './sprites/rat.json';
import redarmor from './sprites/redarmor.json';
import redsword from './sprites/redsword.json';
import rick from './sprites/rick.json';
import scientist from './sprites/scientist.json';
import shadow16 from './sprites/shadow16.json';
import skeleton from './sprites/skeleton.json';
import skeleton2 from './sprites/skeleton2.json';
import snake from './sprites/snake.json';
import sorcerer from './sprites/sorcerer.json';
import sparks from './sprites/sparks.json';
import spectre from './sprites/spectre.json';
import sword from './sprites/sword.json';
import sword1 from './sprites/sword1.json';
import sword2 from './sprites/sword2.json';
import talk from './sprites/talk.json';
import target from './sprites/target.json';
import villagegirl from './sprites/villagegirl.json';
import villager from './sprites/villager.json';
import wizard from './sprites/wizard.json';

const spriteCatalog = [
  agent,
  arrow,
  axe,
  bat,
  beachnpc,
  bluesword,
  boss,
  chest,
  clotharmor,
  coder,
  crab,
  death,
  deathknight,
  desertnpc,
  eye,
  firefox,
  forestnpc,
  goblin,
  goldenarmor,
  goldensword,
  guard,
  hand,
  impact,
  item_axe,
  item_bluesword,
  item_burger,
  item_cake,
  item_clotharmor,
  item_firepotion,
  item_flask,
  item_goldenarmor,
  item_goldensword,
  item_leatherarmor,
  item_mailarmor,
  item_morningstar,
  item_platearmor,
  item_redarmor,
  item_redsword,
  item_sword1,
  item_sword2,
  king,
  lavanpc,
  leatherarmor,
  loot,
  mailarmor,
  morningstar,
  nyan,
  octocat,
  ogre,
  platearmor,
  priest,
  rat,
  redarmor,
  redsword,
  rick,
  scientist,
  shadow16,
  skeleton,
  skeleton2,
  snake,
  sorcerer,
  sparks,
  spectre,
  sword,
  sword1,
  sword2,
  talk,
  target,
  villagegirl,
  villager,
  wizard,
] as const;

const sprites: Record<string, SpriteJson> = {};
for (const sprite of spriteCatalog) {
  if (typeof sprite.id === "string" && sprite.id.length > 0) {
    sprites[sprite.id] = sprite as SpriteJson;
  }
}

export type { SpriteJson, SpriteAnimationData };
export default sprites;
