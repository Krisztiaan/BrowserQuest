export const ENTITY_KIND_DOMAIN = {
    warrior: [1, 'player'],
    rat: [2, 'mob'],
    skeleton: [3, 'mob'],
    goblin: [4, 'mob'],
    ogre: [5, 'mob'],
    spectre: [6, 'mob'],
    crab: [7, 'mob'],
    bat: [8, 'mob'],
    wizard: [9, 'mob'],
    eye: [10, 'mob'],
    snake: [11, 'mob'],
    skeleton2: [12, 'mob'],
    boss: [13, 'mob'],
    deathknight: [14, 'mob'],
    firefox: [20, 'armor'],
    clotharmor: [21, 'armor'],
    leatherarmor: [22, 'armor'],
    mailarmor: [23, 'armor'],
    platearmor: [24, 'armor'],
    redarmor: [25, 'armor'],
    goldenarmor: [26, 'armor'],
    flask: [35, 'object'],
    burger: [36, 'object'],
    chest: [37, 'object'],
    firepotion: [38, 'object'],
    cake: [39, 'object'],
    guard: [40, 'npc'],
    king: [41, 'npc'],
    octocat: [42, 'npc'],
    villagegirl: [43, 'npc'],
    villager: [44, 'npc'],
    priest: [45, 'npc'],
    scientist: [46, 'npc'],
    agent: [47, 'npc'],
    rick: [48, 'npc'],
    nyan: [49, 'npc'],
    sorcerer: [50, 'npc'],
    beachnpc: [51, 'npc'],
    forestnpc: [52, 'npc'],
    desertnpc: [53, 'npc'],
    lavanpc: [54, 'npc'],
    coder: [55, 'npc'],
    sword1: [60, 'weapon'],
    sword2: [61, 'weapon'],
    redsword: [62, 'weapon'],
    goldensword: [63, 'weapon'],
    morningstar: [64, 'weapon'],
    axe: [65, 'weapon'],
    bluesword: [66, 'weapon'],
} as const;

export type EntityKindName = keyof typeof ENTITY_KIND_DOMAIN;
export type EntityCategory = (typeof ENTITY_KIND_DOMAIN)[EntityKindName][1];
export type EntityKindId = (typeof ENTITY_KIND_DOMAIN)[EntityKindName][0];
export type EntityKind = EntityKindName | EntityKindId;

export type EntityKindNameByCategory<C extends EntityCategory> = {
    [K in EntityKindName]: (typeof ENTITY_KIND_DOMAIN)[K][1] extends C ? K : never;
}[EntityKindName];

export type EntityKindIdByCategory<C extends EntityCategory> = {
    [K in EntityKindName]: (typeof ENTITY_KIND_DOMAIN)[K][1] extends C ? (typeof ENTITY_KIND_DOMAIN)[K][0] : never;
}[EntityKindName];
