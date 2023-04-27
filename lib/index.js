var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b ||= {})
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/index.ts
import glob from "glob";
import {
  ConsoleLogger,
  LogLevel,
  NodeJSFileSystem,
  setFileSystem
} from "@angular/compiler-cli/private/localize";

// src/angular/packages/localize/tools/src/diagnostics.ts
var Diagnostics = class {
  constructor() {
    this.messages = [];
  }
  get hasErrors() {
    return this.messages.some((m) => m.type === "error");
  }
  add(type, message) {
    if (type !== "ignore") {
      this.messages.push({ type, message });
    }
  }
  warn(message) {
    this.messages.push({ type: "warning", message });
  }
  error(message) {
    this.messages.push({ type: "error", message });
  }
  merge(other) {
    this.messages.push(...other.messages);
  }
  formatDiagnostics(message) {
    const errors = this.messages.filter((d) => d.type === "error").map((d) => " - " + d.message);
    const warnings = this.messages.filter((d) => d.type === "warning").map((d) => " - " + d.message);
    if (errors.length) {
      message += "\nERRORS:\n" + errors.join("\n");
    }
    if (warnings.length) {
      message += "\nWARNINGS:\n" + warnings.join("\n");
    }
    return message;
  }
};

// src/angular/packages/localize/tools/src/source_file_utils.ts
import { getFileSystem } from "@angular/compiler-cli/private/localize";
import { \u0275isMissingTranslationError, \u0275makeTemplateObject, \u0275translate } from "@angular/localize";
import { types as t } from "@babel/core";
function isLocalize(expression, localizeName) {
  return isNamedIdentifier(expression, localizeName) && isGlobalIdentifier(expression);
}
function isNamedIdentifier(expression, name) {
  return expression.isIdentifier() && expression.node.name === name;
}
function isGlobalIdentifier(identifier) {
  return !identifier.scope || !identifier.scope.hasBinding(identifier.node.name);
}
function buildLocalizeReplacement(messageParts, substitutions) {
  let mappedString = t.stringLiteral(messageParts[0]);
  for (let i = 1; i < messageParts.length; i++) {
    mappedString = t.binaryExpression("+", mappedString, wrapInParensIfNecessary(substitutions[i - 1]));
    mappedString = t.binaryExpression("+", mappedString, t.stringLiteral(messageParts[i]));
  }
  return mappedString;
}
function unwrapMessagePartsFromLocalizeCall(call, fs = getFileSystem()) {
  let cooked = call.get("arguments")[0];
  if (cooked === void 0) {
    throw new BabelParseError(call.node, "`$localize` called without any arguments.");
  }
  if (!cooked.isExpression()) {
    throw new BabelParseError(
      cooked.node,
      "Unexpected argument to `$localize` (expected an array)."
    );
  }
  let raw = cooked;
  if (cooked.isLogicalExpression() && cooked.node.operator === "||" && cooked.get("left").isIdentifier()) {
    const right = cooked.get("right");
    if (right.isAssignmentExpression()) {
      cooked = right.get("right");
      if (!cooked.isExpression()) {
        throw new BabelParseError(
          cooked.node,
          'Unexpected "makeTemplateObject()" function (expected an expression).'
        );
      }
    } else if (right.isSequenceExpression()) {
      const expressions = right.get("expressions");
      if (expressions.length > 2) {
        const [first, second] = expressions;
        if (first.isAssignmentExpression()) {
          cooked = first.get("right");
          if (!cooked.isExpression()) {
            throw new BabelParseError(
              first.node,
              "Unexpected cooked value, expected an expression."
            );
          }
          if (second.isAssignmentExpression()) {
            raw = second.get("right");
            if (!raw.isExpression()) {
              throw new BabelParseError(
                second.node,
                "Unexpected raw value, expected an expression."
              );
            }
          } else {
            raw = cooked;
          }
        }
      }
    }
  }
  if (cooked.isCallExpression()) {
    let call2 = cooked;
    if (call2.get("arguments").length === 0) {
      call2 = unwrapLazyLoadHelperCall(call2);
    }
    cooked = call2.get("arguments")[0];
    if (!cooked.isExpression()) {
      throw new BabelParseError(
        cooked.node,
        'Unexpected `cooked` argument to the "makeTemplateObject()" function (expected an expression).'
      );
    }
    const arg2 = call2.get("arguments")[1];
    if (arg2 && !arg2.isExpression()) {
      throw new BabelParseError(
        arg2.node,
        'Unexpected `raw` argument to the "makeTemplateObject()" function (expected an expression).'
      );
    }
    raw = arg2 !== void 0 ? arg2 : cooked;
  }
  const [cookedStrings] = unwrapStringLiteralArray(cooked, fs);
  const [rawStrings, rawLocations] = unwrapStringLiteralArray(raw, fs);
  return [\u0275makeTemplateObject(cookedStrings, rawStrings), rawLocations];
}
function unwrapSubstitutionsFromLocalizeCall(call, fs = getFileSystem()) {
  const expressions = call.get("arguments").splice(1);
  if (!isArrayOfExpressions(expressions)) {
    const badExpression = expressions.find((expression) => !expression.isExpression());
    throw new BabelParseError(
      badExpression.node,
      "Invalid substitutions for `$localize` (expected all substitution arguments to be expressions)."
    );
  }
  return [
    expressions.map((path) => path.node),
    expressions.map((expression) => getLocation(fs, expression))
  ];
}
function unwrapMessagePartsFromTemplateLiteral(elements, fs = getFileSystem()) {
  const cooked = elements.map((q) => {
    if (q.node.value.cooked === void 0) {
      throw new BabelParseError(
        q.node,
        `Unexpected undefined message part in "${elements.map((q2) => q2.node.value.cooked)}"`
      );
    }
    return q.node.value.cooked;
  });
  const raw = elements.map((q) => q.node.value.raw);
  const locations = elements.map((q) => getLocation(fs, q));
  return [\u0275makeTemplateObject(cooked, raw), locations];
}
function unwrapExpressionsFromTemplateLiteral(quasi, fs = getFileSystem()) {
  return [
    quasi.node.expressions,
    quasi.get("expressions").map((e) => getLocation(fs, e))
  ];
}
function wrapInParensIfNecessary(expression) {
  if (t.isBinaryExpression(expression)) {
    return t.parenthesizedExpression(expression);
  } else {
    return expression;
  }
}
function unwrapStringLiteralArray(array, fs = getFileSystem()) {
  if (!isStringLiteralArray(array.node)) {
    throw new BabelParseError(
      array.node,
      "Unexpected messageParts for `$localize` (expected an array of strings)."
    );
  }
  const elements = array.get("elements");
  return [elements.map((str) => str.node.value), elements.map((str) => getLocation(fs, str))];
}
function unwrapLazyLoadHelperCall(call) {
  const callee = call.get("callee");
  if (!callee.isIdentifier()) {
    throw new BabelParseError(
      callee.node,
      "Unexpected lazy-load helper call (expected a call of the form `_templateObject()`)."
    );
  }
  const lazyLoadBinding = call.scope.getBinding(callee.node.name);
  if (!lazyLoadBinding) {
    throw new BabelParseError(callee.node, "Missing declaration for lazy-load helper function");
  }
  const lazyLoadFn = lazyLoadBinding.path;
  if (!lazyLoadFn.isFunctionDeclaration()) {
    throw new BabelParseError(
      lazyLoadFn.node,
      "Unexpected expression (expected a function declaration"
    );
  }
  const returnedNode = getReturnedExpression(lazyLoadFn);
  if (returnedNode.isCallExpression()) {
    return returnedNode;
  }
  if (returnedNode.isIdentifier()) {
    const identifierName = returnedNode.node.name;
    const declaration = returnedNode.scope.getBinding(identifierName);
    if (declaration === void 0) {
      throw new BabelParseError(
        returnedNode.node,
        "Missing declaration for return value from helper."
      );
    }
    if (!declaration.path.isVariableDeclarator()) {
      throw new BabelParseError(
        declaration.path.node,
        "Unexpected helper return value declaration (expected a variable declaration)."
      );
    }
    const initializer = declaration.path.get("init");
    if (!initializer.isCallExpression()) {
      throw new BabelParseError(
        declaration.path.node,
        "Unexpected return value from helper (expected a call expression)."
      );
    }
    if (lazyLoadBinding.references === 1) {
      lazyLoadFn.remove();
    }
    return initializer;
  }
  return call;
}
function getReturnedExpression(fn) {
  const bodyStatements = fn.get("body").get("body");
  for (const statement of bodyStatements) {
    if (statement.isReturnStatement()) {
      const argument = statement.get("argument");
      if (argument.isSequenceExpression()) {
        const expressions = argument.get("expressions");
        return Array.isArray(expressions) ? expressions[expressions.length - 1] : expressions;
      } else if (argument.isExpression()) {
        return argument;
      } else {
        throw new BabelParseError(
          statement.node,
          "Invalid return argument in helper function (expected an expression)."
        );
      }
    }
  }
  throw new BabelParseError(fn.node, "Missing return statement in helper function.");
}
function isStringLiteralArray(node) {
  return t.isArrayExpression(node) && node.elements.every((element) => t.isStringLiteral(element));
}
function isArrayOfExpressions(paths) {
  return paths.every((element) => element.isExpression());
}
function translate(diagnostics, translations, messageParts, substitutions, missingTranslation) {
  try {
    return \u0275translate(translations, messageParts, substitutions);
  } catch (e) {
    if (\u0275isMissingTranslationError(e)) {
      diagnostics.add(missingTranslation, e.message);
      return [
        \u0275makeTemplateObject(e.parsedMessage.messageParts, e.parsedMessage.messageParts),
        substitutions
      ];
    } else {
      diagnostics.error(e.message);
      return [messageParts, substitutions];
    }
  }
}
var BabelParseError = class extends Error {
  constructor(node, message) {
    super(message);
    this.node = node;
    this.type = "BabelParseError";
  }
};
function isBabelParseError(e) {
  return e.type === "BabelParseError";
}
function buildCodeFrameError(fs, path, e) {
  let filename = path.hub.file.opts.filename;
  if (filename) {
    filename = fs.resolve(filename);
    let cwd = path.hub.file.opts.cwd;
    if (cwd) {
      cwd = fs.resolve(cwd);
      filename = fs.relative(cwd, filename);
    }
  } else {
    filename = "(unknown file)";
  }
  const message = path.hub.file.buildCodeFrameError(e.node, e.message).message;
  return `${filename}: ${message}`;
}
function getLocation(fs, startPath, endPath) {
  const startLocation = startPath.node.loc;
  const file = getFileFromPath(fs, startPath);
  if (!startLocation || !file) {
    return void 0;
  }
  const endLocation = endPath && getFileFromPath(fs, endPath) === file && endPath.node.loc || startLocation;
  return {
    start: getLineAndColumn(startLocation.start),
    end: getLineAndColumn(endLocation.end),
    file,
    text: getText(startPath)
  };
}
function serializeLocationPosition(location) {
  const endLineString = location.end !== void 0 && location.end.line !== location.start.line ? `,${location.end.line + 1}` : "";
  return `${location.start.line + 1}${endLineString}`;
}
function getFileFromPath(fs, path) {
  var _a, _b;
  const opts = path == null ? void 0 : path.hub.file.opts;
  const filename = opts == null ? void 0 : opts.filename;
  if (!filename || !opts.cwd) {
    return null;
  }
  const relativePath = fs.relative(opts.cwd, filename);
  const root = (_b = (_a = opts.generatorOpts) == null ? void 0 : _a.sourceRoot) != null ? _b : opts.cwd;
  const absPath = fs.resolve(root, relativePath);
  return absPath;
}
function getLineAndColumn(loc) {
  return { line: loc.line - 1, column: loc.column };
}
function getText(path) {
  if (path.node.start == null || path.node.end == null) {
    return void 0;
  }
  return path.hub.file.code.substring(path.node.start, path.node.end);
}

