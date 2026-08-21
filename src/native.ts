/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IpcMainInvokeEvent } from "electron";

import type { MediaItem, ProviderId, SearchResult } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TIMEOUT_MS = 20_000;
const PICSART_PAGE = 50;
const OPENVERSE_PAGE = 40;
const WIKI_PAGE = 40;
const GIPHY_PAGE = 50;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": UA,
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "en-US,en;q=0.9",
                ...headers
            }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        return await res.json() as T;
    } finally {
        clearTimeout(timer);
    }
}

interface PinterestImage {
    url: string;
    width?: number;
    height?: number;
}

interface PinterestPin {
    id: string | number;
    images?: Record<string, PinterestImage>;
    grid_title?: string;
    auto_alt_text?: string;
    description?: string;
}

interface PinterestResponse {
    resource_response?: {
        bookmark?: string;
        data?: { results?: PinterestPin[]; };
    };
}

async function pinterest(query: string, cursor?: string): Promise<SearchResult> {
    const options = {
        article: null,
        appliedProductFilters: "---",
        price_max: null,
        price_min: null,
        query,
        scope: "pins",
        auto_correction_disabled: false,
        top_pin_id: null,
        filters: null,
        journey_depth: null,
        redux_normalize_feed: true,
        rs: "typed",
        bookmarks: cursor ? [cursor] : []
    };

    const sourceUrl = `/search/pins/?q=${encodeURIComponent(query)}`;
    const url = "https://www.pinterest.com/resource/BaseSearchResource/get/"
        + `?source_url=${encodeURIComponent(sourceUrl)}`
        + `&data=${encodeURIComponent(JSON.stringify({ options, context: {} }))}`;

    const json = await getJson<PinterestResponse>(url, {
        "x-requested-with": "XMLHttpRequest",
        "x-pinterest-appstate": "active",
        "x-pinterest-source-url": sourceUrl,
        "x-pinterest-pws-handler": "www/search/[scope].js",
        Referer: `https://www.pinterest.com${sourceUrl}`
    });

    const items: MediaItem[] = [];

    for (const pin of json.resource_response?.data?.results ?? []) {
        const { images } = pin;
        if (!images) continue;

        const full = images.orig ?? images["736x"] ?? images["474x"] ?? images["236x"];
        if (!full) continue;

        const thumb = images["236x"] ?? images["170x"] ?? full;

        items.push({
            id: String(pin.id),
            preview: thumb.url,
            url: full.url,
            width: full.width ?? 0,
            height: full.height ?? 0,
            title: pin.grid_title || pin.auto_alt_text || pin.description,
            source: `https://www.pinterest.com/pin/${pin.id}/`
        });
    }

    const bookmark = json.resource_response?.bookmark;

    return { items, cursor: !bookmark || bookmark === "-end-" ? null : bookmark };
}

interface PicsartItem {
    id: string | number;
    url: string;
    width?: number;
    height?: number;
    title?: string;
    mature?: boolean;
}

async function picsart(kind: "photos" | "stickers", query: string, cursor?: string): Promise<SearchResult> {
    const offset = Number(cursor) || 0;
    const term = query.trim() || "trending";
    const url = `https://api.picsart.com/${kind}/search.json`
        + `?q=${encodeURIComponent(term)}&limit=${PICSART_PAGE}&offset=${offset}`;

    const json = await getJson<{ response?: PicsartItem[]; }>(url);
    const results = json.response ?? [];

    const items: MediaItem[] = results
        .filter(item => item.url)
        .map(item => ({
            id: String(item.id),
            preview: `${item.url}?type=webp&to=min&r=240`,
            url: item.url,
            width: item.width ?? 0,
            height: item.height ?? 0,
            title: item.title?.split("\n")[0].slice(0, 120),
            source: `https://picsart.com/i/${item.id}`,
            mature: item.mature === true
        }));

    return {
        items,
        cursor: results.length < PICSART_PAGE ? null : String(offset + results.length)
    };
}

interface OpenverseItem {
    id: string;
    url: string;
    thumbnail?: string;
    title?: string;
    width?: number;
    height?: number;
    foreign_landing_url?: string;
}

