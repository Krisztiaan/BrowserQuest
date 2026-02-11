import Character from '../../../character';

type SpawnCharacterOrchestrationHost<TEntity> = {
    entity: TEntity;
    installMotion(character: Character): void;
    installStopPathing(character: Character): void;
    installPathRequest(character: Character): void;
    installDeath(character: Character): void;
    installBubble(character: Character): void;
    installMobTargetLink(character: Character): void;
};

export function orchestrateSpawnedCharacter<TEntity>(
    host: SpawnCharacterOrchestrationHost<TEntity>
): void {
    if (!(host.entity instanceof Character)) {
        return;
    }

    host.installMotion(host.entity);
    host.installStopPathing(host.entity);
    host.installPathRequest(host.entity);
    host.installDeath(host.entity);
    host.installBubble(host.entity);
    host.installMobTargetLink(host.entity);
}
