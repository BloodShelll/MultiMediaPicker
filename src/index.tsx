/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { FluxDispatcher, showToast, Toasts } from "@webpack/common";

import { GifPicker, ProviderSelect } from "./ProviderSelect";
import { searchProvider } from "./search";
import { settings } from "./settings";
import { getProvider, setProvider } from "./state";
import managedStyle from "./styles.css?managed";
import { MediaItem, ProviderId,PROVIDERS } from "./types";

interface DiscordGif {
    id: string;
    title: string;
    url: string;
    src: string;
    gif_src: string;
    width: number;
    height: number;
    preview: string;
}

function toDiscordGifs(items: MediaItem[]): DiscordGif[] {
    const hideMature = settings.store.matureContent === "hide";

    return items
        .filter(item => !hideMature || !item.mature)
        .map(item => ({
            id: item.id,
            title: item.title ?? "",
            url: item.url,
            src: item.preview,
            gif_src: item.url,
            width: item.width || 200,
            height: item.height || 200,
            preview: item.preview
        }));
}

function dispatchResults(query: string, items: MediaItem[], error?: string) {
    const gifs = toDiscordGifs(items);

    if (gifs.length === 0) {
        if (error) showToast(`Media picker: ${error}`, Toasts.Type.FAILURE);
        FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY_FAILURE", query });
        return;
    }

    FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY_SUCCESS", items: gifs });
}

function fetchInto(query: string) {
    searchProvider(getProvider(), query)
        .then(res => dispatchResults(query, res.items, res.error))
        .catch(err => dispatchResults(query, [], err instanceof Error ? err.message : String(err)));
}

export default definePlugin({
    name: "MultiMediaPicker",
    description: "Adds a provider dropdown to Discord's GIF picker so the same grid can browse Pinterest, PicsArt, Openverse and Wikimedia Commons.",
    authors: [{ name: "Suyile", id: 0n }],
    tags: ["Chat", "Utility"],
    settings,
    managedStyle,

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /children:\[(\i),this\.renderHeaderContent\(\)\]/,
                replace: "children:[$1,this.renderHeaderContent(),$self.renderProviderSelect(this)]"
            }
        },
        {
            find: '"GIFPickerViewStore"',
            replacement: {
                match: /(gifSrc:\i\(\i\),url:\i,id:\i,format:)(\i)/,
                replace: "$1$self.isCustomProvider()?1:$2"
            }
        },
        {
            find: '"GIF_PICKER_TRENDING_FETCH_SUCCESS",trendingCategories:',
            replacement: [
                {
                    match: /(let \i=Date\.now\(\);)(\i\([^)]+\)),(\i\.\i\.get\(\{url:\i\.\i\.GIFS_SEARCH,query:\{q:(\i),)/,
                    replace: "$1$2;if($self.isCustomProvider())return $self.handleSearch($4);$3"
                },
                {
                    match: /(let \i=Date\.now\(\);)(\i\([^)]+\)),(\i\.\i\.get\(\{url:\i\.\i\.GIFS_TRENDING_GIFS,)/,
                    replace: "$1$2;if($self.isCustomProvider())return $self.handleTrending();$3"
                }
            ]
        }
    ],

    start() {
        setProvider(settings.store.defaultProvider as ProviderId);
    },

    isCustomProvider() {
        return getProvider() !== "gifs";
    },

    handleSearch(query: string) {
        fetchInto(query);
    },

    handleTrending() {
        fetchInto("");
    },

    rerun(picker: GifPicker) {
        const query = picker.props.query ?? "";

        if (getProvider() === "gifs") {
            picker.handleChangeQuery(query);
            return;
        }

        const meta = PROVIDERS.find(item => item.id === getProvider());

        if (!query.trim() && !meta?.browsable) return;

        FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query });
        fetchInto(query);
    },

    renderProviderSelect(picker: GifPicker) {
        return <ProviderSelect key="vc-mmp-provider" picker={picker} onChanged={this.rerun} />;
    }
});
