type UpdateLoopWorld = {
    processGroups(): void;
    processQueues(): void;
    emit(eventName: 'regenTick'): void;
};

export function startWorldUpdateLoop(world: UpdateLoopWorld, updatesPerSecond: number): void {
    const regenCount = updatesPerSecond * 2;
    let updateCount = 0;

    setInterval(function () {
        world.processGroups();
        world.processQueues();

        if (updateCount < regenCount) {
            updateCount += 1;
        } else {
            world.emit('regenTick');
            updateCount = 0;
        }
    }, 1000 / updatesPerSecond);
}