// src/angular/packages/localize/tools/src/extract/duplicates.ts
function checkDuplicateMessages(fs, messages, duplicateMessageHandling, basePath) {
  const diagnostics = new Diagnostics();
  if (duplicateMessageHandling === "ignore")
    return diagnostics;
  const messageMap = /* @__PURE__ */ new Map();
  for (const message of messages) {
    if (messageMap.has(message.id)) {
      messageMap.get(message.id).push(message);
    } else {
      messageMap.set(message.id, [message]);
    }
  }
  for (const duplicates of messageMap.values()) {
    if (duplicates.length <= 1)
      continue;
    if (duplicates.every((message) => message.text === duplicates[0].text))
      continue;
    const diagnosticMessage = `Duplicate messages with id "${duplicates[0].id}":
` + duplicates.map((message) => serializeMessage(fs, basePath, message)).join("\n");
    diagnostics.add(duplicateMessageHandling, diagnosticMessage);
  }
  return diagnostics;
}
function serializeMessage(fs, basePath, message) {
  if (message.location === void 0) {
    return `   - "${message.text}"`;
  } else {
    const locationFile = fs.relative(basePath, message.location.file);
    const locationPosition = serializeLocationPosition(message.location);
    return `   - "${message.text}" : ${locationFile}:${locationPosition}`;
  }
}

// src/angular/packages/localize/tools/src/extract/extraction.ts
import { SourceFileLoader } from "@angular/compiler-cli/private/localize";
import { transformSync } from "@babel/core";

// src/angular/packages/localize/tools/src/extract/source_files/es2015_extract_plugin.ts
import { \u0275parseMessage } from "@angular/localize";
function makeEs2015ExtractPlugin(fs, messages, localizeName = "$localize") {
  return {
    visitor: {
      TaggedTemplateExpression(path) {
        const tag = path.get("tag");
        if (isNamedIdentifier(tag, localizeName) && isGlobalIdentifier(tag)) {
          const quasiPath = path.get("quasi");
          const [messageParts, messagePartLocations] = unwrapMessagePartsFromTemplateLiteral(quasiPath.get("quasis"), fs);
          const [expressions, expressionLocations] = unwrapExpressionsFromTemplateLiteral(quasiPath, fs);
          const location = getLocation(fs, quasiPath);
          const message = \u0275parseMessage(
            messageParts,
            expressions,
            location,
            messagePartLocations,
            expressionLocations
          );
          messages.push(message);
        }
      }
    }
  };
}

// src/angular/packages/localize/tools/src/extract/source_files/es5_extract_plugin.ts
import { \u0275parseMessage as \u0275parseMessage2 } from "@angular/localize";
function makeEs5ExtractPlugin(fs, messages, localizeName = "$localize") {
  return {
    visitor: {
      CallExpression(callPath) {
        try {
          const calleePath = callPath.get("callee");
          if (isNamedIdentifier(calleePath, localizeName) && isGlobalIdentifier(calleePath)) {
            const [messageParts, messagePartLocations] = unwrapMessagePartsFromLocalizeCall(callPath, fs);
            const [expressions, expressionLocations] = unwrapSubstitutionsFromLocalizeCall(callPath, fs);
            const [messagePartsArg, expressionsArg] = callPath.get("arguments");
            const location = getLocation(fs, messagePartsArg, expressionsArg);
            const message = \u0275parseMessage2(
              messageParts,
              expressions,
              location,
              messagePartLocations,
              expressionLocations
            );
            messages.push(message);
          }
        } catch (e) {
          if (isBabelParseError(e)) {
            throw buildCodeFrameError(fs, callPath, e);
          } else {
            throw e;
          }
        }
      }
    }
  };
}

// src/angular/packages/localize/tools/src/extract/extraction.ts
var MessageExtractor = class {
  constructor(fs, logger, { basePath, useSourceMaps = true, localizeName = "$localize" }) {
    this.fs = fs;
    this.logger = logger;
    this.basePath = basePath;
    this.useSourceMaps = useSourceMaps;
    this.localizeName = localizeName;
    this.loader = new SourceFileLoader(this.fs, this.logger, { webpack: basePath });
  }
  extractMessages(filename) {
    const messages = [];
    const sourceCode = this.fs.readFile(this.fs.resolve(this.basePath, filename));
    if (sourceCode.includes(this.localizeName)) {
      transformSync(sourceCode, {
        sourceRoot: this.basePath,
        filename,
        plugins: [
          makeEs2015ExtractPlugin(this.fs, messages, this.localizeName),
          makeEs5ExtractPlugin(this.fs, messages, this.localizeName)
        ],
        code: false,
        ast: false
      });
      if (this.useSourceMaps && messages.length > 0) {
        this.updateSourceLocations(filename, sourceCode, messages);
      }
    }
    return messages;
  }
  /**
   * Update the location of each message to point to the source-mapped original source location, if
   * available.
   */
  updateSourceLocations(filename, contents, messages) {
    const sourceFile = this.loader.loadSourceFile(this.fs.resolve(this.basePath, filename), contents);
    if (sourceFile === null) {
      return;
    }
    for (const message of messages) {
      if (message.location !== void 0) {
        message.location = this.getOriginalLocation(sourceFile, message.location);
        if (message.messagePartLocations) {
          message.messagePartLocations = message.messagePartLocations.map(
            (location) => location && this.getOriginalLocation(sourceFile, location)
          );
        }
        if (message.substitutionLocations) {
          const placeholderNames = Object.keys(message.substitutionLocations);
          for (const placeholderName of placeholderNames) {
            const location = message.substitutionLocations[placeholderName];
            message.substitutionLocations[placeholderName] = location && this.getOriginalLocation(sourceFile, location);
          }
        }
      }
    }
  }
  /**
   * Find the original location using source-maps if available.
   *
   * @param sourceFile The generated `sourceFile` that contains the `location`.
   * @param location The location within the generated `sourceFile` that needs mapping.
   *
   * @returns A new location that refers to the original source location mapped from the given
   *     `location` in the generated `sourceFile`.
   */
  getOriginalLocation(sourceFile, location) {
    const originalStart = sourceFile.getOriginalLocation(location.start.line, location.start.column);
    if (originalStart === null) {
      return location;
    }
    const originalEnd = sourceFile.getOriginalLocation(location.end.line, location.end.column);
    const start = { line: originalStart.line, column: originalStart.column };
    const end = originalEnd !== null && originalEnd.file === originalStart.file ? { line: originalEnd.line, column: originalEnd.column } : start;
    const originalSourceFile = sourceFile.sources.find((sf) => (sf == null ? void 0 : sf.sourcePath) === originalStart.file);
    const startPos = originalSourceFile.startOfLinePositions[start.line] + start.column;
    const endPos = originalSourceFile.startOfLinePositions[end.line] + end.column;
    const text = originalSourceFile.contents.substring(startPos, endPos).trim();
    return { file: originalStart.file, start, end, text };
  }
};

// src/angular/packages/localize/tools/src/extract/translation_files/utils.ts
function consolidateMessages(messages, getMessageId2) {
  const messageGroups = /* @__PURE__ */ new Map();
  for (const message of messages) {
    const id = getMessageId2(message);
    if (!messageGroups.has(id)) {
      messageGroups.set(id, [message]);
    } else {
      messageGroups.get(id).push(message);
    }
  }
  for (const messages2 of messageGroups.values()) {
    messages2.sort(compareLocations);
  }
  return Array.from(messageGroups.values()).sort((a1, a2) => compareLocations(a1[0], a2[0]));
}
function hasLocation(message) {
  return message.location !== void 0;
}
function compareLocations({ location: location1 }, { location: location2 }) {
  if (location1 === location2) {
    return 0;
  }
  if (location1 === void 0) {
    return -1;
  }
  if (location2 === void 0) {
    return 1;
  }
  if (location1.file !== location2.file) {
    return location1.file < location2.file ? -1 : 1;
  }
  if (location1.start.line !== location2.start.line) {
    return location1.start.line < location2.start.line ? -1 : 1;
  }
  if (location1.start.column !== location2.start.column) {
    return location1.start.column < location2.start.column ? -1 : 1;
  }
  return 0;
}

// src/angular/packages/localize/tools/src/extract/translation_files/arb_translation_serializer.ts
var ArbTranslationSerializer = class {
  constructor(sourceLocale, basePath, fs) {
    this.sourceLocale = sourceLocale;
    this.basePath = basePath;
    this.fs = fs;
  }
  serialize(messages) {
    const messageGroups = consolidateMessages(messages, (message) => getMessageId(message));
    let output = `{
  "@@locale": ${JSON.stringify(this.sourceLocale)}`;
    for (const duplicateMessages of messageGroups) {
      const message = duplicateMessages[0];
      const id = getMessageId(message);
      output += this.serializeMessage(id, message);
      output += this.serializeMeta(
        id,
        message.description,
        message.meaning,
        duplicateMessages.filter(hasLocation).map((m) => m.location)
      );
    }
    output += "\n}";
    return output;
  }
  serializeMessage(id, message) {
    return `,
  ${JSON.stringify(id)}: ${JSON.stringify(message.text)}`;
  }
  serializeMeta(id, description, meaning, locations) {
    const meta = [];
    if (description) {
      meta.push(`
    "description": ${JSON.stringify(description)}`);
    }
    if (meaning) {
      meta.push(`
    "x-meaning": ${JSON.stringify(meaning)}`);
    }
    if (locations.length > 0) {
      let locationStr = `
    "x-locations": [`;
      for (let i = 0; i < locations.length; i++) {
        locationStr += (i > 0 ? ",\n" : "\n") + this.serializeLocation(locations[i]);
      }
      locationStr += "\n    ]";
      meta.push(locationStr);
    }
    return meta.length > 0 ? `,
  ${JSON.stringify("@" + id)}: {${meta.join(",")}
  }` : "";
  }
  serializeLocation({ file, start, end }) {
    return [
      `      {`,
      `        "file": ${JSON.stringify(this.fs.relative(this.basePath, file))},`,
      `        "start": { "line": "${start.line}", "column": "${start.column}" },`,
      `        "end": { "line": "${end.line}", "column": "${end.column}" }`,
      `      }`
    ].join("\n");
  }
};
function getMessageId(message) {
  return message.customId || message.id;
}

