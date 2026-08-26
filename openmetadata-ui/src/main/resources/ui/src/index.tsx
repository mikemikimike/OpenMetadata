/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import SilentCallback from './components/Auth/SilentCallback';
import { APP_ROUTER_ROUTES } from './constants/router.constants';
import { getBasePath } from './utils/HistoryUtils';
import { isSsoTestLoginPopup } from './utils/SsoTestLoginPopup';

const recordPlaywrightAppBoot = () => {
  if (!import.meta.env.PW_E2E_BUILD) {
    return;
  }

  const scenarioKey = 'playwright-ui-scenario';
  const isNewScenario = !sessionStorage.getItem(scenarioKey);
  if (isNewScenario) {
    sessionStorage.setItem(scenarioKey, '1');
  }

  const basePath = getBasePath();
  const diagnostics = new URLSearchParams({ 'playwright-app-boot': '1' });
  if (isNewScenario) {
    diagnostics.set('playwright-ui-scenario', '1');
  }
  void fetch(`${basePath}/favicon.ico?${diagnostics}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {
    if (isNewScenario) {
      sessionStorage.removeItem(scenarioKey);
    }
  });
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

// Silent-renew iframe path: when the current document is the hidden iframe
// oidc-client uses to refresh tokens, render ONLY the tiny <SilentCallback />
// component — never mount `<AppRoot />`, and never enter the AuthProvider /
// AppRouter tree. Doing so previously caused every silent refresh to load
// the full app inside the iframe just to postMessage a token back to the
// parent tab. Scenario 7 of SsoScenarios.spec asserts no >500 KB JS chunk
// loads on this route, so AppRoot and its transitive deps (initCoreI18n,
// app styles) are dynamically imported below and never pulled into the
// entry chunk. `startsWith` covers the case where the deploy-time base
// path is prepended to the pathname.
const isSilentCallbackRoute = (() => {
  const path = globalThis.location.pathname;
  const basePath = getBasePath();
  const fullPath = basePath
    ? `${basePath}${APP_ROUTER_ROUTES.SILENT_CALLBACK}`
    : APP_ROUTER_ROUTES.SILENT_CALLBACK;

  return path === fullPath || path === APP_ROUTER_ROUTES.SILENT_CALLBACK;
})();

// The SSO "Test Login" popup returns to the configured callback URL. When this
// document is that isolated popup, handle the OIDC handshake separately and
// NEVER mount the app, so the test can't touch the admin's real session. A real
// login on the same callback URL is not diverted (see isSsoTestLoginPopup).
if (isSilentCallbackRoute) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <SilentCallback />
    </React.StrictMode>
  );
} else if (isSsoTestLoginPopup()) {
  import('./components/SettingsSso/SsoTestLogin/ssoTestCallbackBootstrap')
    .then((module) => module.runSsoTestCallback())
    // If the chunk fails to load, close the popup so the opener doesn't hang.
    .catch(() => globalThis.close());
} else {
  recordPlaywrightAppBoot();

  // Full-app path — every heavy dependency is imported dynamically so the
  // silent-callback branch above never pulls them into the entry chunk.
  // `initCoreI18n` is kept out of LocalUtil so the core-components package
  // doesn't leak into files that Playwright's `--list` walks.
  void (async () => {
    const [
      { initCoreI18n },
      { default: i18next },
      { default: AppRoot },
    ] = await Promise.all([
      import('@openmetadata/ui-core-components'),
      import('./utils/i18next/LocalUtil'),
      import('./AppRoot'),
      import('./styles/index'),
    ]);

    // Register the library's `core` i18next namespace. `addResourceBundle` is
    // safe to call before `i18next.init` resolves — the bundles queue and
    // become live once init completes.
    initCoreI18n(i18next);

    const root = createRoot(container);

    root.render(
      <React.StrictMode>
        <AppRoot />
      </React.StrictMode>
    );
  })();
}

// In dev (Vite) the asset-caching service worker only serves stale chunks and
// fights HMR, so skip registration and proactively unregister any SW left over
// from a previous production session. Skip SW work entirely on the
// silent-callback path — the iframe has no need for it and unregistering here
// would tear down the parent tab's cached assets.
if (!isSilentCallbackRoute) {
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          registrations.forEach((registration) => registration.unregister())
        );
    }
  } else if ('serviceWorker' in navigator && 'indexedDB' in globalThis) {
    window.addEventListener('load', () => {
      const basePath = getBasePath();
      const serviceWorkerPath = basePath
        ? `${basePath}/app-worker.js`
        : '/app-worker.js';
      navigator.serviceWorker.register(serviceWorkerPath);
    });
  }
}
