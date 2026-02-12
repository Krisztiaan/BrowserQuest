type BunProcessLike = {
    kill: (signal?: string) => void;
    exited: Promise<number>;
};

export async function killBunProcess(proc: BunProcessLike | null | undefined, timeoutMs = 2000): Promise<void> {
    if (!proc) {
        return;
    }

    try {
        proc.kill();
    } catch (_) {
        // ignore kill failures
    }

    try {
        await Promise.race([
            proc.exited.catch(() => -1),
            Bun.sleep(timeoutMs).then(() => -1),
        ]);
    } catch (_) {
        // ignore await failures
    }
}
