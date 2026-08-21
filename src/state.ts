/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProviderId } from "./types";

let active: ProviderId = "gifs";

const listeners = new Set<() => void>();

export function getProvider(): ProviderId {
    return active;
}

export function setProvider(provider: ProviderId) {
    active = provider;
    for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
