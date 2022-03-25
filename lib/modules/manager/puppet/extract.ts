import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type { PackageDependency, PackageFile } from '../types';
import { RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT } from './constants';
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

  if (git && tag) {
    const githubUrl = isGithubUrl(git);
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
  } else {
    return {
      depName: moduleName,
      gitRef: true,
      sourceUrl: git,
      skipReason: 'invalid-version',
    };
  }
}

function getGitOwnerRepo(
  git: string,
  githubUrl: boolean
): string | PackageDependency {
  const genericGitSsh = RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT.exec(git);

  if (genericGitSsh) {
    return genericGitSsh[1].replace(regEx(/\.git$/), '');
  } else {
    if (githubUrl) {
      return git
        .replace(regEx(/^github:/), '')
        .replace(regEx(/^git\+/), '')
        .replace(regEx(/^https:\/\/github\.com\//), '')
        .replace(regEx(/\.git$/), '');
    } else {
      try {
        const url = new URL(git);
        return url.pathname
          .replace(regEx(/\.git$/), '')
          .replace(regEx(/^\//), '');
      } catch (err) {
        return {
          gitRef: true,
          sourceUrl: git,
          skipReason: 'invalid-url',
        };
      }
    }
  }
}

function isGithubUrl(git: string): boolean {
  return (
    git.startsWith('https://github.com') || git.startsWith('git@github.com')
  );
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
