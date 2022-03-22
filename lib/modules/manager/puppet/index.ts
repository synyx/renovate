import { ProgrammingLanguage } from '../../../constants';
import { PuppetDatasource } from '../../datasource/puppet';

export { extractAllPackageFiles } from './extract';

export const language = ProgrammingLanguage.Ruby;

export const defaultConfig = {
  fileMatch: ['^Puppetfile$'],
};

export const supportedDatasources = [PuppetDatasource.id];
