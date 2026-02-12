type UpdateLoopWorld = {
    processQueues(): void;
};

export function startWorldUpdateLoop(world: UpdateLoopWorld, updatesPerSecond: number): void {
    setInterval(function () {
        world.processQueues();
    }, 1000 / updatesPerSecond);
}
