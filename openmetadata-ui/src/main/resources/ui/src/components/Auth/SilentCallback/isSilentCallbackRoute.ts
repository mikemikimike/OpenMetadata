/*
 *  Copyright 2026 Collate.
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

import { APP_ROUTER_ROUTES } from '../../../constants/router.constants';
import { getBasePath } from '../../../utils/HistoryUtils';

/**
 * Synchronous check the entry chunk uses to route the silent-refresh iframe
 * to a minimal render path. Returns true when the current document's
 * pathname is the silent-callback route (with or without a deploy-time
 * base-path prefix). Kept in its own module so `src/index.tsx` can dispatch
 * against it before any AppRoot dependency loads.
 */
export const isSilentCallbackRoute = (): boolean => {
  const path = globalThis.location.pathname;
  const basePath = getBasePath();
  const fullPath = basePath
    ? `${basePath}${APP_ROUTER_ROUTES.SILENT_CALLBACK}`
    : APP_ROUTER_ROUTES.SILENT_CALLBACK;

  return path === fullPath || path === APP_ROUTER_ROUTES.SILENT_CALLBACK;
};
