import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { fileURLToPath } from 'node:url';
import { pkgUpSync } from 'pkg-up';

interface GetProjectDirOptions {
	monorepoRoot?: boolean;
}

function getMonorepoRoot(
	curDirectory: string = process.cwd()
): string | undefined {
	if (fs.statSync(curDirectory).isFile()) {
		curDirectory = path.dirname(curDirectory);
	}

	while (curDirectory !== '/') {
		if (
			fs.existsSync(path.join(curDirectory, 'pnpm-workspace.yaml')) ||
			fs.existsSync(path.join(curDirectory, 'pnpm-lock.yaml'))
		) {
			return curDirectory;
		}

		curDirectory = path.dirname(curDirectory);
	}
}

/**
	Gets the base project directory (for monorepos, the root project) using the following heuristic:
	- There must be a package.json file in the base project directory root
	- If the directory with a package.json does not have a pnpm-lock.yaml, it means that the project is part of a monorepo.
	- If a monorepo was detected, that means that the base directory must have a pnpm-workspace.yaml file with a `packages` property that has a matching glob entry that matches
*/
export function getProjectDir(
	pathUrl: string,
	options?: GetProjectDirOptions
): string {
	// If pnpm-lock.yaml doesn't exist in the directory, continue checking in the above directory
	if (options?.monorepoRoot) {
		const curDirectory = pathUrl.startsWith('file://')
			? fileURLToPath(pathUrl)
			: pathUrl;

		const monorepoRoot = getMonorepoRoot(curDirectory);
		if (monorepoRoot === undefined) {
			throw new Error('Monorepo root not found.');
		}

		return monorepoRoot;
	} else {
		const pathDirectory = path.dirname(fileURLToPath(pathUrl));
		const getPackageJson = (cwd: string) => {
			const packageJsonPath = pkgUpSync({ cwd });
			if (packageJsonPath === undefined) {
				throw new Error('No project found.');
			}

			const packageJson = JSON.parse(
				fs.readFileSync(packageJsonPath).toString()
			) as {
				type: string;
			};

			return { packageJson, packageJsonPath };
		};

		let { packageJson, packageJsonPath } = getPackageJson(pathDirectory);

		// If the package.json only has "type": "module", search for another one
		while (
			packageJson.type === 'module' &&
			Object.keys(packageJson).length === 1
		) {
			const upperDirectory = path.join(path.dirname(packageJsonPath), '..');
			({ packageJson, packageJsonPath } = getPackageJson(upperDirectory));
		}

		const projectPath = path.dirname(packageJsonPath);
		return projectPath;
	}
}

export function chProjectDir(pathUrl: string, options?: GetProjectDirOptions) {
	const projectPath = getProjectDir(pathUrl, options);
	process.chdir(projectPath);
}
