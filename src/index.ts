import { NormalizedOutputOptions, OutputBundle, Plugin } from 'rollup';
import { sync } from 'glob';

import {
  ConsoleLogger,
  LogLevel,
  NodeJSFileSystem,
  setFileSystem,
} from '@angular/compiler-cli/private/localize';
import { extractTranslations } from './angular/packages/localize/tools/src/extract/index.js';
import { translateFiles } from './angular/packages/localize/tools/src/translate/index.js';
import { getOutputPathFn } from './angular/packages/localize/tools/src/translate/output_path.js';
import { Diagnostics } from './angular/packages/localize/tools/src/diagnostics.js';

type Options = {
  extract?: ExtractOptions;
  translate?: TranslateOptions;
  sourceLocale: string;
};

type TranslateOptions = {
  translationFilePaths: Parameters<typeof translateFiles>[0]['translationFilePaths'];
  translationFileLocales: Parameters<typeof translateFiles>[0]['translationFileLocales'];
};

type ExtractOptions = {
  localeOutput: string;
  format: Parameters<typeof extractTranslations>[0]['format'];
};

export function ngi18n(options: {
  extract: ExtractOptions;
  sourceLocale: Options['sourceLocale'];
}): Plugin;
export function ngi18n(options: {
  sourceLocale: Options['sourceLocale'];
  translate: TranslateOptions;
}): Plugin;
export function ngi18n(options: Options): Plugin {
  const { sourceLocale, extract, translate } = Object.assign(
    {
      sourceLocale: 'en',
    },
    options
  );
  return {
    name: 'custom-plugin',
    writeBundle(outputOptions: NormalizedOutputOptions, bundle: OutputBundle) {
      const rootPath = outputOptions.dir!;
      const sourceFilePaths = sync('**/*.js', { cwd: rootPath, nodir: true });
      const fileSystem = new NodeJSFileSystem();
      setFileSystem(fileSystem);

      if (extract) {
        extractTranslations({
          rootPath,
          sourceFilePaths,
          sourceLocale,
          format: extract.format,
          outputPath: extract.localeOutput ?? 'messages.json',
          logger: new ConsoleLogger(LogLevel.warn),
          useSourceMaps: !!outputOptions.sourcemap,
          useLegacyIds: extract.format === 'legacy-migrate',
          duplicateMessageHandling: 'warning',
          formatOptions: {},
          fileSystem,
        });
        return;
      }

      if (translate) {
        translateFiles({
          sourceRootPath: rootPath,
          sourceFilePaths,
          translationFilePaths: translate.translationFilePaths,
          translationFileLocales: translate.translationFileLocales,
          outputPathFn: getOutputPathFn(fileSystem, fileSystem.resolve(rootPath, '{{LOCALE}}')),
          diagnostics: new Diagnostics(),
          missingTranslation: 'warning',
          duplicateTranslation: 'warning',
          sourceLocale,
        });
      }
    },
  };
}
