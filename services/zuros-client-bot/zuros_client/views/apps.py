import discord

from ..api import ZurosClientApi
from ..config import Settings
from ..emojis import emoji
from ..formatters import application_panel_text, error_message
from ..guards import InteractionLimiter, owner_only
from ..models import Application
from ..theme import FOOTER, Accent

limiter = InteractionLimiter()


class RenameModal(discord.ui.Modal, title="Alterar nome da aplicação"):
    name = discord.ui.TextInput(label="Novo nome", min_length=1, max_length=40)

    def __init__(self, view: "ApplicationView"):
        super().__init__()
        self.panel = view
        self.name.default = view.app.name

    async def on_submit(self, interaction: discord.Interaction) -> None:
        if not await owner_only(interaction, self.panel.owner_id):
            return
        await interaction.response.defer(ephemeral=True)
        try:
            await self.panel.api.rename(str(interaction.user.id), self.panel.app.id, str(self.name))
            await self.panel.refresh(interaction, "Nome atualizado.")
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class TokenModal(discord.ui.Modal, title="Atualizar token do bot"):
    token = discord.ui.TextInput(
        label="Novo token", min_length=30, max_length=256, style=discord.TextStyle.short
    )

    def __init__(self, view: "ApplicationView"):
        super().__init__()
        self.panel = view

    async def on_submit(self, interaction: discord.Interaction) -> None:
        if not await owner_only(interaction, self.panel.owner_id):
            return
        await interaction.response.defer(ephemeral=True)
        value = str(self.token)
        try:
            await self.panel.api.update_token(str(interaction.user.id), self.panel.app.id, value)
            value = ""  # não manter o segredo depois da requisição
            await self.panel.refresh(interaction, "Token atualizado e implantação solicitada.")
        except Exception as error:
            value = ""
            await interaction.followup.send(error_message(error), ephemeral=True)


