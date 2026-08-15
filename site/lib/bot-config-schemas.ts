import { z } from "zod";
import { BOT_CONFIG_MODULES, type BotConfigModule } from "./bot-config-modules.ts";

// The DROX source is deployed separately. Validate the confirmed boundary (one
// JSON object per whitelisted document) without deleting fields from newer bots.
const documentSchema = z.record(z.unknown());
export const botConfigSchemas = Object.fromEntries(Object.entries(BOT_CONFIG_MODULES).map(([module, aliases]) => [module, z.object(Object.fromEntries(Object.keys(aliases).map((alias) => [alias, documentSchema]))).strict()])) as unknown as Record<BotConfigModule, z.ZodType<Record<string, Record<string, unknown>>>>;
