/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { PROVIDERS } from "./types";

export const settings = definePluginSettings({
    defaultProvider: {
        type: OptionType.SELECT,
        description: "Which provider the GIF picker starts on.",
        options: PROVIDERS.map(provider => ({
            label: provider.label,
            value: provider.id,
            default: provider.id === "gifs"
        }))
    },
    matureContent: {
        type: OptionType.SELECT,
        description: "How to treat results PicsArt flagged as adult. No other provider reports this.",
        options: [
            { label: "Hide them", value: "hide", default: true },
            { label: "Show them", value: "show" }
        ]
    },
    giphyApiKey: {
        type: OptionType.STRING,
        description: "Giphy API key. Giphy stays out of the dropdown while this is empty.",
        default: "",
        placeholder: "Leave empty to hide Giphy"
    }
});