// src/angular/packages/localize/tools/src/extract/translation_files/json_translation_serializer.ts
var SimpleJsonTranslationSerializer = class {
  constructor(sourceLocale) {
    this.sourceLocale = sourceLocale;
  }
  serialize(messages) {
    const fileObj = { locale: this.sourceLocale, translations: {} };
    for (const [message] of consolidateMessages(messages, (message2) => message2.id)) {
      fileObj.translations[message.id] = message.text;
    }
    return JSON.stringify(fileObj, null, 2);
  }
};

// src/angular/packages/localize/tools/src/extract/translation_files/legacy_message_id_migration_serializer.ts
var LegacyMessageIdMigrationSerializer = class {
  constructor(_diagnostics) {
    this._diagnostics = _diagnostics;
  }
  serialize(messages) {
    let hasMessages = false;
    const mapping = messages.reduce((output, message) => {
      if (shouldMigrate(message)) {
        for (const legacyId of message.legacyIds) {
          if (output.hasOwnProperty(legacyId)) {
            this._diagnostics.warn(`Detected duplicate legacy ID ${legacyId}.`);
          }
          output[legacyId] = message.id;
          hasMessages = true;
        }
      }
      return output;
    }, {});
    if (!hasMessages) {
      this._diagnostics.warn(
        "Could not find any legacy message IDs in source files while generating the legacy message migration file."
      );
    }
    return JSON.stringify(mapping, null, 2);
  }
};
function shouldMigrate(message) {
  return !message.customId && !!message.legacyIds && message.legacyIds.length > 0;
}

// src/angular/packages/localize/tools/src/extract/translation_files/xliff1_translation_serializer.ts
import { getFileSystem as getFileSystem2 } from "@angular/compiler-cli/private/localize";

// src/angular/packages/localize/tools/src/extract/translation_files/format_options.ts
function validateOptions(name, validOptions, options) {
  const validOptionsMap = new Map(validOptions);
  for (const option in options) {
    if (!validOptionsMap.has(option)) {
      throw new Error(
        `Invalid format option for ${name}: "${option}".
Allowed options are ${JSON.stringify(Array.from(validOptionsMap.keys()))}.`
      );
    }
    const validOptionValues = validOptionsMap.get(option);
    const optionValue = options[option];
    if (!validOptionValues.includes(optionValue)) {
      throw new Error(
        `Invalid format option value for ${name}: "${option}".
Allowed option values are ${JSON.stringify(validOptionValues)} but received "${optionValue}".`
      );
    }
  }
}

// src/angular/packages/localize/tools/src/extract/translation_files/icu_parsing.ts
function extractIcuPlaceholders(text) {
  const state = new StateStack();
  const pieces = new IcuPieces();
  const braces = /[{}]/g;
  let lastPos = 0;
  let match;
  while (match = braces.exec(text)) {
    if (match[0] == "{") {
      state.enterBlock();
    } else {
      state.leaveBlock();
    }
    if (state.getCurrent() === "placeholder") {
      const name = tryParsePlaceholder(text, braces.lastIndex);
      if (name) {
        pieces.addText(text.substring(lastPos, braces.lastIndex - 1));
        pieces.addPlaceholder(name);
        braces.lastIndex += name.length + 1;
        state.leaveBlock();
      } else {
        pieces.addText(text.substring(lastPos, braces.lastIndex));
        state.nestedIcu();
      }
    } else {
      pieces.addText(text.substring(lastPos, braces.lastIndex));
    }
    lastPos = braces.lastIndex;
  }
  pieces.addText(text.substring(lastPos));
  return pieces.toArray();
}
var IcuPieces = class {
  constructor() {
    this.pieces = [""];
  }
  /**
   * Add the given `text` to the current "static text" piece.
   *
   * Sequential calls to `addText()` will append to the current text piece.
   */
  addText(text) {
    this.pieces[this.pieces.length - 1] += text;
  }
  /**
   * Add the given placeholder `name` to the stored pieces.
   */
  addPlaceholder(name) {
    this.pieces.push(name);
    this.pieces.push("");
  }
  /**
   * Return the stored pieces as an array of strings.
   *
   * Even values are static strings (e.g. 0, 2, 4, etc)
   * Odd values are placeholder names (e.g. 1, 3, 5, etc)
   */
  toArray() {
    return this.pieces;
  }
};
var StateStack = class {
  constructor() {
    this.stack = [];
  }
  /**
   * Update the state upon entering a block.
   *
   * The new state is computed from the current state and added to the stack.
   */
  enterBlock() {
    const current = this.getCurrent();
    switch (current) {
      case "icu":
        this.stack.push("case");
        break;
      case "case":
        this.stack.push("placeholder");
        break;
      case "placeholder":
        this.stack.push("case");
        break;
      default:
        this.stack.push("icu");
        break;
    }
  }
  /**
   * Update the state upon leaving a block.
   *
   * The previous state is popped off the stack.
   */
  leaveBlock() {
    return this.stack.pop();
  }
  /**
   * Update the state upon arriving at a nested ICU.
   *
   * In this case, the current state of "placeholder" is incorrect, so this is popped off and the
   * correct "icu" state is stored.
   */
  nestedIcu() {
    const current = this.stack.pop();
    assert(current === "placeholder", "A nested ICU must replace a placeholder but got " + current);
    this.stack.push("icu");
  }
  /**
   * Get the current (most recent) state from the stack.
   */
  getCurrent() {
    return this.stack[this.stack.length - 1];
  }
};
function tryParsePlaceholder(text, start) {
  for (let i = start; i < text.length; i++) {
    if (text[i] === ",") {
      break;
    }
    if (text[i] === "}") {
      return text.substring(start, i);
    }
  }
  return null;
}
function assert(test, message) {
  if (!test) {
    throw new Error("Assertion failure: " + message);
  }
}

