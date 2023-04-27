import { Plugin } from 'rollup';
import { extractTranslations } from './angular/packages/localize/tools/src/extract/index.js';
import { translateFiles } from './angular/packages/localize/tools/src/translate/index.js';
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
export declare function ngi18n(options: {
    extract: ExtractOptions;
    sourceLocale: Options['sourceLocale'];
}): Plugin;
export declare function ngi18n(options: {
    sourceLocale: Options['sourceLocale'];
    translate: TranslateOptions;
}): Plugin;
export {};
