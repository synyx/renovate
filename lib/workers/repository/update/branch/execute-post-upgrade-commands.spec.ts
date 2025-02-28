import { fs, git } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { StatusResult } from '../../../../util/git/types';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import * as postUpgradeCommands from './execute-post-upgrade-commands';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe('workers/repository/update/branch/execute-post-upgrade-commands', () => {
  describe('postUpgradeCommandsExecutor', () => {
    it('handles an artifact which is a directory', async () => {
      const commands: BranchUpgradeConfig[] = [
        {
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'update',
            commands: ['disallowed_command'],
          },
        },
      ];
      const config: BranchConfig = {
        updatedPackageFiles: [],
        updatedArtifacts: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        artifactErrors: [],
        upgrades: [],
        branchName: 'main',
      };
      git.getRepoStatus.mockResolvedValueOnce({
        modified: [],
        not_added: [],
        deleted: [],
      } as StatusResult);
      GlobalConfig.set({
        localDir: __dirname,
        allowedPostUpgradeCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config
      );

      expect(res.updatedArtifacts).toHaveLength(2);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });
  });
});
