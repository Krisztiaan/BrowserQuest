export type ResourceTool = 'axe' | 'pickaxe' | 'scythe';

export type ResourceDrop = Readonly<{
    item: string;
    quantity: number;
}>;

export type ResourceDefinition = Readonly<{
    tool: ResourceTool;
    drops: ReadonlyArray<ResourceDrop>;
    respawnDays: number;
}>;

export type ResourceDefinitions = Readonly<Record<string, ResourceDefinition>>;

export type ResourceNodeState = Readonly<{
    id: string;
    mapId: string;
    x: number;
    y: number;
    kind: string;
    depleted: boolean;
    respawnDay: number | null;
}>;
