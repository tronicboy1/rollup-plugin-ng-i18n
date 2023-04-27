# About this Package

This is a plugin for Vite/Rollup allowing you to use the Angular Localize i18n package (@angular/localize) in Vite/Rollup.

The `@angular/localize` package is unique from many i18n solutions in that it focuses on providing different compilations for each target language. This allows us to improve app performance and reduce the hassle associated with i18n.

# Usage

This package must be used alongside the `@angular/localize` package and you must include the `@angular/localize/init` package in your build.

```javascript
// Or in main.ts, index.ts, etc.
import './wc-lit-todos';
```

You can then use the `$localize` global variable provided by the `@angular/localize` to mark tags for translation.

```typescript
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("wc-greeting")
export class WcGreeting extends LitElement {
  @property() user = '(;)
  render() {
    return html`<h1>${$localize`Hello, ${this.user}`}</h1>`;
  }
}
```

Unfortunately, the `i18n` tag is not supported as in Angular.

# Building

There are two parts to using the package.

1. Generating base translation files
1. Using translations to generate builds

## Generating base translation files

Just like in the Angular version, you must first generate a base messages file to write translations for. This can be done through using the `@angular/localize` bin function `localize-extract` or programmatically using the plugin in a vite configuration file as seen below:

```typescript
import { defineConfig } from 'vite';
import { ngi18n } from 'rollup-plugin-ng-i18n';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ngi18n({
      extract: { localeOutput: 'messages.json', format: 'json' },
      sourceLocale: 'en',
    }),
  ],
});
```

The base messages file will be outputted to your output folder along with regular build files. I suggest committing this to your project file in a directory like `locale/messages.json`.

## Using Translations to Build

Next, we can translate the base translation file to our target files.

`locale/messages.ja.json`

```json
{
  "locale": "ja",
  "translations": {
    "4584092443788135411": "こんにちは {$PH}"
  }
}
```

`locale/messages.es.json`

```json
{
  "locale": "es",
  "translations": {
    "4584092443788135411": "Hola {$PH}"
  }
}
```

We must then reference this translations in our vite config as seen below:

```typescript
import { defineConfig } from 'vite';
import { ngi18n } from 'rollup-plugin-ng-i18n';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ngi18n({
      translate: {
        translationFilePaths: ['./locale/ja.json', './locale/es.json'],
        translationFileLocales: ['ja', 'es'],
      },
      sourceLocale: 'en',
    }),
  ],
});
```

Running vite with the above config will yield us with three subfolders in our build folder: es/index.js, ja/index.js and the original en/index.js.

# License

Distributed under the MIT License.

I take no responsibility for any breaking changes.

# Accredation

This package uses the source code in the [Angular GitHub Repository](https://github.com/angular/angular/tree/main/packages/localize) maintained by Google. The `@angular/localize` source code is not commited to this package; it is used as a submodule to ensure maintainability.

I personally want to thank the Angular team for Angular, and the brilliant approach to i18n they devised.

Also of course a big thanks to the Vite and Rollup crew for providing a greate build platform that can be extended like this.
