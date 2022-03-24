import type { SkipReason } from '../../../types';
import { regEx } from '../../../util/regex';
import { defaultRegistry } from '.';

export interface PuppetfileModule {
  name?: string;
  version?: string;
  tags?: Map<string, string>;
  skipReasons?: SkipReason[];
}

export type PuppetForgeUrl = string;
export type Puppetfile = Map<PuppetForgeUrl, PuppetfileModule[]>;

const lineTerminationRegex = regEx(`\r?\n`);
const forgeRegex = regEx(/^forge\s+['"]([^'"]+)['"]/);

export function parsePuppetfile(content: string): Puppetfile {
  const puppetfile: Puppetfile = new Map<PuppetForgeUrl, PuppetfileModule[]>();

  let currentForge = defaultRegistry;
  let currentPuppetfileModule: PuppetfileModule = {};

  for (const line of content.split(lineTerminationRegex)) {
    if (forgeRegex.test(line)) {
      addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);

      currentPuppetfileModule = {};

      currentForge = forgeRegex.exec(line)[1];
      continue;
    }

    const moduleStart = line.startsWith('mod');

    if (moduleStart) {
      addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);
      currentPuppetfileModule = {};
    }

    const moduleValueRegex = regEx(/(?:\s*:(\w+)\s+=>\s+)?['"]([^'"]+)['"]/g);
    let moduleValue: RegExpExecArray;

    while ((moduleValue = moduleValueRegex.exec(line)) !== null) {
      const key = moduleValue[1];
      const value = moduleValue[2];

      if (key) {
        currentPuppetfileModule.tags = currentPuppetfileModule.tags || new Map();
        currentPuppetfileModule.tags.set(key, value);
      } else {
        // "positional" module values
        if (currentPuppetfileModule.name === undefined) {
          // moduleName
          currentPuppetfileModule.name = value;

          // eslint-disable-next-line no-negated-condition
        } else if (currentPuppetfileModule.version === undefined) {
          // second value without a key is the version
          currentPuppetfileModule.version = value;
        } else {
          // 3+ value without a key is not supported
          currentPuppetfileModule.skipReasons = currentPuppetfileModule.skipReasons || [];
          currentPuppetfileModule.skipReasons.push('invalid-config');
        }
      }
    }
  }

  addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);

  return puppetfile;
}

function addPuppetfileModule(
  puppetfile: Puppetfile,
  currentForge: string,
  module: PuppetfileModule
): void {
  if (Object.keys(module).length === 0) {
    return;
  }

  if (!puppetfile.has(currentForge)) {
    puppetfile.set(currentForge, []);
  }

  puppetfile.get(currentForge).push(module);
}
