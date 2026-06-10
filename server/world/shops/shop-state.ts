export type NpcDefinition = Readonly<{
    displayName: string;
    dialogue: ReadonlyArray<string>;
}>;

export type NpcDefinitions = Readonly<Record<string, NpcDefinition>>;

export type ShopSellEntry = Readonly<{
    item: string;
    price: number;
}>;

export type ShopDefinition = Readonly<{
    npc: string;
    buys: ReadonlyArray<ShopSellEntry>;
    sells: ReadonlyArray<ShopSellEntry>;
}>;

export type ShopDefinitions = Readonly<Record<string, ShopDefinition>>;

export type NpcDialogueResult =
    | Readonly<{ accepted: true; npcId: string; displayName: string; text: string }>
    | Readonly<{ accepted: false; reason: string }>;

export type ShopTransactionResult = Readonly<{ accepted: true }> | Readonly<{ accepted: false; reason: string }>;
