/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MediaItem {
    id: string;
    preview: string;
    url: string;
    width: number;
    height: number;
    title?: string;
    source?: string;
    mature?: boolean;
}

export interface SearchResult {
    items: MediaItem[];
    cursor?: string | null;
    error?: string;
}

export const PROVIDER_IDS = [
    "gifs",
    "pinterest",
    "picsart",
    "picsartStickers",
    "openverse",
    "wikimedia",
    "giphy"
] as const;

export type ProviderId = typeof PROVIDER_IDS[number];

export interface ProviderMeta {
    id: ProviderId;
    label: string;
    browsable: boolean;
    needsGiphyKey?: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
    { id: "gifs", label: "GIFs", browsable: true },
    { id: "pinterest", label: "Pinterest", browsable: false },
    { id: "picsart", label: "PicsArt", browsable: true },
    { id: "picsartStickers", label: "PicsArt Stickers", browsable: true },
    { id: "openverse", label: "Openverse", browsable: false },
    { id: "wikimedia", label: "Wikimedia", browsable: false },
    { id: "giphy", label: "Giphy", browsable: true, needsGiphyKey: true }
];
