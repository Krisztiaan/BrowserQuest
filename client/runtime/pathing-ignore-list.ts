export type PathingIgnoreEntity = Readonly<{
    gridX: number;
    gridY: number;
    isMoving?: () => boolean;
    nextGridX?: number;
    nextGridY?: number;
}>;

type PathingRequester = PathingIgnoreEntity &
    Readonly<{
        hasTarget(): boolean;
        target: PathingIgnoreEntity | null;
    }>;

export function buildPathingIgnoreList(character: PathingRequester): PathingIgnoreEntity[] {
    const ignored: PathingIgnoreEntity[] = [character];
    if (character.hasTarget() && character.target) {
        ignored.push(character.target);
    }
    return ignored;
}
