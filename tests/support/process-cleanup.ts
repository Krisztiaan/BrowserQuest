type BunProcessLike = {
    kill: (signal?: string) => void;
    exited: Promise<number>;
};

async function waitForExit(proc: BunProcessLike, timeoutMs: number): Promise<boolean> {
    try {
        const result = await Promise.race([
            proc.exited.then(() => true).catch(() => true),
            Bun.sleep(timeoutMs).then(() => false),
        ]);
        return result;
    } catch (_) {
        return true;
    }
}

export async function killBunProcess(proc: BunProcessLike | null | undefined, timeoutMs = 4000): Promise<void> {
    if (!proc) {
        return;
    }

    try {
        proc.kill('SIGTERM');
    } catch (_) {
        // ignore kill failures
    }

    const exited = await waitForExit(proc, timeoutMs);
    if (exited) {
        return;
    }

    // Escalate if the process didn't exit in time (helps prevent flaky suite load due to leaked servers).
    try {
        proc.kill('SIGKILL');
    } catch (_) {
        // ignore kill failures
    }

    await waitForExit(proc, timeoutMs);
}
