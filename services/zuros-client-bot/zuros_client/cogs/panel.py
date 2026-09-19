"""Single administrative entry point for the bot's Discord controls."""

import discord
from discord import app_commands
from discord.ext import commands

from ..emojis import emoji
from ..formatters import error_message
from ..theme import FOOTER, Accent
from ..tickets.store import TicketConfig
from .acquisition import AcquisitionView
from .central import CentralView
from .welcome import WelcomeView


def is_admin(interaction: discord.Interaction) -> bool:
    return (
        isinstance(interaction.user, discord.Member)
        and interaction.user.guild_permissions.administrator
    )


class AdminView(discord.ui.LayoutView):
    def __init__(self, bot: commands.Bot, owner_id: int):
        super().__init__(timeout=300)
        self.bot = bot
        self.owner_id = owner_id
        card = discord.ui.Container(accent_colour=Accent.BRAND)
        card.add_item(
            discord.ui.TextDisplay(
                f"## {emoji.zuros} Painel administrativo ZUROS\n\n"
                "Escolha uma função abaixo. As ações aparecem somente para você.\n\n"
                + FOOTER.format(tagline="Administração do servidor")
            )
        )
        card.add_item(discord.ui.ActionRow(AdminSelect()))
        self.add_item(card)

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.owner_id or not is_admin(interaction):
            await interaction.response.send_message(
                "Apenas administradores podem usar este painel.", ephemeral=True
            )
            return False
        return True


class AdminSelect(discord.ui.Select[AdminView]):
    def __init__(self):
        options = [
            discord.SelectOption(label="Minhas aplicações", value="apps", emoji=emoji.robot),
            discord.SelectOption(label="Comprar aplicação", value="store", emoji=emoji.cart),
            discord.SelectOption(label="Renovar aplicação", value="renew", emoji=emoji.reload),
            discord.SelectOption(label="Publicar painéis", value="publish", emoji=emoji.website),
            discord.SelectOption(
                label="Configurar servidor e tickets", value="setup", emoji=emoji.settings
            ),
            discord.SelectOption(
                label="Configurar tickets", value="ticket_config", emoji=emoji.ticket
            ),
            discord.SelectOption(
                label="Gerenciar ticket atual", value="ticket_manage", emoji=emoji.edit
            ),
            discord.SelectOption(label="Verificar conexão", value="status", emoji=emoji.online),
        ]
        super().__init__(placeholder="Escolha uma função", options=options)

    async def callback(self, interaction: discord.Interaction) -> None:
        action = self.values[0]
        bot = self.view.bot
        if action in {"apps", "store", "renew", "setup"}:
            cog_name = {
                "apps": "ApplicationsCog",
                "store": "CommerceCog",
                "renew": "CommerceCog",
                "setup": "ServerSetupCog",
            }[action]
            method_name = {
                "apps": "show_apps",
                "store": "show_store",
                "renew": "show_renewal",
                "setup": "setup_server",
            }[action]
            cog = bot.get_cog(cog_name)
            if cog is None:
                await interaction.response.send_message(
                    "Função temporariamente indisponível.", ephemeral=True
                )
                return
            handler = getattr(cog, method_name)
            if action == "setup":
                await handler.callback(cog, interaction)
            else:
                await handler(interaction)
        elif action == "publish":
            await interaction.response.send_message(
                "Selecione o painel e depois o canal de publicação.",
                view=PublishView(bot, interaction.user.id),
                ephemeral=True,
            )
        elif action == "ticket_config":
            await interaction.response.send_message(
                "Selecione a categoria, o cargo da equipe e os canais de logs e painel.",
                view=TicketConfigView(bot, interaction.user.id),
                ephemeral=True,
            )
        elif action == "ticket_manage":
            await interaction.response.send_message(
                "Gerencie membros ou exclua um ticket já fechado.",
                view=TicketManageView(bot, interaction.user.id),
                ephemeral=True,
            )
        else:
            await interaction.response.defer(ephemeral=True)
            try:
                await bot.api.health()  # type: ignore[attr-defined]
                await interaction.followup.send(
                    f"API ZUROS operacional {emoji.online}", ephemeral=True
                )
            except Exception as error:
                await interaction.followup.send(error_message(error), ephemeral=True)


