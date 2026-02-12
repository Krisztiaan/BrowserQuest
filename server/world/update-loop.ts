type UpdateLoopWorld = {
    processGroups(): void;
    processQueues(): void;
};

export function startWorldUpdateLoop(world: UpdateLoopWorld, updatesPerSecond: number): void {
    setInterval(function () {
        world.processGroups();
        world.processQueues();
    }, 1000 / updatesPerSecond);
}
