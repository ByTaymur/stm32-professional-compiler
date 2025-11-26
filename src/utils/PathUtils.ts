import * as path from 'path';
import * as fs from 'fs';

/**
 * Cross-platform path utilities
 */
export class PathUtils {
    /**
     * Normalize path to use forward slashes and resolve symbolic links
     */
    static normalize(inputPath: string): string {
        if (!inputPath) return '';

        // Convert to forward slashes
        let normalized = inputPath.replace(/\\/g, '/');

        // Resolve to absolute if relative
        if (!path.isAbsolute(normalized)) {
            normalized = path.resolve(normalized);
        }

        return normalized;
    }

    /**
     * Join paths in a cross-platform way
     */
    static join(...paths: string[]): string {
        return path.join(...paths).replace(/\\/g, '/');
    }

    /**
     * Get platform-specific executable name
     */
    static getExecutableName(baseName: string): string {
        return process.platform === 'win32' ? `${baseName}.exe` : baseName;
    }

    /**
     * Check if file exists and is executable
     */
    static isExecutable(filePath: string): boolean {
        try {
            fs.accessSync(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Resolve symlinks to real path
     */
    static resolveSymlink(inputPath: string): string {
        try {
            return fs.realpathSync(inputPath);
        } catch {
            return inputPath;
        }
    }

    /**
     * Convert to Windows short path if on Windows (handles 260 char limit)
     */
    static toShortPath(longPath: string): string {
        if (process.platform !== 'win32') {
            return longPath;
        }

        // On Windows, use \\?\ prefix for long paths
        if (longPath.length > 260 && !longPath.startsWith('\\\\?\\')) {
            return `\\\\?\\${path.resolve(longPath)}`;
        }

        return longPath;
    }

    /**
     * Get workspace-relative path
     */
    static getRelativePath(from: string, to: string): string {
        const relativePath = path.relative(from, to);
        return relativePath.replace(/\\/g, '/');
    }

    /**
     * Ensure directory exists
     */
    static ensureDir(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Find file in directory and subdirectories
     */
    static findFile(directory: string, fileName: string, maxDepth: number = 3): string | undefined {
        const search = (dir: string, depth: number): string | undefined => {
            if (depth > maxDepth) return undefined;

            try {
                const files = fs.readdirSync(dir);

                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat.isFile() && file === fileName) {
                        return fullPath;
                    } else if (stat.isDirectory()) {
                        const found = search(fullPath, depth + 1);
                        if (found) return found;
                    }
                }
            } catch {
                // Permission denied or other errors
            }

            return undefined;
        };

        return search(directory, 0);
    }
}
