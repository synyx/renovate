import { logger } from '../../../logger';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type { PackageDependency, PackageFile } from '../types';
import { getGitOwnerRepo, isGithubUrl } from './common';
import { parsePuppetfile } from './puppetfile-parser';
import type { PuppetfileModule } from './types';

function getForgeDependency(
  module: PuppetfileModule,
  forgeUrl?: string
): PackageDependency {
  const dep: PackageDependency = {
    depName: module.name,
    datasource: PuppetForgeDatasource.id,
    packageName: module.name,
    currentValue: module.version,
  };

  if (forgeUrl) {
    dep.registryUrls = [forgeUrl];
  }

  return dep;
}

function getGitDependency(module: PuppetfileModule): PackageDependency {
  const moduleName = module.name;

  const git = module.tags?.get('git');
  const tag = module.tags?.get('tag');

  if (!git || !tag) {
    return {
      depName: moduleName,
      gitRef: true,
      sourceUrl: git,
      skipReason: 'invalid-version',
    };
  }

  const parsedUrl = tryParseUrl(git);
  const githubUrl = isGithubUrl(git, parsedUrl);

  if (githubUrl && parsedUrl && parsedUrl.protocol !== 'https:') {
    logger.warn(
      `Access to github is only allowed for https, your url was: ${git}`
    );
    return {
      datasource: GithubTagsDatasource.id,
      depName: moduleName,
      gitRef: true,
      sourceUrl: git,
      skipReason: 'invalid-url',
    };
  }
  const gitOwnerRepo = getGitOwnerRepo(git, githubUrl);

  if (typeof gitOwnerRepo !== 'string') {
    // failed to parse git url
    return {
      depName: moduleName,
      ...gitOwnerRepo,
    };
  }

  return {
    depName: moduleName,
    packageName: githubUrl ? gitOwnerRepo : git,
    repo: githubUrl ? undefined : git,
    githubRepo: githubUrl ? gitOwnerRepo : undefined,
    sourceUrl: git,
    gitRef: true,
    currentValue: tag,
    datasource: githubUrl ? GithubTagsDatasource.id : GitTagsDatasource.id,
  };
}

function tryParseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch (err) {
    return undefined;
  }
}

function isGitModule(module: PuppetfileModule): boolean {
  return module.tags?.has('git') || false;
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('puppet.extractPackageFile()');

  const puppetFile = parsePuppetfile(content);
  const deps: PackageDependency[] = [];

  for (const [forgeUrl, modules] of puppetFile.entries()) {
    for (const module of modules) {
      let packageDependency: PackageDependency;

      if (isGitModule(module)) {
        packageDependency = getGitDependency(module);
      } else {
        packageDependency = getForgeDependency(module, forgeUrl);
      }

      if (module.skipReason) {
        // the PuppetfileModule skip reason is dominant over the packageDependency skip reason
        packageDependency.skipReason = module.skipReason;
      }

      deps.push(packageDependency);
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
