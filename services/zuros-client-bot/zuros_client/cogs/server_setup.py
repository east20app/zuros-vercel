import discord
from discord import app_commands
from discord.ext import commands

from ..api import ZurosClientApi
from ..config import Settings
from ..emojis import emoji
from ..formatters import error_message
from ..theme import FOOTER, Accent
from .acquisition import AcquisitionView
from .central import CentralView
from .live_status import status_names
from .welcome import WelcomeView

ROLE_SPECS = (
    ("ZUROS Admin", Accent.BRAND, True),
    ("ZUROS Suporte", Accent.SUPPORT, True),
    ("Cliente ZUROS", Accent.SUCCESS, False),
)

CATEGORY_SPECS = ("COMECE AQUI", "ATENDIMENTO", "STATUS ZUROS")
CHANNEL_SPECS = (
    ("boas-vindas", "COMECE AQUI", "Conheça a ZUROS e acesse nossos serviços."),
    ("central-zuros", "COMECE AQUI", "Central de gerenciamento dos serviços ZUROS."),
    ("adquirir", "COMECE AQUI", "Catálogo oficial de aplicações e planos ZUROS."),
    ("suporte", "ATENDIMENTO", "Tire dúvidas e fale com a equipe ZUROS."),
)
VOICE_CHANNEL_SPECS = (f"{emoji.online} Apps online: 0", f"{emoji.wifi} Ping: 0ms")


def find_role(guild: discord.Guild, name: str) -> discord.Role | None:
    return discord.utils.find(lambda role: role.name.casefold() == name.casefold(), guild.roles)


def find_category(guild: discord.Guild, name: str) -> discord.CategoryChannel | None:
    return discord.utils.find(
        lambda category: category.name.casefold() == name.casefold(), guild.categories
    )


def find_text_channel(guild: discord.Guild, name: str) -> discord.TextChannel | None:
    return discord.utils.find(
        lambda channel: channel.name.casefold() == name.casefold(), guild.text_channels
    )


async def channel_needs_panel(channel: discord.TextChannel, bot_id: int) -> bool:
    try:
        async for message in channel.history(limit=25):
            if message.author.id == bot_id and message.components:
                return False
    except discord.HTTPException:
        pass
    return True


def support_view(settings: Settings) -> discord.ui.LayoutView:
    view = discord.ui.LayoutView(timeout=None)
    container = discord.ui.Container(accent_colour=Accent.SUPPORT)
    container.add_item(
        discord.ui.TextDisplay(
            f"## {emoji.speech} Suporte ZUROS\n\n"
            "Precisa de ajuda com sua conta, aplicação ou pagamento? "
            "Acesse nossa comunidade para falar com a equipe.\n\n"
            + FOOTER.format(tagline="Atendimento próximo quando você precisar")
        )
    )
    container.add_item(
        discord.ui.ActionRow(
            discord.ui.Button(
                label="Abrir suporte",
                emoji=emoji.speech,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_support_url),
            ),
            discord.ui.Button(
                label="Abrir painel",
                emoji=emoji.website,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_dashboard_url),
            ),
        )
    )
    view.add_item(container)
    return view


class ServerSetupCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi, settings: Settings):
        self.bot = bot
        self.api = api
        self.settings = settings

    @app_commands.command(
        name="configurar-servidor",
        description="Cria os cargos, canais e painéis necessários para a ZUROS",
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def setup_server(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        if guild is None:
            await interaction.followup.send(
                "Este comando só pode ser usado em um servidor.", ephemeral=True
            )
            return
        me = guild.me
        if (
            not me
            or not me.guild_permissions.manage_channels
            or not me.guild_permissions.manage_roles
        ):
            await interaction.followup.send(
                "Preciso das permissões **Gerenciar canais** e **Gerenciar cargos**.",
                ephemeral=True,
            )
            return

        created: list[str] = []
        reused: list[str] = []
        try:
            roles: dict[str, discord.Role] = {}
            for name, colour, hoist in ROLE_SPECS:
                role = find_role(guild, name)
                if role:
                    reused.append(f"cargo {name}")
                else:
                    role = await guild.create_role(
                        name=name,
                        colour=discord.Colour(colour),
                        hoist=hoist,
                        reason=f"Configuração ZUROS solicitada por {interaction.user}",
                    )
                    created.append(f"cargo {name}")
                roles[name] = role

            read_only = {
                guild.default_role: discord.PermissionOverwrite(
                    view_channel=True, send_messages=False, read_message_history=True
                ),
                roles["ZUROS Admin"]: discord.PermissionOverwrite(
                    view_channel=True, send_messages=True, manage_messages=True
                ),
                roles["ZUROS Suporte"]: discord.PermissionOverwrite(
                    view_channel=True, send_messages=True, manage_messages=True
                ),
            }
            support_access = {
                guild.default_role: discord.PermissionOverwrite(
                    view_channel=True, send_messages=True, read_message_history=True
                ),
                roles["ZUROS Admin"]: discord.PermissionOverwrite(
                    view_channel=True, send_messages=True, manage_messages=True
                ),
                roles["ZUROS Suporte"]: discord.PermissionOverwrite(
                    view_channel=True, send_messages=True, manage_messages=True
                ),
            }

            categories: dict[str, discord.CategoryChannel] = {}
            for name in CATEGORY_SPECS:
                category = find_category(guild, name)
                if category:
                    reused.append(f"categoria {name}")
                else:
                    category = await guild.create_category(
                        name,
                        reason=f"Configuração ZUROS solicitada por {interaction.user}",
                    )
                    created.append(f"categoria {name}")
                categories[name] = category

            channels: dict[str, discord.TextChannel] = {}
            for name, category_name, topic in CHANNEL_SPECS:
                channel = find_text_channel(guild, name)
                if channel:
                    reused.append(f"canal #{name}")
                else:
                    channel = await guild.create_text_channel(
                        name,
                        category=categories[category_name],
                        topic=topic,
                        overwrites=support_access if name == "suporte" else read_only,
                        reason=f"Configuração ZUROS solicitada por {interaction.user}",
                    )
                    created.append(f"canal #{name}")
                channels[name] = channel

            voice_overwrites = {
                guild.default_role: discord.PermissionOverwrite(view_channel=True, connect=False),
                roles["ZUROS Admin"]: discord.PermissionOverwrite(
                    view_channel=True, connect=False, manage_channels=True
                ),
            }
            try:
                stats = await self.api.stats()
                voice_names = status_names(
                    int(stats.get("online") or 0),
                    max(0, round(self.bot.latency * 1000)),
                )
            except Exception:
                voice_names = VOICE_CHANNEL_SPECS
            for name in voice_names:
                prefix = name.split(":", 1)[0]
                voice = discord.utils.find(
                    lambda item, current=prefix: item.name.startswith(current),
                    guild.voice_channels,
                )
                if voice:
                    reused.append(f"status {voice.name}")
                else:
                    await guild.create_voice_channel(
                        name,
                        category=categories["STATUS ZUROS"],
                        overwrites=voice_overwrites,
                        reason=f"Configuração ZUROS solicitada por {interaction.user}",
                    )
                    created.append(f"status {name}")

            bot_id = self.bot.user.id if self.bot.user else 0
            try:
                products = [product for product in await self.api.catalog() if product.plans]
            except Exception:
                products = []
            panels = {
                "boas-vindas": WelcomeView(self.settings),
                "central-zuros": CentralView(self.settings),
                "adquirir": AcquisitionView(self.api, self.settings, products),
                "suporte": support_view(self.settings),
            }
            published: list[str] = []
            for name, view in panels.items():
                if await channel_needs_panel(channels[name], bot_id):
                    await channels[name].send(view=view)
                    published.append(channels[name].mention)

            summary = ["## Configuração ZUROS concluída"]
            if created:
                summary.append(f"**Criados:** {', '.join(created)}")
            if reused:
                summary.append(f"**Reutilizados:** {', '.join(reused)}")
            if published:
                summary.append(f"**Painéis publicados:** {', '.join(published)}")
            else:
                summary.append("Os painéis já estavam publicados.")
            await interaction.followup.send("\n".join(summary), ephemeral=True)
        except discord.Forbidden:
            await interaction.followup.send(
                "O Discord recusou a criação. Coloque o cargo do bot acima dos cargos ZUROS "
                "e confirme as permissões de canais e cargos.",
                ephemeral=True,
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ServerSetupCog(bot, bot.api, bot.settings))  # type: ignore[attr-defined]
