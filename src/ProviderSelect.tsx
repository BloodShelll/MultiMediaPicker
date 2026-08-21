/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Select, useEffect, useState } from "@webpack/common";

import { settings } from "./settings";
import { getProvider, setProvider, subscribe } from "./state";
import { ProviderId,PROVIDERS } from "./types";

export const cl = classNameFactory("vc-mmp-");

export interface GifPicker {
    props: { query?: string; };
    handleChangeQuery(query: string): void;
}

export function ProviderSelect({ picker, onChanged }: { picker: GifPicker; onChanged(picker: GifPicker): void; }) {
    const [provider, setLocal] = useState<ProviderId>(getProvider);
    const { giphyApiKey } = settings.use(["giphyApiKey"]);

    useEffect(() => subscribe(() => setLocal(getProvider())), []);

    const options = PROVIDERS.filter(item => !item.needsGiphyKey || giphyApiKey.trim());

    return (
        <div className={cl("select")}>
            <Select
                options={options.map(item => ({ label: item.label, value: item.id }))}
                isSelected={value => value === provider}
                select={(value: ProviderId) => {
                    setProvider(value);
                    onChanged(picker);
                }}
                serialize={value => String(value)}
                closeOnSelect
            />
        </div>
    );
}
