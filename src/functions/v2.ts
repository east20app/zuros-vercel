import { ContainerBuilder, FileBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder } from "discord.js";

export const V2_FLAGS = 1 << 15;

export function V2Container(content: string, actionRows: any[] = [], accentColor: number = 0x2b2d31): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(accentColor);

    if (content) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        );
    }

    for (const row of actionRows) {
        container.addActionRowComponents(row as any);
    }

    return container;
}

export function V2Reply(content: string, actionRows: any[] = [], options?: { files?: any[], accentColor?: number }) {
    const container = V2Container(content, actionRows, options?.accentColor);
    const files = options?.files?.filter(Boolean) || [];
    const uploadFiles: any[] = [];

    for (const file of files) {
        if (typeof file === "string" && /^https?:\/\//i.test(file)) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(file).setDescription("Imagem"),
                ),
            );
            continue;
        }

        const name = String(file?.name || file?.data?.name || "").trim();
        if (!name) continue;
        uploadFiles.push(file);

        const attachmentUrl = `attachment://${name}`;
        if (/\.(?:png|jpe?g|gif|webp)$/i.test(name)) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(attachmentUrl).setDescription(name),
                ),
            );
        } else {
            container.addFileComponents(new FileBuilder().setURL(attachmentUrl));
        }
    }

    const result: any = {
        components: [container],
        flags: V2_FLAGS,
    };

    if (uploadFiles.length) {
        result.files = uploadFiles;
    }

    return result;
}
