import { NormalizedOutputOptions, OutputBundle, Plugin } from 'rollup';
import { sync } from 'glob';

import {
  ConsoleLogger,
  LogLevel,
  NodeJSFileSystem,
  setFileSystem,
} from '@angular/compiler-cli/private/localize';
import { extractTranslations } from './angular/packages/localize/tools/src/extract/index.js';
import {
  TranslateFilesOptions,
  translateFiles,
} from './angular/packages/localize/tools/src/translate/index.js';
import { getOutputPathFn } from './angular/packages/localize/tools/src/translate/output_path.js';
import { Diagnostics } from './angular/packages/localize/tools/src/diagnostics.js';

type Options = {
  /**
   * Provide `$localize` extraction settings
   */
  extract?: ExtractOptions;
  /**
   * Provide translation build settings.
   */
  translate?: TranslateOptions;
  /**
   * The locale of the source files.
   * A copy of the application will be created with no translation but just
   * the `$localize` calls stripped out.
   */
  sourceLocale: string;
};

type TranslateOptions = {
  /**
   * An array of paths to the translation files to load, either absolute or relative to the current
   * working directory.
   *
   * For each locale to be translated, there should be an element in `translationFilePaths`.
   * Each element is either an absolute path to the translation file, or an array of absolute paths
   * to translation files, for that locale.
   *
   * If the element contains more than one translation file, then the translations are merged.
   *
   * If allowed by the `duplicateTranslation` property, when more than one translation has the same
   * message id, the message from the earlier translation file in the array is used.
   *
   * For example, if the files are `[app.xlf, lib-1.xlf, lib-2.xlif]` then a message that appears in
   * `app.xlf` will override the same message in `lib-1.xlf` or `lib-2.xlf`.
   */
  translationFilePaths: TranslateFilesOptions['translationFilePaths'];
  /**
   * A collection of the target locales for the translation files.
   *
   * If there is a locale provided in `translationFileLocales` then this is used rather than a
   * locale extracted from the file itself.
   * If there is neither a provided locale nor a locale parsed from the file, then an error is
   * thrown.
   * If there are both a provided locale and a locale parsed from the file, and they are not the
   * same, then a warning is reported.
   */
  translationFileLocales: TranslateFilesOptions['translationFileLocales'];
};

type ExtractOptions = {
  localeOutput: string;
  /**
   * The format of the translation file.
   */
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
