import fs from 'node:fs/promises';
import path from 'node:path';

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

export async function copyPathIfExists(sourcePath: string, destinationPath: string): Promise<boolean> {
    if (!(await pathExists(sourcePath))) {
        return false;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
    return true;
}
