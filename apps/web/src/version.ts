/**
 * The version this application reports and stamps on the files it writes.
 *
 * There is one source for it — the `version` field of the repository's
 * `package.json` — injected at build time by Vite and by the test runner. A
 * constant retyped in the code would be a second source, and the day the two
 * disagreed, a project file would carry a version that never existed.
 */
declare const __APPLICATION_VERSION__: string;

export const APPLICATION_VERSION: string = __APPLICATION_VERSION__;
