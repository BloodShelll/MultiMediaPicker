/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginNative } from "@utils/types";
import { RestAPI } from "@webpack/common";

import { settings } from "./settings";
import type { MediaItem, ProviderId, SearchResult } from "./types";

const Native = VencordNative.pluginHelpers.MultiMediaPicker as PluginNative<typeof import("./native")>;

const GIF_LIMIT = 50;

interface DiscordGif {
    id?: string;
    url?: string;
    src?: string;
    gif_src?: string;
    title?: string;
    width?: number;
    height?: number;
}

async function discordGifs(query: string): Promise<SearchResult> {
    const term = query.trim();

    const res = await RestAPI.get({
        url: term ? "/gifs/search" : "/gifs/trending-gifs",
        query: {
            ...(term ? { q: term } : {}),
            media_format: "gif",
            limit: GIF_LIMIT,
            locale: "en-US"
        }
    });

    const body = res.body as DiscordGif[];
    const items: MediaItem[] = [];

    for (const gif of body) {
        const preview = gif.src || gif.gif_src || gif.url;
        const url = gif.url || gif.gif_src || gif.src;
        if (!preview || !url) continue;

        items.push({
            id: String(gif.id ?? url),
            preview,
            url,
            width: gif.width ?? 0,
            height: gif.height ?? 0,
            title: gif.title,
            source: gif.url
        });
    }

    return { items, cursor: null };
}

export async function searchProvider(provider: ProviderId, query: string, cursor?: string): Promise<SearchResult> {
    try {
        if (provider === "gifs") return await discordGifs(query);

        return await Native.search(provider, query, cursor, settings.store.giphyApiKey);
    } catch (err) {
        return { items: [], cursor: null, error: err instanceof Error ? err.message : String(err) };
    }
}
