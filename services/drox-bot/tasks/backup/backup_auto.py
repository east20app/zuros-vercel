import asyncio
import disnake
from functions.database import database
from functions.emoji import emoji
from .zuros import Sincronizacao
from .backup import Backup
from .restore import Restore
import os


class BackupAutomatico:
    @staticmethod
    def _obter_config() -> dict:
        """Lê a configuração do backup automático.

        Prioriza o documento Mongo `backup_configs` (fonte espelhada para
        o painel da web) com fallback para o arquivo local legado.
        """
        try:
            mongo_config = database.get_document("backup_configs")
            if isinstance(mongo_config, dict) and mongo_config:
                return mongo_config
        except Exception as e:
            print(f"[AutoBackup] Erro ao ler configuração no Mongo: {e}")

        local = database.obter("database/backup_configs.json")
        if isinstance(local, dict) and local:
            return local
        return {"backup_auto_ativo": False, "backup_auto_minutos": 360, "backup_auto_exclude": []}

    @staticmethod
    def _salvar_config(definicoes: dict):
        """Grava a configuração do backup automático no Mongo e no arquivo local."""
        try:
            database.save_document("backup_configs", definicoes)
        except Exception as e:
            print(f"[AutoBackup] Erro ao gravar configuração no Mongo: {e}")
        database.salvar("database/backup_configs.json", definicoes)

    @staticmethod
    async def AutoBackupLoop(bot: disnake.Client):
        await bot.wait_until_ready()

        caminho_restore = "database/backup_configs.json"
        if not os.path.exists(caminho_restore):
            os.makedirs(os.path.dirname(caminho_restore), exist_ok=True)
            BackupAutomatico._salvar_config({"backup_auto_ativo": False, "backup_auto_minutos": 360, "backup_auto_exclude": []})

        while not bot.is_closed():
            try:
                definicoes = BackupAutomatico._obter_config()
                auto_ativo = definicoes.get("backup_auto_ativo", False)
                auto_minutos = definicoes.get("backup_auto_minutos", 0)

                if auto_ativo and auto_minutos > 0:
                    await asyncio.sleep(auto_minutos * 60)
                    config = database.obter("config.json")
                    server_id = int(config["bot"]["server"])
                    guild = bot.get_guild(server_id)

                    if guild:
                        try:
                            await Sincronizacao.BackupGuild(guild, bot, auto=True)
                        except Exception as e:
                            print(f"[AutoBackup] Erro ao executar backup automático: {e}")
                    else:
                        print("[AutoBackup] Servidor principal não encontrado para backup automático.")
                else:
                    await asyncio.sleep(60)

            except Exception as e:
                print(f"[AutoBackup] Erro no loop de backup automático: {e}")
                await asyncio.sleep(60)

    @staticmethod
    async def ProcessarFila(bot: disnake.Client):
        """Loop leve que processa a fila `backup_requests` gravada pelo painel da web.

        Ações suportadas no documento Mongo:
        - {"tipo": "create"}                          cria um backup do servidor principal
        - {"tipo": "delete", "arquivo": "..."}         apaga um backup local
        - {"tipo": "restore", "arquivo": "...", "tipos": "all", "guild_id": "..."}
                                                       restaura (e opcionalmente apaga antes)
        Cada request é marcado com status "done"/"erro" e mantemos os 30 mais recentes.
        """
        await bot.wait_until_ready()

        while not bot.is_closed():
            try:
                await BackupAutomatico.ExecutarFila(bot)
            except Exception as e:
                print(f"[AutoBackup] Erro ao processar fila de backups: {e}")
            await asyncio.sleep(10)

    @staticmethod
    async def ExecutarFila(bot: disnake.Client):
        database.clear_cache("backup_requests")
        requests = database.get_document("backup_requests")
        if not isinstance(requests, list) or not requests:
            return

        config = database.obter("config.json")
        server_id = int(config["bot"]["server"])
        guild_principal = bot.get_guild(server_id)
        if not guild_principal:
            return

        processou = False
        resultado = []
        for req in requests:
            if not isinstance(req, dict):
                continue
            status_atual = req.get("status")
            if status_atual in ("done", "erro"):
                resultado.append(req)
                continue
            processou = True
            try:
                tipo = req.get("tipo")
                if tipo == "create":
                    await Sincronizacao.BackupGuild(guild_principal, bot)
                    req["status"] = "done"
                    req["mensagem"] = "Backup criado com sucesso."
                    Backup.Espelhar()
                elif tipo == "delete":
                    arquivo = req.get("arquivo")
                    caminho = os.path.join("database", "backups", arquivo) if arquivo else None
                    if not arquivo or not caminho or not os.path.exists(caminho):
                        raise Exception("Backup não encontrado.")
                    os.remove(caminho)
                    req["status"] = "done"
                    req["mensagem"] = "Backup apagado com sucesso."
                    Backup.Espelhar()
                elif tipo == "restore":
                    arquivo = req.get("arquivo")
                    tipos = req.get("tipos") or "all"
                    guild_alvo = guild_principal
                    guild_id = req.get("guild_id")
                    if guild_id:
                        guild_alvo = bot.get_guild(int(guild_id)) or guild_principal
                    data = database.obter(os.path.join("database", "backups", arquivo)) if arquivo else {}
                    if not data:
                        raise Exception("Backup não encontrado.")
                    await Restore.RestoreGuildBackup(guild_alvo, data, tipos, inter=None)
                    req["status"] = "done"
                    req["mensagem"] = f"Backup restaurado (tipos: {tipos})."
                else:
                    raise Exception(f"Tipo de ação desconhecido: {tipo}")
            except Exception as e:
                req["status"] = "erro"
                req["mensagem"] = str(e)
            resultado.append(req)

        if not processou:
            return

        resultado = resultado[-30:]
        database.save_document("backup_requests", resultado)

    @staticmethod
    async def RealizarBackupInicial(bot: disnake.Client):
        await bot.wait_until_ready()
        try:
            config = database.obter("config.json")
            if not config.get("startOnBackup", False):
                return

            server_id = int(config["bot"]["server"])
            guild = bot.get_guild(server_id)

            if guild:
                try:
                    await Sincronizacao.BackupGuild(guild, bot, auto=True)
                except Exception as e:
                    print(f"[AutoBackup] Erro ao executar backup inicial: {e}")
            else:
                print("[AutoBackup] Servidor principal não encontrado para backup inicial.")
        except Exception as e:
            print(f"[AutoBackup] Erro no backup inicial: {e}")