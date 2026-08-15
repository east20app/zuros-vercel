import { Client } from "fast-discord-js";

/** Singleton do Discord por isolate; no worker ele é a instância ativa do bot. */
const client = new Client({ autoImport: ["./src/commands", "./src/events"] });
export default client;