async function openverse(query: string, cursor?: string): Promise<SearchResult> {
    const page = Number(cursor) || 1;
    const url = "https://api.openverse.org/v1/images/"
        + `?q=${encodeURIComponent(query)}&page_size=${OPENVERSE_PAGE}&page=${page}`;

    const json = await getJson<{ results?: OpenverseItem[]; page_count?: number; }>(url);
    const results = json.results ?? [];

    const items: MediaItem[] = results
        .filter(item => item.url)
        .map(item => ({
            id: item.id,
            preview: item.thumbnail || item.url,
            url: item.url,
            width: item.width ?? 0,
            height: item.height ?? 0,
            title: item.title,
            source: item.foreign_landing_url
        }));

    return { items, cursor: page >= (json.page_count ?? 0) ? null : String(page + 1) };
}

interface WikiImageInfo {
    url: string;
    thumburl?: string;
    width?: number;
    height?: number;
    mime?: string;
}

interface WikiPage {
    pageid: number;
    title?: string;
    imageinfo?: WikiImageInfo[];
}

async function wikimedia(query: string, cursor?: string): Promise<SearchResult> {
    const offset = Number(cursor) || 0;
    const url = "https://commons.wikimedia.org/w/api.php"
        + "?action=query&format=json&generator=search"
        + `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6`
        + `&gsrlimit=${WIKI_PAGE}&gsroffset=${offset}`
        + "&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=320";

    const json = await getJson<{
        query?: { pages?: Record<string, WikiPage>; };
        continue?: { gsroffset?: number; };
    }>(url, { "User-Agent": "MultiMediaPicker (Equicord userplugin)" });

    const items: MediaItem[] = [];

    for (const page of Object.values(json.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        if (info.mime && !info.mime.startsWith("image/")) continue;

        items.push({
            id: String(page.pageid),
            preview: info.thumburl || info.url,
            url: info.url,
            width: info.width ?? 0,
            height: info.height ?? 0,
            title: page.title?.replace(/^File:/, ""),
            source: `https://commons.wikimedia.org/?curid=${page.pageid}`
        });
    }

    const next = json.continue?.gsroffset;

    return { items, cursor: next === undefined ? null : String(next) };
}

interface GiphyImage {
    url: string;
    width?: string;
    height?: string;
}

interface GiphyItem {
    id: string;
    url?: string;
    title?: string;
    images: {
        original: GiphyImage;
        fixed_width?: GiphyImage;
        fixed_width_small?: GiphyImage;
    };
}

async function giphy(query: string, cursor: string | undefined, apiKey: string): Promise<SearchResult> {
    const offset = Number(cursor) || 0;
    const term = query.trim();
    const base = term
        ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(term)}&`
        : "https://api.giphy.com/v1/gifs/trending?";
    const url = `${base}api_key=${encodeURIComponent(apiKey)}&limit=${GIPHY_PAGE}&offset=${offset}&rating=pg-13`;

    const json = await getJson<{
        data?: GiphyItem[];
        pagination?: { total_count?: number; };
    }>(url);

    const results = json.data ?? [];

    const items: MediaItem[] = results
        .filter(gif => gif.images?.original?.url)
        .map(gif => ({
            id: gif.id,
            preview: gif.images.fixed_width_small?.url || gif.images.fixed_width?.url || gif.images.original.url,
            url: gif.images.original.url,
            width: Number(gif.images.original.width) || 0,
            height: Number(gif.images.original.height) || 0,
            title: gif.title,
            source: gif.url
        }));

    const seen = offset + results.length;
    const total = json.pagination?.total_count ?? 0;

    return { items, cursor: results.length === 0 || seen >= total ? null : String(seen) };
}

export async function search(
    _: IpcMainInvokeEvent,
    provider: ProviderId,
    query: string,
    cursor?: string,
    giphyApiKey?: string
): Promise<SearchResult> {
    try {
        switch (provider) {
            case "pinterest": return await pinterest(query, cursor);
            case "picsart": return await picsart("photos", query, cursor);
            case "picsartStickers": return await picsart("stickers", query, cursor);
            case "openverse": return await openverse(query, cursor);
            case "wikimedia": return await wikimedia(query, cursor);
            case "giphy":
                if (!giphyApiKey) return { items: [], cursor: null, error: "Add a Giphy API key in the plugin settings first." };
                return await giphy(query, cursor, giphyApiKey);
            default:
                return { items: [], cursor: null, error: `Unknown provider ${provider}.` };
        }
    } catch (err) {
        return { items: [], cursor: null, error: err instanceof Error ? err.message : String(err) };
    }
}