// src/angular/packages/localize/tools/src/extract/translation_files/xml_file.ts
var XmlFile = class {
  constructor() {
    this.output = '<?xml version="1.0" encoding="UTF-8" ?>\n';
    this.indent = "";
    this.elements = [];
    this.preservingWhitespace = false;
  }
  toString() {
    return this.output;
  }
  startTag(name, attributes = {}, { selfClosing = false, preserveWhitespace } = {}) {
    if (!this.preservingWhitespace) {
      this.output += this.indent;
    }
    this.output += `<${name}`;
    for (const [attrName, attrValue] of Object.entries(attributes)) {
      if (attrValue) {
        this.output += ` ${attrName}="${escapeXml(attrValue)}"`;
      }
    }
    if (selfClosing) {
      this.output += "/>";
    } else {
      this.output += ">";
      this.elements.push(name);
      this.incIndent();
    }
    if (preserveWhitespace !== void 0) {
      this.preservingWhitespace = preserveWhitespace;
    }
    if (!this.preservingWhitespace) {
      this.output += `
`;
    }
    return this;
  }
  endTag(name, { preserveWhitespace } = {}) {
    const expectedTag = this.elements.pop();
    if (expectedTag !== name) {
      throw new Error(`Unexpected closing tag: "${name}", expected: "${expectedTag}"`);
    }
    this.decIndent();
    if (!this.preservingWhitespace) {
      this.output += this.indent;
    }
    this.output += `</${name}>`;
    if (preserveWhitespace !== void 0) {
      this.preservingWhitespace = preserveWhitespace;
    }
    if (!this.preservingWhitespace) {
      this.output += `
`;
    }
    return this;
  }
  text(str) {
    this.output += escapeXml(str);
    return this;
  }
  rawText(str) {
    this.output += str;
    return this;
  }
  incIndent() {
    this.indent = this.indent + "  ";
  }
  decIndent() {
    this.indent = this.indent.slice(0, -2);
  }
};
var _ESCAPED_CHARS = [
  [/&/g, "&amp;"],
  [/"/g, "&quot;"],
  [/'/g, "&apos;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"]
];
function escapeXml(text) {
  return _ESCAPED_CHARS.reduce(
    (text2, entry) => text2.replace(entry[0], entry[1]),
    text
  );
}

// src/angular/packages/localize/tools/src/extract/translation_files/xliff1_translation_serializer.ts
var LEGACY_XLIFF_MESSAGE_LENGTH = 40;
var Xliff1TranslationSerializer = class {
  constructor(sourceLocale, basePath, useLegacyIds, formatOptions = {}, fs = getFileSystem2()) {
    this.sourceLocale = sourceLocale;
    this.basePath = basePath;
    this.useLegacyIds = useLegacyIds;
    this.formatOptions = formatOptions;
    this.fs = fs;
    validateOptions("Xliff1TranslationSerializer", [["xml:space", ["preserve"]]], formatOptions);
  }
  serialize(messages) {
    const messageGroups = consolidateMessages(messages, (message) => this.getMessageId(message));
    const xml = new XmlFile();
    xml.startTag("xliff", { "version": "1.2", "xmlns": "urn:oasis:names:tc:xliff:document:1.2" });
    xml.startTag("file", __spreadValues({
      "source-language": this.sourceLocale,
      "datatype": "plaintext",
      "original": "ng2.template"
    }, this.formatOptions));
    xml.startTag("body");
    for (const duplicateMessages of messageGroups) {
      const message = duplicateMessages[0];
      const id = this.getMessageId(message);
      xml.startTag("trans-unit", { id, datatype: "html" });
      xml.startTag("source", {}, { preserveWhitespace: true });
      this.serializeMessage(xml, message);
      xml.endTag("source", { preserveWhitespace: false });
      for (const { location } of duplicateMessages.filter(hasLocation)) {
        this.serializeLocation(xml, location);
      }
      if (message.description) {
        this.serializeNote(xml, "description", message.description);
      }
      if (message.meaning) {
        this.serializeNote(xml, "meaning", message.meaning);
      }
      xml.endTag("trans-unit");
    }
    xml.endTag("body");
    xml.endTag("file");
    xml.endTag("xliff");
    return xml.toString();
  }
  serializeMessage(xml, message) {
    var _a;
    const length = message.messageParts.length - 1;
    for (let i = 0; i < length; i++) {
      this.serializeTextPart(xml, message.messageParts[i]);
      const name = message.placeholderNames[i];
      const location = (_a = message.substitutionLocations) == null ? void 0 : _a[name];
      const associatedMessageId = message.associatedMessageIds && message.associatedMessageIds[name];
      this.serializePlaceholder(xml, name, location == null ? void 0 : location.text, associatedMessageId);
    }
    this.serializeTextPart(xml, message.messageParts[length]);
  }
  serializeTextPart(xml, text) {
    const pieces = extractIcuPlaceholders(text);
    const length = pieces.length - 1;
    for (let i = 0; i < length; i += 2) {
      xml.text(pieces[i]);
      this.serializePlaceholder(xml, pieces[i + 1], void 0, void 0);
    }
    xml.text(pieces[length]);
  }
  serializePlaceholder(xml, id, text, associatedId) {
    const attrs = { id };
    const ctype = getCtypeForPlaceholder(id);
    if (ctype !== null) {
      attrs.ctype = ctype;
    }
    if (text !== void 0) {
      attrs["equiv-text"] = text;
    }
    if (associatedId !== void 0) {
      attrs["xid"] = associatedId;
    }
    xml.startTag("x", attrs, { selfClosing: true });
  }
  serializeNote(xml, name, value) {
    xml.startTag("note", { priority: "1", from: name }, { preserveWhitespace: true });
    xml.text(value);
    xml.endTag("note", { preserveWhitespace: false });
  }
  serializeLocation(xml, location) {
    xml.startTag("context-group", { purpose: "location" });
    this.renderContext(xml, "sourcefile", this.fs.relative(this.basePath, location.file));
    const endLineString = location.end !== void 0 && location.end.line !== location.start.line ? `,${location.end.line + 1}` : "";
    this.renderContext(xml, "linenumber", `${location.start.line + 1}${endLineString}`);
    xml.endTag("context-group");
  }
  renderContext(xml, type, value) {
    xml.startTag("context", { "context-type": type }, { preserveWhitespace: true });
    xml.text(value);
    xml.endTag("context", { preserveWhitespace: false });
  }
  /**
   * Get the id for the given `message`.
   *
   * If there was a custom id provided, use that.
   *
   * If we have requested legacy message ids, then try to return the appropriate id
   * from the list of legacy ids that were extracted.
   *
   * Otherwise return the canonical message id.
   *
   * An Xliff 1.2 legacy message id is a hex encoded SHA-1 string, which is 40 characters long. See
   * https://csrc.nist.gov/csrc/media/publications/fips/180/4/final/documents/fips180-4-draft-aug2014.pdf
   */
  getMessageId(message) {
    return message.customId || this.useLegacyIds && message.legacyIds !== void 0 && message.legacyIds.find((id) => id.length === LEGACY_XLIFF_MESSAGE_LENGTH) || message.id;
  }
};
function getCtypeForPlaceholder(placeholder) {
  const tag = placeholder.replace(/^(START_|CLOSE_)/, "");
  switch (tag) {
    case "LINE_BREAK":
      return "lb";
    case "TAG_IMG":
      return "image";
    default:
      const element = tag.startsWith("TAG_") ? tag.replace(/^TAG_(.+)/, (_, tagName) => tagName.toLowerCase()) : TAG_MAP[tag];
      if (element === void 0) {
        return null;
      }
      return `x-${element}`;
  }
}
var TAG_MAP = {
  "LINK": "a",
  "BOLD_TEXT": "b",
  "EMPHASISED_TEXT": "em",
  "HEADING_LEVEL1": "h1",
  "HEADING_LEVEL2": "h2",
  "HEADING_LEVEL3": "h3",
  "HEADING_LEVEL4": "h4",
  "HEADING_LEVEL5": "h5",
  "HEADING_LEVEL6": "h6",
  "HORIZONTAL_RULE": "hr",
  "ITALIC_TEXT": "i",
  "LIST_ITEM": "li",
  "MEDIA_LINK": "link",
  "ORDERED_LIST": "ol",
  "PARAGRAPH": "p",
  "QUOTATION": "q",
  "STRIKETHROUGH_TEXT": "s",
  "SMALL_TEXT": "small",
  "SUBSTRIPT": "sub",
  "SUPERSCRIPT": "sup",
  "TABLE_BODY": "tbody",
  "TABLE_CELL": "td",
  "TABLE_FOOTER": "tfoot",
  "TABLE_HEADER_CELL": "th",
  "TABLE_HEADER": "thead",
  "TABLE_ROW": "tr",
  "MONOSPACED_TEXT": "tt",
  "UNDERLINED_TEXT": "u",
  "UNORDERED_LIST": "ul"
};

// src/angular/packages/localize/tools/src/extract/translation_files/xliff2_translation_serializer.ts
import { getFileSystem as getFileSystem3 } from "@angular/compiler-cli/private/localize";
var MAX_LEGACY_XLIFF_2_MESSAGE_LENGTH = 20;
var Xliff2TranslationSerializer = class {
  constructor(sourceLocale, basePath, useLegacyIds, formatOptions = {}, fs = getFileSystem3()) {
    this.sourceLocale = sourceLocale;
    this.basePath = basePath;
    this.useLegacyIds = useLegacyIds;
    this.formatOptions = formatOptions;
    this.fs = fs;
    this.currentPlaceholderId = 0;
    validateOptions("Xliff1TranslationSerializer", [["xml:space", ["preserve"]]], formatOptions);
  }
  serialize(messages) {
    const messageGroups = consolidateMessages(messages, (message) => this.getMessageId(message));
    const xml = new XmlFile();
    xml.startTag("xliff", {
      "version": "2.0",
      "xmlns": "urn:oasis:names:tc:xliff:document:2.0",
      "srcLang": this.sourceLocale
    });
    xml.startTag("file", __spreadValues({ "id": "ngi18n", "original": "ng.template" }, this.formatOptions));
    for (const duplicateMessages of messageGroups) {
      const message = duplicateMessages[0];
      const id = this.getMessageId(message);
      xml.startTag("unit", { id });
      const messagesWithLocations = duplicateMessages.filter(hasLocation);
      if (message.meaning || message.description || messagesWithLocations.length) {
        xml.startTag("notes");
        for (const { location: { file, start, end } } of messagesWithLocations) {
          const endLineString = end !== void 0 && end.line !== start.line ? `,${end.line + 1}` : "";
          this.serializeNote(
            xml,
            "location",
            `${this.fs.relative(this.basePath, file)}:${start.line + 1}${endLineString}`
          );
        }
        if (message.description) {
          this.serializeNote(xml, "description", message.description);
        }
        if (message.meaning) {
          this.serializeNote(xml, "meaning", message.meaning);
        }
        xml.endTag("notes");
      }
      xml.startTag("segment");
      xml.startTag("source", {}, { preserveWhitespace: true });
      this.serializeMessage(xml, message);
      xml.endTag("source", { preserveWhitespace: false });
      xml.endTag("segment");
      xml.endTag("unit");
    }
    xml.endTag("file");
    xml.endTag("xliff");
    return xml.toString();
  }
  serializeMessage(xml, message) {
    this.currentPlaceholderId = 0;
    const length = message.messageParts.length - 1;
    for (let i = 0; i < length; i++) {
      this.serializeTextPart(xml, message.messageParts[i]);
      const name = message.placeholderNames[i];
      const associatedMessageId = message.associatedMessageIds && message.associatedMessageIds[name];
      this.serializePlaceholder(xml, name, message.substitutionLocations, associatedMessageId);
    }
    this.serializeTextPart(xml, message.messageParts[length]);
  }
  serializeTextPart(xml, text) {
    const pieces = extractIcuPlaceholders(text);
    const length = pieces.length - 1;
    for (let i = 0; i < length; i += 2) {
      xml.text(pieces[i]);
      this.serializePlaceholder(xml, pieces[i + 1], void 0, void 0);
    }
    xml.text(pieces[length]);
  }
  serializePlaceholder(xml, placeholderName, substitutionLocations, associatedMessageId) {
    var _a, _b;
    const text = (_a = substitutionLocations == null ? void 0 : substitutionLocations[placeholderName]) == null ? void 0 : _a.text;
    if (placeholderName.startsWith("START_")) {
      const closingPlaceholderName = placeholderName.replace(/^START/, "CLOSE").replace(/_\d+$/, "");
      const closingText = (_b = substitutionLocations == null ? void 0 : substitutionLocations[closingPlaceholderName]) == null ? void 0 : _b.text;
      const attrs = {
        id: `${this.currentPlaceholderId++}`,
        equivStart: placeholderName,
        equivEnd: closingPlaceholderName
      };
      const type = getTypeForPlaceholder(placeholderName);
      if (type !== null) {
        attrs.type = type;
      }
      if (text !== void 0) {
        attrs.dispStart = text;
      }
      if (closingText !== void 0) {
        attrs.dispEnd = closingText;
      }
      xml.startTag("pc", attrs);
    } else if (placeholderName.startsWith("CLOSE_")) {
      xml.endTag("pc");
    } else {
      const attrs = {
        id: `${this.currentPlaceholderId++}`,
        equiv: placeholderName
      };
      const type = getTypeForPlaceholder(placeholderName);
      if (type !== null) {
        attrs.type = type;
      }
      if (text !== void 0) {
        attrs.disp = text;
      }
      if (associatedMessageId !== void 0) {
        attrs["subFlows"] = associatedMessageId;
      }
      xml.startTag("ph", attrs, { selfClosing: true });
    }
  }
  serializeNote(xml, name, value) {
    xml.startTag("note", { category: name }, { preserveWhitespace: true });
    xml.text(value);
    xml.endTag("note", { preserveWhitespace: false });
  }
  /**
   * Get the id for the given `message`.
   *
   * If there was a custom id provided, use that.
   *
   * If we have requested legacy message ids, then try to return the appropriate id
   * from the list of legacy ids that were extracted.
   *
   * Otherwise return the canonical message id.
   *
   * An Xliff 2.0 legacy message id is a 64 bit number encoded as a decimal string, which will have
   * at most 20 digits, since 2^65-1 = 36,893,488,147,419,103,231. This digest is based on:
   * https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/GoogleJsMessageIdGenerator.java
   */
  getMessageId(message) {
    return message.customId || this.useLegacyIds && message.legacyIds !== void 0 && message.legacyIds.find(
      (id) => id.length <= MAX_LEGACY_XLIFF_2_MESSAGE_LENGTH && !/[^0-9]/.test(id)
    ) || message.id;
  }
};
function getTypeForPlaceholder(placeholder) {
  const tag = placeholder.replace(/^(START_|CLOSE_)/, "").replace(/_\d+$/, "");
  switch (tag) {
    case "BOLD_TEXT":
    case "EMPHASISED_TEXT":
    case "ITALIC_TEXT":
    case "LINE_BREAK":
    case "STRIKETHROUGH_TEXT":
    case "UNDERLINED_TEXT":
      return "fmt";
    case "TAG_IMG":
      return "image";
    case "LINK":
      return "link";
    default:
      return /^(START_|CLOSE_)/.test(placeholder) ? "other" : null;
  }
}

// src/angular/packages/localize/tools/src/extract/translation_files/xmb_translation_serializer.ts
import { getFileSystem as getFileSystem4 } from "@angular/compiler-cli/private/localize";
var XmbTranslationSerializer = class {
  constructor(basePath, useLegacyIds, fs = getFileSystem4()) {
    this.basePath = basePath;
    this.useLegacyIds = useLegacyIds;
    this.fs = fs;
  }
  serialize(messages) {
    const messageGroups = consolidateMessages(messages, (message) => this.getMessageId(message));
    const xml = new XmlFile();
    xml.rawText(
      `<!DOCTYPE messagebundle [
<!ELEMENT messagebundle (msg)*>
<!ATTLIST messagebundle class CDATA #IMPLIED>

<!ELEMENT msg (#PCDATA|ph|source)*>
<!ATTLIST msg id CDATA #IMPLIED>
<!ATTLIST msg seq CDATA #IMPLIED>
<!ATTLIST msg name CDATA #IMPLIED>
<!ATTLIST msg desc CDATA #IMPLIED>
<!ATTLIST msg meaning CDATA #IMPLIED>
<!ATTLIST msg obsolete (obsolete) #IMPLIED>
<!ATTLIST msg xml:space (default|preserve) "default">
<!ATTLIST msg is_hidden CDATA #IMPLIED>

<!ELEMENT source (#PCDATA)>

<!ELEMENT ph (#PCDATA|ex)*>
<!ATTLIST ph name CDATA #REQUIRED>

<!ELEMENT ex (#PCDATA)>
]>
`
    );
    xml.startTag("messagebundle");
    for (const duplicateMessages of messageGroups) {
      const message = duplicateMessages[0];
      const id = this.getMessageId(message);
      xml.startTag(
        "msg",
        { id, desc: message.description, meaning: message.meaning },
        { preserveWhitespace: true }
      );
      if (message.location) {
        this.serializeLocation(xml, message.location);
      }
      this.serializeMessage(xml, message);
      xml.endTag("msg", { preserveWhitespace: false });
    }
    xml.endTag("messagebundle");
    return xml.toString();
  }
  serializeLocation(xml, location) {
    xml.startTag("source");
    const endLineString = location.end !== void 0 && location.end.line !== location.start.line ? `,${location.end.line + 1}` : "";
    xml.text(
      `${this.fs.relative(this.basePath, location.file)}:${location.start.line}${endLineString}`
    );
    xml.endTag("source");
  }
  serializeMessage(xml, message) {
    const length = message.messageParts.length - 1;
    for (let i = 0; i < length; i++) {
      this.serializeTextPart(xml, message.messageParts[i]);
      xml.startTag("ph", { name: message.placeholderNames[i] }, { selfClosing: true });
    }
    this.serializeTextPart(xml, message.messageParts[length]);
  }
  serializeTextPart(xml, text) {
    const pieces = extractIcuPlaceholders(text);
    const length = pieces.length - 1;
    for (let i = 0; i < length; i += 2) {
      xml.text(pieces[i]);
      xml.startTag("ph", { name: pieces[i + 1] }, { selfClosing: true });
    }
    xml.text(pieces[length]);
  }
  /**
   * Get the id for the given `message`.
   *
   * If there was a custom id provided, use that.
   *
   * If we have requested legacy message ids, then try to return the appropriate id
   * from the list of legacy ids that were extracted.
   *
   * Otherwise return the canonical message id.
   *
   * An XMB legacy message id is a 64 bit number encoded as a decimal string, which will have
   * at most 20 digits, since 2^65-1 = 36,893,488,147,419,103,231. This digest is based on:
   * https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/GoogleJsMessageIdGenerator.java
   */
  getMessageId(message) {
    return message.customId || this.useLegacyIds && message.legacyIds !== void 0 && message.legacyIds.find((id) => id.length <= 20 && !/[^0-9]/.test(id)) || message.id;
  }
};

// src/angular/packages/localize/tools/src/extract/index.ts
function extractTranslations({
  rootPath,
  sourceFilePaths,
  sourceLocale,
  format,
  outputPath: output,
  logger,
  useSourceMaps,
  useLegacyIds,
  duplicateMessageHandling,
  formatOptions = {},
  fileSystem: fs
}) {
  const basePath = fs.resolve(rootPath);
  const extractor = new MessageExtractor(fs, logger, { basePath, useSourceMaps });
  const messages = [];
  for (const file of sourceFilePaths) {
    messages.push(...extractor.extractMessages(file));
  }
  const diagnostics = checkDuplicateMessages(fs, messages, duplicateMessageHandling, basePath);
  if (diagnostics.hasErrors) {
    throw new Error(diagnostics.formatDiagnostics("Failed to extract messages"));
  }
  const outputPath = fs.resolve(rootPath, output);
  const serializer = getSerializer(
    format,
    sourceLocale,
    fs.dirname(outputPath),
    useLegacyIds,
    formatOptions,
    fs,
    diagnostics
  );
  const translationFile = serializer.serialize(messages);
  fs.ensureDir(fs.dirname(outputPath));
  fs.writeFile(outputPath, translationFile);
  if (diagnostics.messages.length) {
    logger.warn(diagnostics.formatDiagnostics("Messages extracted with warnings"));
  }
}
function getSerializer(format, sourceLocale, rootPath, useLegacyIds, formatOptions = {}, fs, diagnostics) {
  switch (format) {
    case "xlf":
    case "xlif":
    case "xliff":
      return new Xliff1TranslationSerializer(
        sourceLocale,
        rootPath,
        useLegacyIds,
        formatOptions,
        fs
      );
    case "xlf2":
    case "xlif2":
    case "xliff2":
      return new Xliff2TranslationSerializer(
        sourceLocale,
        rootPath,
        useLegacyIds,
        formatOptions,
        fs
      );
    case "xmb":
      return new XmbTranslationSerializer(rootPath, useLegacyIds, fs);
    case "json":
      return new SimpleJsonTranslationSerializer(sourceLocale);
    case "arb":
      return new ArbTranslationSerializer(sourceLocale, rootPath, fs);
    case "legacy-migrate":
      return new LegacyMessageIdMigrationSerializer(diagnostics);
  }
  throw new Error(`No translation serializer can handle the provided format: ${format}`);
}

// src/angular/packages/localize/tools/src/translate/index.ts
import { getFileSystem as getFileSystem7, relativeFrom } from "@angular/compiler-cli/private/localize";

// src/angular/packages/localize/tools/src/translate/asset_files/asset_translation_handler.ts
import { absoluteFrom } from "@angular/compiler-cli/private/localize";
var AssetTranslationHandler = class {
  constructor(fs) {
    this.fs = fs;
  }
  canTranslate(_relativeFilePath, _contents) {
    return true;
  }
  translate(diagnostics, _sourceRoot, relativeFilePath, contents, outputPathFn, translations, sourceLocale) {
    for (const translation of translations) {
      this.writeAssetFile(
        diagnostics,
        outputPathFn,
        translation.locale,
        relativeFilePath,
        contents
      );
    }
    if (sourceLocale !== void 0) {
      this.writeAssetFile(diagnostics, outputPathFn, sourceLocale, relativeFilePath, contents);
    }
  }
  writeAssetFile(diagnostics, outputPathFn, locale, relativeFilePath, contents) {
    try {
      const outputPath = absoluteFrom(outputPathFn(locale, relativeFilePath));
      this.fs.ensureDir(this.fs.dirname(outputPath));
      this.fs.writeFile(outputPath, contents);
    } catch (e) {
      diagnostics.error(e.message);
    }
  }
};

// src/angular/packages/localize/tools/src/translate/source_files/source_file_translation_handler.ts
import { absoluteFrom as absoluteFrom2 } from "@angular/compiler-cli/private/localize";
import babel from "@babel/core";

// src/angular/packages/localize/tools/src/translate/source_files/es2015_translate_plugin.ts
import { getFileSystem as getFileSystem5 } from "@angular/compiler-cli/private/localize";
function makeEs2015TranslatePlugin(diagnostics, translations, { missingTranslation = "error", localizeName = "$localize" } = {}, fs = getFileSystem5()) {
  return {
    visitor: {
      TaggedTemplateExpression(path) {
        try {
          const tag = path.get("tag");
          if (isLocalize(tag, localizeName)) {
            const [messageParts] = unwrapMessagePartsFromTemplateLiteral(path.get("quasi").get("quasis"), fs);
            const translated = translate(
              diagnostics,
              translations,
              messageParts,
              path.node.quasi.expressions,
              missingTranslation
            );
            path.replaceWith(buildLocalizeReplacement(translated[0], translated[1]));
          }
        } catch (e) {
          if (isBabelParseError(e)) {
            throw buildCodeFrameError(fs, path, e);
          } else {
            throw e;
          }
        }
      }
    }
  };
}

// src/angular/packages/localize/tools/src/translate/source_files/es5_translate_plugin.ts
import { getFileSystem as getFileSystem6 } from "@angular/compiler-cli/private/localize";
function makeEs5TranslatePlugin(diagnostics, translations, { missingTranslation = "error", localizeName = "$localize" } = {}, fs = getFileSystem6()) {
  return {
    visitor: {
      CallExpression(callPath) {
        try {
          const calleePath = callPath.get("callee");
          if (isLocalize(calleePath, localizeName)) {
            const [messageParts] = unwrapMessagePartsFromLocalizeCall(callPath, fs);
            const [expressions] = unwrapSubstitutionsFromLocalizeCall(callPath, fs);
            const translated = translate(diagnostics, translations, messageParts, expressions, missingTranslation);
            callPath.replaceWith(buildLocalizeReplacement(translated[0], translated[1]));
          }
        } catch (e) {
          if (isBabelParseError(e)) {
            diagnostics.error(buildCodeFrameError(fs, callPath, e));
          } else {
            throw e;
          }
        }
      }
    }
  };
}

// src/angular/packages/localize/tools/src/translate/source_files/locale_plugin.ts
import { types as t2 } from "@babel/core";
function makeLocalePlugin(locale, { localizeName = "$localize" } = {}) {
  return {
    visitor: {
      MemberExpression(expression) {
        const obj = expression.get("object");
        if (!isLocalize(obj, localizeName)) {
          return;
        }
        const property = expression.get("property");
        if (!property.isIdentifier({ name: "locale" })) {
          return;
        }
        if (expression.parentPath.isAssignmentExpression() && expression.parentPath.get("left") === expression) {
          return;
        }
        const parent = expression.parentPath;
        if (parent.isLogicalExpression({ operator: "&&" }) && parent.get("right") === expression) {
          const left = parent.get("left");
          if (isLocalizeGuard(left, localizeName)) {
            parent.replaceWith(expression);
          } else if (left.isLogicalExpression({ operator: "&&" }) && isLocalizeGuard(left.get("right"), localizeName)) {
            left.replaceWith(left.get("left"));
          }
        }
        expression.replaceWith(t2.stringLiteral(locale));
      }
    }
  };
}
function isLocalizeGuard(expression, localizeName) {
  if (!expression.isBinaryExpression() || !(expression.node.operator === "!==" || expression.node.operator === "!=")) {
    return false;
  }
  const left = expression.get("left");
  const right = expression.get("right");
  return left.isUnaryExpression({ operator: "typeof" }) && isLocalize(left.get("argument"), localizeName) && right.isStringLiteral({ value: "undefined" }) || right.isUnaryExpression({ operator: "typeof" }) && isLocalize(right.get("argument"), localizeName) && left.isStringLiteral({ value: "undefined" });
}

// src/angular/packages/localize/tools/src/translate/source_files/source_file_translation_handler.ts
var SourceFileTranslationHandler = class {
  constructor(fs, translationOptions = {}) {
    this.fs = fs;
    this.translationOptions = translationOptions;
    this.sourceLocaleOptions = __spreadProps(__spreadValues({}, this.translationOptions), { missingTranslation: "ignore" });
  }
  canTranslate(relativeFilePath, _contents) {
    return this.fs.extname(relativeFilePath) === ".js";
  }
  translate(diagnostics, sourceRoot, relativeFilePath, contents, outputPathFn, translations, sourceLocale) {
    const sourceCode = Buffer.from(contents).toString("utf8");
    if (!sourceCode.includes("$localize")) {
      for (const translation of translations) {
        this.writeSourceFile(
          diagnostics,
          outputPathFn,
          translation.locale,
          relativeFilePath,
          contents
        );
      }
      if (sourceLocale !== void 0) {
        this.writeSourceFile(diagnostics, outputPathFn, sourceLocale, relativeFilePath, contents);
      }
    } else {
      const ast = babel.parseSync(sourceCode, { sourceRoot, filename: relativeFilePath });
      if (!ast) {
        diagnostics.error(
          `Unable to parse source file: ${this.fs.join(sourceRoot, relativeFilePath)}`
        );
        return;
      }
      for (const translationBundle of translations) {
        this.translateFile(
          diagnostics,
          ast,
          translationBundle,
          sourceRoot,
          relativeFilePath,
          outputPathFn,
          this.translationOptions
        );
      }
      if (sourceLocale !== void 0) {
        this.translateFile(
          diagnostics,
          ast,
          { locale: sourceLocale, translations: {} },
          sourceRoot,
          relativeFilePath,
          outputPathFn,
          this.sourceLocaleOptions
        );
      }
    }
  }
  translateFile(diagnostics, ast, translationBundle, sourceRoot, filename, outputPathFn, options) {
    const translated = babel.transformFromAstSync(ast, void 0, {
      compact: true,
      generatorOpts: { minified: true },
      plugins: [
        makeLocalePlugin(translationBundle.locale),
        makeEs2015TranslatePlugin(diagnostics, translationBundle.translations, options, this.fs),
        makeEs5TranslatePlugin(diagnostics, translationBundle.translations, options, this.fs)
      ],
      cwd: sourceRoot,
      filename
    });
    if (translated && translated.code) {
      this.writeSourceFile(
        diagnostics,
        outputPathFn,
        translationBundle.locale,
        filename,
        translated.code
      );
      const outputPath = absoluteFrom2(outputPathFn(translationBundle.locale, filename));
      this.fs.ensureDir(this.fs.dirname(outputPath));
      this.fs.writeFile(outputPath, translated.code);
    } else {
      diagnostics.error(`Unable to translate source file: ${this.fs.join(sourceRoot, filename)}`);
      return;
    }
  }
  writeSourceFile(diagnostics, outputPathFn, locale, relativeFilePath, contents) {
    try {
      const outputPath = absoluteFrom2(outputPathFn(locale, relativeFilePath));
      this.fs.ensureDir(this.fs.dirname(outputPath));
      this.fs.writeFile(outputPath, contents);
    } catch (e) {
      diagnostics.error(e.message);
    }
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_loader.ts
var TranslationLoader = class {
  constructor(fs, translationParsers, duplicateTranslation, diagnostics) {
    this.fs = fs;
    this.translationParsers = translationParsers;
    this.duplicateTranslation = duplicateTranslation;
    this.diagnostics = diagnostics;
  }
  /**
   * Load and parse the translation files into a collection of `TranslationBundles`.
   *
   * @param translationFilePaths An array, per locale, of absolute paths to translation files.
   *
   * For each locale to be translated, there is an element in `translationFilePaths`. Each element
   * is an array of absolute paths to translation files for that locale.
   * If the array contains more than one translation file, then the translations are merged.
   * If allowed by the `duplicateTranslation` property, when more than one translation has the same
   * message id, the message from the earlier translation file in the array is used.
   * For example, if the files are `[app.xlf, lib-1.xlf, lib-2.xlif]` then a message that appears in
   * `app.xlf` will override the same message in `lib-1.xlf` or `lib-2.xlf`.
   *
   * @param translationFileLocales An array of locales for each of the translation files.
   *
   * If there is a locale provided in `translationFileLocales` then this is used rather than a
   * locale extracted from the file itself.
   * If there is neither a provided locale nor a locale parsed from the file, then an error is
   * thrown.
   * If there are both a provided locale and a locale parsed from the file, and they are not the
   * same, then a warning is reported.
   */
  loadBundles(translationFilePaths, translationFileLocales) {
    return translationFilePaths.map((filePaths, index) => {
      const providedLocale = translationFileLocales[index];
      return this.mergeBundles(filePaths, providedLocale);
    });
  }
  /**
   * Load all the translations from the file at the given `filePath`.
   */
  loadBundle(filePath, providedLocale) {
    const fileContents = this.fs.readFile(filePath);
    const unusedParsers = /* @__PURE__ */ new Map();
    for (const translationParser of this.translationParsers) {
      const result = translationParser.analyze(filePath, fileContents);
      if (!result.canParse) {
        unusedParsers.set(translationParser, result);
        continue;
      }
      const { locale: parsedLocale, translations, diagnostics } = translationParser.parse(filePath, fileContents, result.hint);
      if (diagnostics.hasErrors) {
        throw new Error(diagnostics.formatDiagnostics(
          `The translation file "${filePath}" could not be parsed.`
        ));
      }
      const locale = providedLocale || parsedLocale;
      if (locale === void 0) {
        throw new Error(`The translation file "${filePath}" does not contain a target locale and no explicit locale was provided for this file.`);
      }
      if (parsedLocale !== void 0 && providedLocale !== void 0 && parsedLocale !== providedLocale) {
        diagnostics.warn(
          `The provided locale "${providedLocale}" does not match the target locale "${parsedLocale}" found in the translation file "${filePath}".`
        );
      }
      if (this.diagnostics) {
        this.diagnostics.merge(diagnostics);
      }
      return { locale, translations, diagnostics };
    }
    const diagnosticsMessages = [];
    for (const [parser, result] of unusedParsers.entries()) {
      diagnosticsMessages.push(result.diagnostics.formatDiagnostics(
        `
${parser.constructor.name} cannot parse translation file.`
      ));
    }
    throw new Error(
      `There is no "TranslationParser" that can parse this translation file: ${filePath}.` + diagnosticsMessages.join("\n")
    );
  }
  /**
   * There is more than one `filePath` for this locale, so load each as a bundle and then merge
   * them all together.
   */
  mergeBundles(filePaths, providedLocale) {
    const bundles = filePaths.map((filePath) => this.loadBundle(filePath, providedLocale));
    const bundle = bundles[0];
    for (let i = 1; i < bundles.length; i++) {
      const nextBundle = bundles[i];
      if (nextBundle.locale !== bundle.locale) {
        if (this.diagnostics) {
          const previousFiles = filePaths.slice(0, i).map((f) => `"${f}"`).join(", ");
          this.diagnostics.warn(`When merging multiple translation files, the target locale "${nextBundle.locale}" found in "${filePaths[i]}" does not match the target locale "${bundle.locale}" found in earlier files [${previousFiles}].`);
        }
      }
      Object.keys(nextBundle.translations).forEach((messageId) => {
        var _a;
        if (bundle.translations[messageId] !== void 0) {
          (_a = this.diagnostics) == null ? void 0 : _a.add(
            this.duplicateTranslation,
            `Duplicate translations for message "${messageId}" when merging "${filePaths[i]}".`
          );
        } else {
          bundle.translations[messageId] = nextBundle.translations[messageId];
        }
      });
    }
    return bundle;
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/arb_translation_parser.ts
import { \u0275parseTranslation } from "@angular/localize";
var ArbTranslationParser = class {
  analyze(_filePath, contents) {
    const diagnostics = new Diagnostics();
    if (!contents.includes('"@@locale"')) {
      return { canParse: false, diagnostics };
    }
    try {
      return { canParse: true, diagnostics, hint: this.tryParseArbFormat(contents) };
    } catch (e) {
      diagnostics.warn("File is not valid JSON.");
      return { canParse: false, diagnostics };
    }
  }
  parse(_filePath, contents, arb = this.tryParseArbFormat(contents)) {
    const bundle = {
      locale: arb["@@locale"],
      translations: {},
      diagnostics: new Diagnostics()
    };
    for (const messageId of Object.keys(arb)) {
      if (messageId.startsWith("@")) {
        continue;
      }
      const targetMessage = arb[messageId];
      bundle.translations[messageId] = \u0275parseTranslation(targetMessage);
    }
    return bundle;
  }
  tryParseArbFormat(contents) {
    const json = JSON.parse(contents);
    if (typeof json["@@locale"] !== "string") {
      throw new Error("Missing @@locale property.");
    }
    return json;
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/simple_json_translation_parser.ts
import { \u0275parseTranslation as \u0275parseTranslation2 } from "@angular/localize";
import { extname } from "path";
var SimpleJsonTranslationParser = class {
  analyze(filePath, contents) {
    const diagnostics = new Diagnostics();
    if (extname(filePath) !== ".json" || !(contents.includes('"locale"') && contents.includes('"translations"'))) {
      diagnostics.warn("File does not have .json extension.");
      return { canParse: false, diagnostics };
    }
    try {
      const json = JSON.parse(contents);
      if (json.locale === void 0) {
        diagnostics.warn('Required "locale" property missing.');
        return { canParse: false, diagnostics };
      }
      if (typeof json.locale !== "string") {
        diagnostics.warn('The "locale" property is not a string.');
        return { canParse: false, diagnostics };
      }
      if (json.translations === void 0) {
        diagnostics.warn('Required "translations" property missing.');
        return { canParse: false, diagnostics };
      }
      if (typeof json.translations !== "object") {
        diagnostics.warn('The "translations" is not an object.');
        return { canParse: false, diagnostics };
      }
      return { canParse: true, diagnostics, hint: json };
    } catch (e) {
      diagnostics.warn("File is not valid JSON.");
      return { canParse: false, diagnostics };
    }
  }
  parse(_filePath, contents, json) {
    const { locale: parsedLocale, translations } = json || JSON.parse(contents);
    const parsedTranslations = {};
    for (const messageId in translations) {
      const targetMessage = translations[messageId];
      parsedTranslations[messageId] = \u0275parseTranslation2(targetMessage);
    }
    return { locale: parsedLocale, translations: parsedTranslations, diagnostics: new Diagnostics() };
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/xliff1_translation_parser.ts
import { ParseErrorLevel as ParseErrorLevel3, visitAll as visitAll2 } from "@angular/compiler";

// src/angular/packages/localize/tools/src/translate/translation_files/base_visitor.ts
var BaseVisitor = class {
  visitElement(_element, _context) {
  }
  visitAttribute(_attribute, _context) {
  }
  visitText(_text, _context) {
  }
  visitComment(_comment, _context) {
  }
  visitExpansion(_expansion, _context) {
  }
  visitExpansionCase(_expansionCase, _context) {
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/message_serialization/message_serializer.ts
import { Element as Element2, visitAll } from "@angular/compiler";

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/translation_parse_error.ts
import { ParseErrorLevel } from "@angular/compiler";
var TranslationParseError = class extends Error {
  constructor(span, msg, level = ParseErrorLevel.ERROR) {
    super(contextualMessage(span, msg, level));
    this.span = span;
    this.msg = msg;
    this.level = level;
  }
};
function contextualMessage(span, msg, level) {
  const ctx = span.start.getContext(100, 2);
  msg += `
At ${span.start}${span.details ? `, ${span.details}` : ""}:
`;
  if (ctx) {
    msg += `...${ctx.before}[${ParseErrorLevel[level]} ->]${ctx.after}...
`;
  }
  return msg;
}

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/translation_utils.ts
import { Element, ParseError, ParseErrorLevel as ParseErrorLevel2, XmlParser } from "@angular/compiler";
function getAttrOrThrow(element, attrName) {
  const attrValue = getAttribute(element, attrName);
  if (attrValue === void 0) {
    throw new TranslationParseError(
      element.sourceSpan,
      `Missing required "${attrName}" attribute:`
    );
  }
  return attrValue;
}
function getAttribute(element, attrName) {
  const attr = element.attrs.find((a) => a.name === attrName);
  return attr !== void 0 ? attr.value : void 0;
}
function parseInnerRange(element) {
  const xmlParser = new XmlParser();
  const xml = xmlParser.parse(
    element.sourceSpan.start.file.content,
    element.sourceSpan.start.file.url,
    { tokenizeExpansionForms: true, range: getInnerRange(element) }
  );
  return xml;
}
function getInnerRange(element) {
  const start = element.startSourceSpan.end;
  const end = element.endSourceSpan.start;
  return {
    startPos: start.offset,
    startLine: start.line,
    startCol: start.col,
    endPos: end.offset
  };
}
function canParseXml(filePath, contents, rootNodeName, attributes) {
  const diagnostics = new Diagnostics();
  const xmlParser = new XmlParser();
  const xml = xmlParser.parse(contents, filePath);
  if (xml.rootNodes.length === 0 || xml.errors.some((error) => error.level === ParseErrorLevel2.ERROR)) {
    xml.errors.forEach((e) => addParseError(diagnostics, e));
    return { canParse: false, diagnostics };
  }
  const rootElements = xml.rootNodes.filter(isNamedElement(rootNodeName));
  const rootElement = rootElements[0];
  if (rootElement === void 0) {
    diagnostics.warn(`The XML file does not contain a <${rootNodeName}> root node.`);
    return { canParse: false, diagnostics };
  }
  for (const attrKey of Object.keys(attributes)) {
    const attr = rootElement.attrs.find((attr2) => attr2.name === attrKey);
    if (attr === void 0 || attr.value !== attributes[attrKey]) {
      addParseDiagnostic(
        diagnostics,
        rootElement.sourceSpan,
        `The <${rootNodeName}> node does not have the required attribute: ${attrKey}="${attributes[attrKey]}".`,
        ParseErrorLevel2.WARNING
      );
      return { canParse: false, diagnostics };
    }
  }
  if (rootElements.length > 1) {
    xml.errors.push(new ParseError(
      xml.rootNodes[1].sourceSpan,
      "Unexpected root node. XLIFF 1.2 files should only have a single <xliff> root node.",
      ParseErrorLevel2.WARNING
    ));
  }
  return { canParse: true, diagnostics, hint: { element: rootElement, errors: xml.errors } };
}
function isNamedElement(name) {
  function predicate(node) {
    return node instanceof Element && node.name === name;
  }
  return predicate;
}
function addParseDiagnostic(diagnostics, sourceSpan, message, level) {
  addParseError(diagnostics, new ParseError(sourceSpan, message, level));
}
function addParseError(diagnostics, parseError) {
  if (parseError.level === ParseErrorLevel2.ERROR) {
    diagnostics.error(parseError.toString());
  } else {
    diagnostics.warn(parseError.toString());
  }
}
function addErrorsToBundle(bundle, errors) {
  for (const error of errors) {
    addParseError(bundle.diagnostics, error);
  }
}

// src/angular/packages/localize/tools/src/translate/translation_files/message_serialization/message_serializer.ts
var MessageSerializer = class extends BaseVisitor {
  constructor(renderer, config) {
    super();
    this.renderer = renderer;
    this.config = config;
  }
  serialize(nodes) {
    this.renderer.startRender();
    visitAll(this, nodes);
    this.renderer.endRender();
    return this.renderer.message;
  }
  visitElement(element) {
    if (this.config.placeholder && element.name === this.config.placeholder.elementName) {
      const name = getAttrOrThrow(element, this.config.placeholder.nameAttribute);
      const body = this.config.placeholder.bodyAttribute && getAttribute(element, this.config.placeholder.bodyAttribute);
      this.visitPlaceholder(name, body);
    } else if (this.config.placeholderContainer && element.name === this.config.placeholderContainer.elementName) {
      const start = getAttrOrThrow(element, this.config.placeholderContainer.startAttribute);
      const end = getAttrOrThrow(element, this.config.placeholderContainer.endAttribute);
      this.visitPlaceholderContainer(start, element.children, end);
    } else if (this.config.inlineElements.indexOf(element.name) !== -1) {
      visitAll(this, element.children);
    } else {
      throw new TranslationParseError(element.sourceSpan, `Invalid element found in message.`);
    }
  }
  visitText(text) {
    this.renderer.text(text.value);
  }
  visitExpansion(expansion) {
    this.renderer.startIcu();
    this.renderer.text(`${expansion.switchValue}, ${expansion.type},`);
    visitAll(this, expansion.cases);
    this.renderer.endIcu();
  }
  visitExpansionCase(expansionCase) {
    this.renderer.text(` ${expansionCase.value} {`);
    this.renderer.startContainer();
    visitAll(this, expansionCase.expression);
    this.renderer.closeContainer();
    this.renderer.text(`}`);
  }
  visitContainedNodes(nodes) {
    this.renderer.startContainer();
    visitAll(this, nodes);
    this.renderer.closeContainer();
  }
  visitPlaceholder(name, body) {
    this.renderer.placeholder(name, body);
  }
  visitPlaceholderContainer(startName, children, closeName) {
    this.renderer.startPlaceholder(startName);
    this.visitContainedNodes(children);
    this.renderer.closePlaceholder(closeName);
  }
  isPlaceholderContainer(node) {
    return node instanceof Element2 && node.name === this.config.placeholderContainer.elementName;
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/message_serialization/target_message_renderer.ts
import { \u0275makeParsedTranslation } from "@angular/localize";
var TargetMessageRenderer = class {
  constructor() {
    this.current = { messageParts: [], placeholderNames: [], text: "" };
    this.icuDepth = 0;
  }
  get message() {
    const { messageParts, placeholderNames } = this.current;
    return \u0275makeParsedTranslation(messageParts, placeholderNames);
  }
  startRender() {
  }
  endRender() {
    this.storeMessagePart();
  }
  text(text) {
    this.current.text += text;
  }
  placeholder(name, body) {
    this.renderPlaceholder(name);
  }
  startPlaceholder(name) {
    this.renderPlaceholder(name);
  }
  closePlaceholder(name) {
    this.renderPlaceholder(name);
  }
  startContainer() {
  }
  closeContainer() {
  }
  startIcu() {
    this.icuDepth++;
    this.text("{");
  }
  endIcu() {
    this.icuDepth--;
    this.text("}");
  }
  normalizePlaceholderName(name) {
    return name.replace(/-/g, "_");
  }
  renderPlaceholder(name) {
    name = this.normalizePlaceholderName(name);
    if (this.icuDepth > 0) {
      this.text(`{${name}}`);
    } else {
      this.storeMessagePart();
      this.current.placeholderNames.push(name);
    }
  }
  storeMessagePart() {
    this.current.messageParts.push(this.current.text);
    this.current.text = "";
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/serialize_translation_message.ts
function serializeTranslationMessage(element, config) {
  const { rootNodes, errors: parseErrors } = parseInnerRange(element);
  try {
    const serializer = new MessageSerializer(new TargetMessageRenderer(), config);
    const translation = serializer.serialize(rootNodes);
    return { translation, parseErrors, serializeErrors: [] };
  } catch (e) {
    return { translation: null, parseErrors, serializeErrors: [e] };
  }
}

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/xliff1_translation_parser.ts
var Xliff1TranslationParser = class {
  analyze(filePath, contents) {
    return canParseXml(filePath, contents, "xliff", { version: "1.2" });
  }
  parse(filePath, contents, hint) {
    return this.extractBundle(hint);
  }
  extractBundle({ element, errors }) {
    const diagnostics = new Diagnostics();
    errors.forEach((e) => addParseError(diagnostics, e));
    if (element.children.length === 0) {
      addParseDiagnostic(
        diagnostics,
        element.sourceSpan,
        "Missing expected <file> element",
        ParseErrorLevel3.WARNING
      );
      return { locale: void 0, translations: {}, diagnostics };
    }
    const files = element.children.filter(isNamedElement("file"));
    if (files.length === 0) {
      addParseDiagnostic(
        diagnostics,
        element.sourceSpan,
        "No <file> elements found in <xliff>",
        ParseErrorLevel3.WARNING
      );
    } else if (files.length > 1) {
      addParseDiagnostic(
        diagnostics,
        files[1].sourceSpan,
        "More than one <file> element found in <xliff>",
        ParseErrorLevel3.WARNING
      );
    }
    const bundle = { locale: void 0, translations: {}, diagnostics };
    const translationVisitor = new XliffTranslationVisitor();
    const localesFound = /* @__PURE__ */ new Set();
    for (const file of files) {
      const locale = getAttribute(file, "target-language");
      if (locale !== void 0) {
        localesFound.add(locale);
        bundle.locale = locale;
      }
      visitAll2(translationVisitor, file.children, bundle);
    }
    if (localesFound.size > 1) {
      addParseDiagnostic(
        diagnostics,
        element.sourceSpan,
        `More than one locale found in translation file: ${JSON.stringify(Array.from(localesFound))}. Using "${bundle.locale}"`,
        ParseErrorLevel3.WARNING
      );
    }
    return bundle;
  }
};
var XliffTranslationVisitor = class extends BaseVisitor {
  visitElement(element, bundle) {
    if (element.name === "trans-unit") {
      this.visitTransUnitElement(element, bundle);
    } else {
      visitAll2(this, element.children, bundle);
    }
  }
  visitTransUnitElement(element, bundle) {
    const id = getAttribute(element, "id");
    if (id === void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        `Missing required "id" attribute on <trans-unit> element.`,
        ParseErrorLevel3.ERROR
      );
      return;
    }
    if (bundle.translations[id] !== void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        `Duplicated translations for message "${id}"`,
        ParseErrorLevel3.ERROR
      );
      return;
    }
    let targetMessage = element.children.find(isNamedElement("target"));
    if (targetMessage === void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        "Missing <target> element",
        ParseErrorLevel3.WARNING
      );
      targetMessage = element.children.find(isNamedElement("source"));
      if (targetMessage === void 0) {
        addParseDiagnostic(
          bundle.diagnostics,
          element.sourceSpan,
          "Missing required element: one of <target> or <source> is required",
          ParseErrorLevel3.ERROR
        );
        return;
      }
    }
    const { translation, parseErrors, serializeErrors } = serializeTranslationMessage(targetMessage, {
      inlineElements: ["g", "bx", "ex", "bpt", "ept", "ph", "it", "mrk"],
      placeholder: { elementName: "x", nameAttribute: "id" }
    });
    if (translation !== null) {
      bundle.translations[id] = translation;
    }
    addErrorsToBundle(bundle, parseErrors);
    addErrorsToBundle(bundle, serializeErrors);
  }
};

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/xliff2_translation_parser.ts
import { Element as Element4, ParseErrorLevel as ParseErrorLevel4, visitAll as visitAll3 } from "@angular/compiler";
var Xliff2TranslationParser = class {
  analyze(filePath, contents) {
    return canParseXml(filePath, contents, "xliff", { version: "2.0" });
  }
  parse(filePath, contents, hint) {
    return this.extractBundle(hint);
  }
  extractBundle({ element, errors }) {
    const diagnostics = new Diagnostics();
    errors.forEach((e) => addParseError(diagnostics, e));
    const locale = getAttribute(element, "trgLang");
    const files = element.children.filter(isFileElement);
    if (files.length === 0) {
      addParseDiagnostic(
        diagnostics,
        element.sourceSpan,
        "No <file> elements found in <xliff>",
        ParseErrorLevel4.WARNING
      );
    } else if (files.length > 1) {
      addParseDiagnostic(
        diagnostics,
        files[1].sourceSpan,
        "More than one <file> element found in <xliff>",
        ParseErrorLevel4.WARNING
      );
    }
    const bundle = { locale, translations: {}, diagnostics };
    const translationVisitor = new Xliff2TranslationVisitor();
    for (const file of files) {
      visitAll3(translationVisitor, file.children, { bundle });
    }
    return bundle;
  }
};
var Xliff2TranslationVisitor = class extends BaseVisitor {
  visitElement(element, { bundle, unit }) {
    if (element.name === "unit") {
      this.visitUnitElement(element, bundle);
    } else if (element.name === "segment") {
      this.visitSegmentElement(element, bundle, unit);
    } else {
      visitAll3(this, element.children, { bundle, unit });
    }
  }
  visitUnitElement(element, bundle) {
    const externalId = getAttribute(element, "id");
    if (externalId === void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        `Missing required "id" attribute on <trans-unit> element.`,
        ParseErrorLevel4.ERROR
      );
      return;
    }
    if (bundle.translations[externalId] !== void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        `Duplicated translations for message "${externalId}"`,
        ParseErrorLevel4.ERROR
      );
      return;
    }
    visitAll3(this, element.children, { bundle, unit: externalId });
  }
  visitSegmentElement(element, bundle, unit) {
    if (unit === void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        "Invalid <segment> element: should be a child of a <unit> element.",
        ParseErrorLevel4.ERROR
      );
      return;
    }
    let targetMessage = element.children.find(isNamedElement("target"));
    if (targetMessage === void 0) {
      addParseDiagnostic(
        bundle.diagnostics,
        element.sourceSpan,
        "Missing <target> element",
        ParseErrorLevel4.WARNING
      );
      targetMessage = element.children.find(isNamedElement("source"));
      if (targetMessage === void 0) {
        addParseDiagnostic(
          bundle.diagnostics,
          element.sourceSpan,
          "Missing required element: one of <target> or <source> is required",
          ParseErrorLevel4.ERROR
        );
        return;
      }
    }
    const { translation, parseErrors, serializeErrors } = serializeTranslationMessage(targetMessage, {
      inlineElements: ["cp", "sc", "ec", "mrk", "sm", "em"],
      placeholder: { elementName: "ph", nameAttribute: "equiv", bodyAttribute: "disp" },
      placeholderContainer: { elementName: "pc", startAttribute: "equivStart", endAttribute: "equivEnd" }
    });
    if (translation !== null) {
      bundle.translations[unit] = translation;
    }
    addErrorsToBundle(bundle, parseErrors);
    addErrorsToBundle(bundle, serializeErrors);
  }
};
function isFileElement(node) {
  return node instanceof Element4 && node.name === "file";
}

// src/angular/packages/localize/tools/src/translate/translation_files/translation_parsers/xtb_translation_parser.ts
import { ParseErrorLevel as ParseErrorLevel5, visitAll as visitAll4 } from "@angular/compiler";
import { extname as extname2 } from "path";
var XtbTranslationParser = class {
  analyze(filePath, contents) {
    const extension = extname2(filePath);
    if (extension !== ".xtb" && extension !== ".xmb") {
      const diagnostics = new Diagnostics();
      diagnostics.warn("Must have xtb or xmb extension.");
      return { canParse: false, diagnostics };
    }
    return canParseXml(filePath, contents, "translationbundle", {});
  }
  parse(filePath, contents, hint) {
    return this.extractBundle(hint);
  }
  extractBundle({ element, errors }) {
    const langAttr = element.attrs.find((attr) => attr.name === "lang");
    const bundle = {
      locale: langAttr && langAttr.value,
      translations: {},
      diagnostics: new Diagnostics()
    };
    errors.forEach((e) => addParseError(bundle.diagnostics, e));
    const bundleVisitor = new XtbVisitor();
    visitAll4(bundleVisitor, element.children, bundle);
    return bundle;
  }
};
var XtbVisitor = class extends BaseVisitor {
  visitElement(element, bundle) {
    switch (element.name) {
      case "translation":
        const id = getAttribute(element, "id");
        if (id === void 0) {
          addParseDiagnostic(
            bundle.diagnostics,
            element.sourceSpan,
            `Missing required "id" attribute on <translation> element.`,
            ParseErrorLevel5.ERROR
          );
          return;
        }
        if (bundle.translations[id] !== void 0) {
          addParseDiagnostic(
            bundle.diagnostics,
            element.sourceSpan,
            `Duplicated translations for message "${id}"`,
            ParseErrorLevel5.ERROR
          );
          return;
        }
        const { translation, parseErrors, serializeErrors } = serializeTranslationMessage(
          element,
          { inlineElements: [], placeholder: { elementName: "ph", nameAttribute: "name" } }
        );
        if (parseErrors.length) {
          bundle.diagnostics.warn(computeParseWarning(id, parseErrors));
        } else if (translation !== null) {
          bundle.translations[id] = translation;
        }
        addErrorsToBundle(bundle, serializeErrors);
        break;
      default:
        addParseDiagnostic(
          bundle.diagnostics,
          element.sourceSpan,
          `Unexpected <${element.name}> tag.`,
          ParseErrorLevel5.ERROR
        );
    }
  }
};
function computeParseWarning(id, errors) {
  const msg = errors.map((e) => e.toString()).join("\n");
  return `Could not parse message with id "${id}" - perhaps it has an unrecognised ICU format?
` + msg;
}

// src/angular/packages/localize/tools/src/translate/translator.ts
var Translator = class {
  constructor(fs, resourceHandlers, diagnostics) {
    this.fs = fs;
    this.resourceHandlers = resourceHandlers;
    this.diagnostics = diagnostics;
  }
  translateFiles(inputPaths, rootPath, outputPathFn, translations, sourceLocale) {
    inputPaths.forEach((inputPath) => {
      const absInputPath = this.fs.resolve(rootPath, inputPath);
      const contents = this.fs.readFileBuffer(absInputPath);
      const relativePath = this.fs.relative(rootPath, absInputPath);
      for (const resourceHandler of this.resourceHandlers) {
        if (resourceHandler.canTranslate(relativePath, contents)) {
          return resourceHandler.translate(
            this.diagnostics,
            rootPath,
            relativePath,
            contents,
            outputPathFn,
            translations,
            sourceLocale
          );
        }
      }
      this.diagnostics.error(`Unable to handle resource file: ${inputPath}`);
    });
  }
};

// src/angular/packages/localize/tools/src/translate/index.ts
function translateFiles({
  sourceRootPath,
  sourceFilePaths,
  translationFilePaths,
  translationFileLocales,
  outputPathFn,
  diagnostics,
  missingTranslation,
  duplicateTranslation,
  sourceLocale
}) {
  const fs = getFileSystem7();
  const translationLoader = new TranslationLoader(
    fs,
    [
      new Xliff2TranslationParser(),
      new Xliff1TranslationParser(),
      new XtbTranslationParser(),
      new SimpleJsonTranslationParser(),
      new ArbTranslationParser()
    ],
    duplicateTranslation,
    diagnostics
  );
  const resourceProcessor = new Translator(
    fs,
    [
      new SourceFileTranslationHandler(fs, { missingTranslation }),
      new AssetTranslationHandler(fs)
    ],
    diagnostics
  );
  const translationFilePathsArrays = translationFilePaths.map(
    (filePaths) => Array.isArray(filePaths) ? filePaths.map((p) => fs.resolve(p)) : [fs.resolve(filePaths)]
  );
  const translations = translationLoader.loadBundles(translationFilePathsArrays, translationFileLocales);
  sourceRootPath = fs.resolve(sourceRootPath);
  resourceProcessor.translateFiles(
    sourceFilePaths.map(relativeFrom),
    fs.resolve(sourceRootPath),
    outputPathFn,
    translations,
    sourceLocale
  );
}

// src/angular/packages/localize/tools/src/translate/output_path.ts
function getOutputPathFn(fs, outputFolder) {
  const [pre, post] = outputFolder.split("{{LOCALE}}");
  return post === void 0 ? (_locale, relativePath) => fs.join(pre, relativePath) : (locale, relativePath) => fs.join(pre + locale + post, relativePath);
}

// src/index.ts
function ngi18n(options) {
  const { sourceLocale, extract, translate: translate2 } = Object.assign(
    {
      sourceLocale: "en"
    },
    options
  );
  return {
    name: "custom-plugin",
    writeBundle(outputOptions, bundle) {
      var _a;
      const rootPath = outputOptions.dir;
      const sourceFilePaths = glob.sync("**/*.js", { cwd: rootPath, nodir: true });
      const fileSystem = new NodeJSFileSystem();
      setFileSystem(fileSystem);
      if (extract) {
        extractTranslations({
          rootPath,
          sourceFilePaths,
          sourceLocale,
          format: extract.format,
          outputPath: (_a = extract.localeOutput) != null ? _a : "messages.json",
          logger: new ConsoleLogger(LogLevel.warn),
          useSourceMaps: !!outputOptions.sourcemap,
          useLegacyIds: extract.format === "legacy-migrate",
          duplicateMessageHandling: "warning",
          formatOptions: {},
          fileSystem
        });
        return;
      }
      if (translate2) {
        translateFiles({
          sourceRootPath: rootPath,
          sourceFilePaths,
          translationFilePaths: translate2.translationFilePaths,
          translationFileLocales: translate2.translationFileLocales,
          outputPathFn: getOutputPathFn(fileSystem, fileSystem.resolve(rootPath, "{{LOCALE}}")),
          diagnostics: new Diagnostics(),
          missingTranslation: "warning",
          duplicateTranslation: "warning",
          sourceLocale
        });
      }
    }
  };
}
export {
  ngi18n
};
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
