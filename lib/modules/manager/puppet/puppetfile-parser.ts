import { newlineRegex, regEx } from '../../../util/regex';
import type { PuppetForgeUrl, Puppetfile, PuppetfileModule } from './types';

const forgeRegex = regEx(/^forge\s+['"]([^'"]+)['"]/);

export function parsePuppetfile(content: string): Puppetfile {
  const puppetfile: Puppetfile = new Map<PuppetForgeUrl, PuppetfileModule[]>();

  let currentForge = undefined;
  let currentPuppetfileModule: PuppetfileModule = {};

  for (const rawLine of content.split(newlineRegex)) {
    // remove comments
    const line = rawLine.replace(regEx(/#.*$/), '');

    const forgeResult = forgeRegex.exec(line);
    if (forgeResult) {
      addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);

      currentPuppetfileModule = {};

      currentForge = forgeResult[1];
      continue;
    }

    const moduleStart = line.startsWith('mod');

    if (moduleStart) {
      addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);
      currentPuppetfileModule = {};
    }

    const moduleValueRegex = regEx(/(?:\s*:(\w+)\s+=>\s+)?['"]([^'"]+)['"]/g);
    let moduleValue: RegExpExecArray | null;

    while ((moduleValue = moduleValueRegex.exec(line)) !== null) {
      const key = moduleValue[1];
      const value = moduleValue[2];

      if (key) {
        currentPuppetfileModule.tags =
          currentPuppetfileModule.tags || new Map();
        currentPuppetfileModule.tags.set(key, value);
      } else {
        fillPuppetfileModule(currentPuppetfileModule, value);
      }
    }
  }

  addPuppetfileModule(puppetfile, currentForge, currentPuppetfileModule);

  return puppetfile;
}

function fillPuppetfileModule(
  currentPuppetfileModule: PuppetfileModule,
  value: string
): void {
  // "positional" module values
  if (currentPuppetfileModule.name === undefined) {
    // moduleName
    currentPuppetfileModule.name = value;
  } else if (currentPuppetfileModule.version === undefined) {
    // second value without a key is the version
    currentPuppetfileModule.version = value;
  } else {
    // 3+ value without a key is not supported
    currentPuppetfileModule.skipReason = 'invalid-config';
  }
}

function addPuppetfileModule(
  puppetfile: Puppetfile,
  currentForge: string | undefined,
  module: PuppetfileModule
): void {
  if (Object.keys(module).length === 0) {
    return;
  }

  if (!puppetfile.has(currentForge)) {
    puppetfile.set(currentForge, []);
  }

  puppetfile.get(currentForge)?.push(module);
}
