export type CropTileState = Readonly<{
    mapId: string;
    x: number;
    y: number;
    cropId: string | null;
    tilled: boolean;
    wateredToday: boolean;
    growth: number;
}>;

export type CropDefinition = Readonly<{
    seedItem: string;
    harvestItem: string;
    growthDays: number;
    regrows: boolean;
}>;

export type CropDefinitions = Readonly<Record<string, CropDefinition>>;
