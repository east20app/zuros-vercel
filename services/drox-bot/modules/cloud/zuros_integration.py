import asyncio
import logging
import disnake
from disnake.ext import commands, tasks
from functions.database import database as db
from .verification_view import VerificationView
from .zuros_client import ZurosError
from . import zuros_cloud

LOGGER=logging.getLogger(__name__)

class ZurosIntegration(commands.Cog):
    def __init__(self,bot):
        self.bot=bot
        self._services_started=False

    @property
    def client(self):
        return zuros_cloud.get_zuros_cloud()

    @commands.Cog.listener()
    async def on_ready(self):
        if self._services_started:
            return
        self.bot.add_view(VerificationView())
        if not self.sync_roles.is_running():
            self.sync_roles.start()
        self._services_started=True
        LOGGER.info('Integração Zuros Auth inicializada.')

    def cog_unload(self):
        if self.sync_roles.is_running():
            self.sync_roles.cancel()
        if zuros_cloud._client is not None:
            try:
                asyncio.get_running_loop().create_task(zuros_cloud._client.close())
            except RuntimeError:
                pass

    async def _reply(self,inter,text):
        if inter.response.is_done(): await inter.edit_original_response(content=text)
        else: await inter.response.send_message(text,ephemeral=True)

    async def _log(self,guild,text):
        channel_id=(db.get_document("cloud_data") or {}).get("log_channel_id")
        channel=guild.get_channel(int(channel_id)) if channel_id else None
        if isinstance(channel,disnake.TextChannel):
            try: await channel.send(text)
            except disnake.HTTPException: pass

    @commands.Cog.listener()
    async def on_member_join(self,member):
        if not zuros_cloud.is_zuros_configured(): return
        try: await self.client.rejoin(member.id,member.guild.id)
        except ZurosError as error: LOGGER.warning("Zuros rejoin falhou: %s",error)

    @commands.slash_command(name="zuros",description="Administra a integração Zuros Auth")
    @commands.default_member_permissions(manage_guild=True)
    async def zuros(self,inter): pass

    @zuros.sub_command(name="status",description="Testa a conexão com a Zuros Auth")
    async def zuros_status(self,inter):
        await inter.response.defer(ephemeral=True)
        try:
            data=await self.client.status()
            await self._reply(inter,f"Zuros Auth conectada. Estado: {data}")
        except ZurosError as error: await self._reply(inter,f"Falha: {error}")

    @zuros.sub_command(name="publicar",description="Publica a mensagem configurada pela Zuros Auth")
    async def zuros_publicar(self,inter,canal:disnake.TextChannel):
        await inter.response.defer(ephemeral=True)
        try:
            data=await self.client.get_verification_message()
            content=data.get("content") or data.get("description") or "Clique abaixo para verificar."
            embed_data=data.get("embed")
            kwargs={"content":content if not embed_data else None,"view":VerificationView()}
            if isinstance(embed_data,dict): kwargs["embed"]=disnake.Embed.from_dict(embed_data)
            await canal.send(**kwargs)
            await self._reply(inter,f"Mensagem publicada em {canal.mention}.")
        except (ZurosError,disnake.HTTPException,TypeError) as error:
            await self._reply(inter,f"Falha ao publicar: {error}")

    @zuros.sub_command(name="revogar",description="Revoga a verificação de um membro")
    async def zuros_revogar(self,inter,membro:disnake.Member,motivo:str="manual"):
        await inter.response.defer(ephemeral=True)
        try:
            await self.client.revoke(membro.id,motivo)
            await self._reply(inter,f"Verificação de {membro.mention} revogada.")
        except ZurosError as error: await self._reply(inter,f"Falha: {error}")

    @zuros.sub_command(name="ressincronizar",description="Solicita ressincronização do membro")
    async def zuros_ressincronizar(self,inter,membro:disnake.Member):
        await inter.response.defer(ephemeral=True)
        try:
            await self.client.rejoin(membro.id,inter.guild.id)
            await self._reply(inter,f"Ressincronização solicitada para {membro.mention}.")
        except ZurosError as error: await self._reply(inter,f"Falha: {error}")

    @tasks.loop(seconds=15)
    async def sync_roles(self):
        if not zuros_cloud.is_zuros_configured(): return
        try: items=await self.client.pending_role_sync()
        except ZurosError as error:
            LOGGER.warning("Consulta role-sync falhou: %s",error); return
        for item in items:
            success=False; guild=None; detail=None
            try:
                guild=self.bot.get_guild(item.guild_id)
                if guild is None or guild.me is None: raise RuntimeError("servidor não encontrado")
                if not guild.me.guild_permissions.manage_roles: raise RuntimeError("permissão Gerenciar Cargos ausente")
                member=guild.get_member(item.discord_user_id) or await guild.fetch_member(item.discord_user_id)
                role=guild.get_role(item.verified_role_id)
                if role is None: raise RuntimeError("cargo verificado não encontrado")
                if role >= guild.me.top_role: raise RuntimeError("cargo do bot abaixo do cargo verificado")
                if item.action=="add_verified_role":
                    if role not in member.roles: await member.add_roles(role,reason="Zuros Auth")
                elif item.action=="remove_verified_role":
                    if role in member.roles: await member.remove_roles(role,reason="Zuros Auth revoke")
                else: raise RuntimeError(f"ação desconhecida: {item.action}")
                success=True
                await self._log(guild,f"Zuros Auth: {item.action} aplicado para {member.mention}.")
            except (disnake.HTTPException,RuntimeError,ValueError) as error:
                detail=str(error)
            finally:
                try: await self.client.ack_role_sync(item.id,success)
                except ZurosError: pass
                if not success and guild and detail:
                    await self._log(guild,f"Zuros Auth: falha na sincronização: {detail}.")

    @sync_roles.before_loop
    async def before_sync_roles(self): await self.bot.wait_until_ready()
