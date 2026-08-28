import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import embed_message, message
from functions.utils import utils
from . import config_credenciais, config_mensagem, helpers
from .config_definicoes import DefinicoesView_components, DefinicoesView_embed
from .zuros_cloud import ZurosCloudError, get_zuros_cloud, is_zuros_configured

class Cloud(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def process_log_channel(self, inter, channel_id):
        if not channel_id:
            await inter.response.send_message("Selecione um canal de texto valido.", ephemeral=True)
            return
        channel = self.bot.get_channel(int(channel_id))
        if not isinstance(channel, disnake.TextChannel):
            await inter.response.send_message("O canal selecionado nao e um canal de texto.", ephemeral=True)
            return
        config = db.get_document("cloud_data") or {}
        config["log_channel_id"] = str(channel.id)
        db.save_document("cloud_data", config)
        await self.display_cloud_panel(inter)

    def _components(self, status_text):
        colors = db.get_document("custom_colors") or {}
        kwargs = {}
        if colors.get("primary"):
            kwargs["accent_colour"] = disnake.Colour(int(colors["primary"].replace("#", ""), 16))
        configured = is_zuros_configured()
        container = disnake.ui.Container(
            disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Painel > **Zuros Auth**"),
            disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small),
            disnake.ui.TextDisplay(status_text),
            disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small),
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Colocar Key", style=disnake.ButtonStyle.green, emoji=emoji.robot, custom_id="Cloud_ConfigurarCredenciais"),
                disnake.ui.Button(label="Preferencias", style=disnake.ButtonStyle.grey, emoji=emoji.settings2, custom_id="Cloud_Definicoes", disabled=not configured),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Mensagem de Verificacao", style=disnake.ButtonStyle.grey, emoji=emoji.embed, custom_id="Cloud_DefinirMensagens", disabled=not configured),
                disnake.ui.Button(label="Definir Logs", style=disnake.ButtonStyle.grey, emoji=emoji.textc, custom_id="Cloud_DefinirLogs"),
                disnake.ui.Button(label="Atualizar Status", style=disnake.ButtonStyle.grey, emoji=emoji.reload, custom_id="Cloud_MainPanel"),
            ),
            **kwargs,
        )
        return [container, disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="PainelInicial"))]

    def _embed(self, status_text):
        colors = db.get_document("custom_colors") or {}
        embed = disnake.Embed(title="Zuros Auth", description=status_text)
        if colors.get("primary"):
            embed.color = int(colors["primary"].replace("#", ""), 16)
        configured = is_zuros_configured()
        components = [
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Colocar Key", style=disnake.ButtonStyle.green, emoji=emoji.robot, custom_id="Cloud_ConfigurarCredenciais"),
                disnake.ui.Button(label="Preferencias", style=disnake.ButtonStyle.grey, emoji=emoji.settings2, custom_id="Cloud_Definicoes", disabled=not configured),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Mensagem de Verificacao", style=disnake.ButtonStyle.grey, emoji=emoji.embed, custom_id="Cloud_DefinirMensagens", disabled=not configured),
                disnake.ui.Button(label="Definir Logs", style=disnake.ButtonStyle.grey, emoji=emoji.textc, custom_id="Cloud_DefinirLogs"),
                disnake.ui.Button(label="Atualizar Status", style=disnake.ButtonStyle.grey, emoji=emoji.reload, custom_id="Cloud_MainPanel"),
            ),
            disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="PainelInicial")),
        ]
        return embed, components

    async def display_cloud_panel(self, inter):
        mode = (db.get_document("custom_mode") or {}).get("mode")
        if hasattr(inter, "response") and not inter.response.is_done():
            if mode == "embed":
                await embed_message.wait(inter)
            else:
                await message.wait(inter)
        status_text = await helpers.get_status_text(inter)
        if mode == "embed":
            embed, components = self._embed(status_text)
            await inter.edit_original_message(content=None, embed=embed, components=components)
        else:
            await inter.edit_original_message(content=None, embed=None, components=self._components(status_text))

    async def _show_definitions(self, inter):
        mode = (db.get_document("custom_mode") or {}).get("mode")
        if mode == "embed":
            embed, components = DefinicoesView_embed(inter)
            await inter.edit_original_message(content=None, embed=embed, components=components)
        else:
            await inter.edit_original_message(content=None, embed=None, components=DefinicoesView_components(inter))

    async def _preview(self, inter):
        config = db.get_document("cloud_data") or {}
        data = config.get("message_verify", {})
        style = data.get("message_style", "embed")
        kwargs = {}
        if style == "embed":
            embed_data = data.get("embed") or {"title": "Verificacao", "description": "Clique abaixo para verificar."}
            kwargs["embed"] = disnake.Embed.from_dict(utils.normalize_embed_data(embed_data))
        elif style == "content":
            kwargs["content"] = (data.get("content") or {}).get("content") or "Clique abaixo para verificar."
        else:
            container_data = data.get("container") or {}
            kwargs["components"] = [config_mensagem.ContainerUtils.montar_container(
                conteudo=container_data.get("content") or "Clique abaixo para verificar.",
                imagem_url=container_data.get("image_url"),
                cor_hex=container_data.get("color"),
                thumbnail_url=container_data.get("thumbnail_url"),
            )]
            kwargs["flags"] = disnake.MessageFlags(is_components_v2=True)
        await inter.followup.send(**kwargs, ephemeral=True)

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        custom_id = inter.component.custom_id
        if not custom_id.startswith("Cloud"):
            return
        if custom_id == "Cloud_SetCredentialsModal":
            await inter.response.send_modal(config_credenciais.ZurosKeyModal())
            return
        if custom_id == "Cloud_DefinirLogs":
            await inter.response.send_modal(helpers.LogChannelModal(self.bot))
            return
        if custom_id == "CloudMsgEdit_EditButton":
            data = (db.get_document("cloud_data") or {}).get("message_verify", {}).get("button", {})
            await inter.response.send_modal(config_mensagem.EditButtonModal(data=data))
            return
        if custom_id == "CloudMsgEdit_EditContent":
            data = (db.get_document("cloud_data") or {}).get("message_verify", {})
            style = data.get("message_style", "embed")
            modal = config_mensagem.EditEmbedModal(data=data.get("embed", {})) if style == "embed" else config_mensagem.EditContentModal(data=data.get("content", {})) if style == "content" else config_mensagem.EditContainerModal(data=data.get("container", {}))
            await inter.response.send_modal(modal)
            return
        if custom_id == "CloudSend_External":
            await inter.response.send_modal(config_mensagem.ExternalSendModal(self.bot))
            return
        if custom_id == "Cloud_GetAuthLink":
            if inter.guild is None:
                await inter.response.send_message("Use este botão dentro de um servidor.", ephemeral=True)
                return
            await inter.response.defer(ephemeral=True, with_message=True)
            try:
                link = await get_zuros_cloud().create_auth_link(inter.author.id, inter.guild.id)
                await inter.edit_original_response(
                    content="Clique abaixo para concluir sua verificação:",
                    components=[disnake.ui.ActionRow(disnake.ui.Button(
                        label="Ir para verificação", style=disnake.ButtonStyle.link, url=link.url))],
                )
            except ZurosCloudError as error:
                await inter.edit_original_response(
                    content=f"Não foi possível gerar seu link agora: {error}", components=[])
            return

        await inter.response.defer()
        if custom_id in ("Cloud_MainPanel", "Cloud_Back"):
            await self.display_cloud_panel(inter)
        elif custom_id == "Cloud_ConfigurarCredenciais":
            await config_credenciais.show_panel(inter)
        elif custom_id == "Cloud_CopyAuthURL":
            await inter.followup.send("https://zuros-auth.vercel.app/oauth/callback", ephemeral=True)
        elif custom_id == "Cloud_Definicoes":
            await self._show_definitions(inter)
        elif custom_id == "Cloud_DefinirMensagens":
            if not is_zuros_configured():
                await inter.followup.send("Coloque a key da Zuros Auth primeiro.", ephemeral=True)
            else:
                await config_mensagem.show_panel(inter)
        elif custom_id == "CloudMsgEdit_CycleStyle":
            config = db.get_document("cloud_data") or {}
            data = config.setdefault("message_verify", {})
            styles = ["embed", "content", "container"]
            current = data.get("message_style", "embed")
            data["message_style"] = styles[(styles.index(current) + 1) % len(styles)] if current in styles else "embed"
            db.save_document("cloud_data", config)
            await config_mensagem.show_panel(inter)
        elif custom_id == "CloudMsgEdit_Send":
            await config_mensagem.show_send_panel(inter, self.bot)
        elif custom_id == "CloudMsgEdit_Preview":
            await self._preview(inter)

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(self, inter: disnake.MessageInteraction):
        custom_id = inter.component.custom_id
        if custom_id == "CloudDefinicoes_Select":
            await inter.response.defer()
            config = db.get_document("cloud_data") or {}
            definitions = config.setdefault("definitions", {})
            key = inter.values[0]
            setting = definitions.setdefault(key, {})
            setting["enabled"] = not setting.get("enabled", False)
            db.save_document("cloud_data", config)
            await self._show_definitions(inter)
        elif custom_id == "CloudSend_ChannelSelect":
            await inter.response.defer(ephemeral=True, with_message=True)
            channel = self.bot.get_channel(int(inter.values[0]))
            if not isinstance(channel, disnake.TextChannel):
                await inter.edit_original_message(components=[disnake.ui.Container(disnake.ui.TextDisplay("Canal de texto nao encontrado."))])
                return
            config = db.get_document("cloud_data") or {}
            success, error = await config_mensagem._send_verification_message(channel, config.get("message_verify", {}))
            result_text = f"Mensagem enviada para {channel.mention}." if success else f"Falha: {error}"
            await inter.edit_original_message(components=[
                disnake.ui.Container(disnake.ui.TextDisplay(result_text))
            ])

def setup(bot: commands.Bot):
    bot.add_cog(Cloud(bot))