class GuildSelect(discord.ui.Select):
    def __init__(self, panel: "ApplicationView", guilds: list[tuple[str, str]]):
        self.panel = panel
        super().__init__(
            placeholder="Escolha o servidor principal",
            options=[
                discord.SelectOption(
                    label=name[:100],
                    value=guild_id,
                    default=guild_id == panel.app.server_id,
                    emoji=emoji.members,
                )
                for guild_id, name in guilds[:25]
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if not await owner_only(interaction, self.panel.owner_id):
            return
        await interaction.response.defer(ephemeral=True)
        try:
            await self.panel.api.set_main_guild(
                str(interaction.user.id), self.panel.app.id, self.values[0]
            )
            await self.panel.refresh(interaction, "Servidor principal atualizado.")
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class ApplicationButton(discord.ui.Button["ApplicationView"]):
    def __init__(
        self,
        panel: "ApplicationView",
        action: str,
        label: str,
        style: discord.ButtonStyle,
        *,
        disabled: bool = False,
    ):
        action_emojis = {
            "start": emoji.play,
            "restart": emoji.reload,
            "stop": emoji.power,
            "update": emoji.sync,
            "rename": emoji.edit,
            "token": emoji.lock,
            "guild": emoji.settings,
        }
        super().__init__(
            label=label,
            emoji=action_emojis.get(action),
            style=style,
            disabled=disabled,
        )
        self.panel = panel
        self.action = action

    async def callback(self, interaction: discord.Interaction) -> None:
        if self.action in {"start", "restart", "stop", "update"}:
            await self.panel.action(interaction, self.action)
        elif self.action == "rename":
            await interaction.response.send_modal(RenameModal(self.panel))
        elif self.action == "token":
            await interaction.response.send_modal(TokenModal(self.panel))
        elif self.action == "guild":
            await self.panel.choose_guild(interaction)


class ApplicationView(discord.ui.LayoutView):
    def __init__(
        self,
        api: ZurosClientApi,
        settings: Settings,
        owner_id: int,
        app: Application,
        notice: str | None = None,
    ):
        super().__init__(timeout=600)
        self.api, self.settings, self.owner_id, self.app = api, settings, owner_id, app
        active = app.status == "active"
        controls = discord.ui.ActionRow()
        controls.add_item(
            ApplicationButton(
                self,
                "start",
                "Iniciar",
                discord.ButtonStyle.success,
                disabled=not active or app.online,
            )
        )
        controls.add_item(
            ApplicationButton(
                self,
                "restart",
                "Reiniciar",
                discord.ButtonStyle.primary,
                disabled=not active or not app.online,
            )
        )
        controls.add_item(
            ApplicationButton(
                self,
                "stop",
                "Desligar",
                discord.ButtonStyle.danger,
                disabled=not active or not app.online,
            )
        )
        controls.add_item(
            ApplicationButton(
                self,
                "update",
                "Atualizar",
                discord.ButtonStyle.secondary,
                disabled=not active,
            )
        )

        settings_row = discord.ui.ActionRow()
        settings_row.add_item(
            ApplicationButton(self, "rename", "Alterar nome", discord.ButtonStyle.secondary)
        )
        settings_row.add_item(
            ApplicationButton(self, "token", "Atualizar token", discord.ButtonStyle.secondary)
        )
        settings_row.add_item(
            ApplicationButton(self, "guild", "Servidor principal", discord.ButtonStyle.secondary)
        )
        dashboard = f"{str(settings.zuros_dashboard_url).rstrip('/')}/{app.bot_id or app.id}"
        settings_row.add_item(
            discord.ui.Button(
                label="Abrir painel",
                emoji=emoji.website,
                style=discord.ButtonStyle.link,
                url=dashboard,
            )
        )
        if app.bot_id:
            invite = f"https://discord.com/oauth2/authorize?client_id={app.bot_id}&scope=bot%20applications.commands&permissions=274878221312"
            settings_row.add_item(
                discord.ui.Button(
                    label="Adicionar ao servidor",
                    emoji=emoji.plus,
                    style=discord.ButtonStyle.link,
                    url=invite,
                )
            )

        container = discord.ui.Container(
            accent_colour=Accent.SUCCESS if app.online else Accent.NEUTRAL
        )
        container.add_item(discord.ui.TextDisplay(application_panel_text(app, notice)))
        container.add_item(discord.ui.Separator(spacing=discord.SeparatorSpacing.large))
        container.add_item(controls)
        container.add_item(discord.ui.TextDisplay("-# Configuração"))
        container.add_item(settings_row)
        self.add_item(container)

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return await owner_only(interaction, self.owner_id)

    async def refresh(self, interaction: discord.Interaction, notice: str | None = None) -> None:
        self.app = await self.api.get_application(str(self.owner_id), self.app.id)
        view = ApplicationView(self.api, self.settings, self.owner_id, self.app, notice)
        await interaction.edit_original_response(view=view)

    async def action(self, interaction: discord.Interaction, action: str) -> None:
        if not limiter.allow(interaction.user.id, action):
            await interaction.response.send_message(
                "Aguarde alguns segundos antes de repetir esta ação.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        try:
            await self.api.operate(str(interaction.user.id), self.app.id, action)
            await self.refresh(interaction, "Ação enviada com sucesso.")
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)

    async def choose_guild(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            guilds = await self.api.list_guilds(str(interaction.user.id), self.app.id)
            if not guilds:
                await interaction.followup.send(
                    "O bot ainda não está em nenhum servidor disponível.", ephemeral=True
                )
                return
            view = discord.ui.View(timeout=180)
            view.add_item(GuildSelect(self, [(item.id, item.name) for item in guilds]))
            await interaction.followup.send("Selecione o servidor:", view=view, ephemeral=True)
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class ApplicationSelect(discord.ui.Select):
    def __init__(self, parent: "ApplicationListView", apps: list[Application]):
        self.parent_view = parent
        super().__init__(
            placeholder="Selecione uma aplicação",
            options=[
                discord.SelectOption(
                    label=app.name[:100],
                    value=app.id,
                    description=f"v{app.version} • {app.status}"[:100],
                    emoji=emoji.robot,
                )
                for app in apps[:25]
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if not await owner_only(interaction, self.parent_view.owner_id):
            return
        await interaction.response.defer(ephemeral=True)
        try:
            app = await self.parent_view.api.get_application(
                str(interaction.user.id), self.values[0]
            )
            await interaction.edit_original_response(
                view=ApplicationView(
                    self.parent_view.api, self.parent_view.settings, interaction.user.id, app
                ),
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class ApplicationListView(discord.ui.LayoutView):
    def __init__(
        self, api: ZurosClientApi, settings: Settings, owner_id: int, apps: list[Application]
    ):
        super().__init__(timeout=600)
        self.api, self.settings, self.owner_id = api, settings, owner_id
        container = discord.ui.Container(accent_colour=Accent.BRAND)
        container.add_item(
            discord.ui.TextDisplay(
                f"## {emoji.robot} Suas aplicações\n"
                f"Você possui **{len(apps)}** aplicações. "
                "Escolha uma para gerenciar.\n\n"
                + FOOTER.format(tagline="Suas aplicações em um só lugar")
            )
        )
        container.add_item(discord.ui.Separator())
        container.add_item(discord.ui.ActionRow(ApplicationSelect(self, apps)))
        self.add_item(container)