class TicketConfigView(discord.ui.View):
    def __init__(self, bot: commands.Bot, owner_id: int):
        super().__init__(timeout=300)
        self.bot = bot
        self.owner_id = owner_id
        self.chosen: dict[str, int] = {}
        self.add_item(TicketCategorySelect())
        self.add_item(TicketRoleSelect())
        self.add_item(TicketChannelSelect("logs", "3. Canal de logs"))
        self.add_item(TicketChannelSelect("panel", "4. Canal do painel"))

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.owner_id or not is_admin(interaction):
            await interaction.response.send_message(
                "Apenas administradores podem configurar tickets.", ephemeral=True
            )
            return False
        return True

    @discord.ui.button(label="Salvar configuração", style=discord.ButtonStyle.success)
    async def save(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        if set(self.chosen) != {"category", "role", "logs", "panel"}:
            await interaction.response.send_message(
                "Selecione todos os quatro campos antes de salvar.", ephemeral=True
            )
            return
        await self.bot.ticket_store.save_config(  # type: ignore[attr-defined]
            TicketConfig(
                interaction.guild_id or 0,
                self.chosen["category"],
                self.chosen["role"],
                self.chosen["logs"],
                self.chosen["panel"],
            )
        )
        await interaction.response.send_message(
            "Tickets configurados. Publique o painel em Publicar painéis.", ephemeral=True
        )


class TicketCategorySelect(discord.ui.ChannelSelect[TicketConfigView]):
    def __init__(self):
        super().__init__(
            placeholder="1. Categoria dos tickets", channel_types=[discord.ChannelType.category]
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        self.view.chosen["category"] = self.values[0].id
        await interaction.response.send_message("Categoria selecionada.", ephemeral=True)


class TicketRoleSelect(discord.ui.RoleSelect[TicketConfigView]):
    def __init__(self):
        super().__init__(placeholder="2. Cargo da equipe")

    async def callback(self, interaction: discord.Interaction) -> None:
        self.view.chosen["role"] = self.values[0].id
        await interaction.response.send_message("Cargo selecionado.", ephemeral=True)


class TicketChannelSelect(discord.ui.ChannelSelect[TicketConfigView]):
    def __init__(self, key: str, placeholder: str):
        super().__init__(placeholder=placeholder, channel_types=[discord.ChannelType.text])
        self.key = key

    async def callback(self, interaction: discord.Interaction) -> None:
        self.view.chosen[self.key] = self.values[0].id
        await interaction.response.send_message("Canal selecionado.", ephemeral=True)


class TicketManageView(discord.ui.View):
    def __init__(self, bot: commands.Bot, owner_id: int):
        super().__init__(timeout=300)
        self.bot = bot
        self.owner_id = owner_id
        self.action = "add_member"
        self.add_item(TicketActionSelect())
        self.add_item(TicketMemberSelect())

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.owner_id or not is_admin(interaction):
            await interaction.response.send_message(
                "Apenas administradores podem gerenciar tickets aqui.", ephemeral=True
            )
            return False
        return True

    @discord.ui.button(label="Excluir ticket fechado", style=discord.ButtonStyle.danger)
    async def delete(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        cog = self.bot.get_cog("TicketsCog")
        if cog is None:
            await interaction.response.send_message("Tickets indisponíveis.", ephemeral=True)
            return
        await cog.delete_ticket.callback(cog, interaction, True)


class TicketActionSelect(discord.ui.Select[TicketManageView]):
    def __init__(self):
        super().__init__(
            placeholder="1. Escolha a ação",
            options=[
                discord.SelectOption(label="Adicionar membro", value="add_member"),
                discord.SelectOption(label="Remover membro", value="remove_member"),
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        self.view.action = self.values[0]
        await interaction.response.send_message(
            "Ação selecionada. Escolha o membro.", ephemeral=True
        )


class TicketMemberSelect(discord.ui.UserSelect[TicketManageView]):
    def __init__(self):
        super().__init__(placeholder="2. Escolha o membro")

    async def callback(self, interaction: discord.Interaction) -> None:
        cog = self.view.bot.get_cog("TicketsCog")
        member = self.values[0]
        if cog is None or not isinstance(member, discord.Member):
            await interaction.response.send_message(
                "Membro ou tickets indisponíveis.", ephemeral=True
            )
            return
        handler = getattr(cog, self.view.action)
        await handler.callback(cog, interaction, member)


class PublishView(discord.ui.View):
    def __init__(self, bot: commands.Bot, owner_id: int):
        super().__init__(timeout=300)
        self.bot = bot
        self.owner_id = owner_id
        self.panel = "central"
        self.add_item(PublishTypeSelect())
        self.add_item(PublishChannelSelect())

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.owner_id or not is_admin(interaction):
            await interaction.response.send_message(
                "Apenas administradores podem publicar painéis.", ephemeral=True
            )
            return False
        return True


class PublishTypeSelect(discord.ui.Select[PublishView]):
    def __init__(self):
        super().__init__(
            placeholder="1. Escolha o painel",
            options=[
                discord.SelectOption(label="Central ZUROS", value="central"),
                discord.SelectOption(label="Aquisição", value="acquisition"),
                discord.SelectOption(label="Boas-vindas", value="welcome"),
                discord.SelectOption(label="Tickets", value="tickets"),
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        self.view.panel = self.values[0]
        await interaction.response.send_message(
            "Painel selecionado. Agora escolha o canal.", ephemeral=True
        )


class PublishChannelSelect(discord.ui.ChannelSelect[PublishView]):
    def __init__(self):
        super().__init__(placeholder="2. Escolha o canal", channel_types=[discord.ChannelType.text])

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        channel = self.values[0]
        bot = self.view.bot
        try:
            if self.view.panel == "acquisition":
                products = [p for p in await bot.api.catalog() if p.plans]  # type: ignore[attr-defined]
                panel = AcquisitionView(bot.api, bot.settings, products)  # type: ignore[attr-defined]
            elif self.view.panel == "welcome":
                panel = WelcomeView(bot.settings)  # type: ignore[attr-defined]
            elif self.view.panel == "tickets":
                from .tickets import TicketPanelView

                config = await bot.ticket_store.get_config(interaction.guild_id or 0)  # type: ignore[attr-defined]
                if config is None:
                    await interaction.followup.send(
                        "Configure o servidor e os tickets primeiro.", ephemeral=True
                    )
                    return
                panel = TicketPanelView()
            else:
                panel = CentralView(bot.settings)  # type: ignore[attr-defined]
            await channel.send(view=panel)
            await interaction.followup.send(
                f"Painel publicado em {channel.mention}.", ephemeral=True
            )
        except (discord.Forbidden, discord.HTTPException) as error:
            await interaction.followup.send(error_message(error), ephemeral=True)
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class PanelCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="painel", description="Abre as funções administrativas da ZUROS")
    async def painel(self, interaction: discord.Interaction) -> None:
        if not is_admin(interaction):
            await interaction.response.send_message(
                "Apenas administradores podem usar este painel.", ephemeral=True
            )
            return
        await interaction.response.send_message(
            view=AdminView(self.bot, interaction.user.id), ephemeral=True
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(PanelCog(bot))
