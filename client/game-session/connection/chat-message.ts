type ChatMessageHost<TEntity> = {
    entityId: string | number;
    message: string;
    resolveEntity(entityId: string | number): TEntity | null;
    createBubble(entityId: string | number, message: string): void;
    assignBubbleTo(entity: TEntity | null): void;
    playChatSound(): void;
};

export function handleChatMessage<TEntity>(host: ChatMessageHost<TEntity>): void {
    const entity = host.resolveEntity(host.entityId);
    host.createBubble(host.entityId, host.message);
    host.assignBubbleTo(entity);
    host.playChatSound();
}
