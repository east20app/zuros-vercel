import discord
from discord import app_commands
from discord.ext import commands

from ..config import Settings
from ..emojis import emoji
from ..theme import FOOTER, Accent


def welcome_text() -> str:
    return f"""## {emoji.zuros} Seja muito bem-vindo(a) à ZUROS!

A **ZUROS** existe para simplificar a operação de empreendedores digitais com tecnologia
confiável, atendimento próximo e ferramentas que realmente ajudam no dia a dia.

Reunimos automação, vendas, pagamentos e gerenciamento de aplicações em uma experiência
clara. Cada recurso foi pensado para reduzir tarefas repetitivas, organizar sua operação e
permitir que você dedique mais tempo ao crescimento do seu negócio.

Nossa plataforma conecta o Discord ao painel web para que você controle seus serviços com
segurança em qualquer lugar. Da primeira configuração ao acompanhamento das vendas, a ZUROS
mantém tudo acessível em uma única operação.

### ✨ Tecnologia que acompanha o seu crescimento

A ZUROS une praticidade, controle e evolução contínua para transformar processos complexos
em experiências simples.

{FOOTER.format(tagline="Tecnologia com propósito para o seu negócio")}
"""


WELCOME_TEXT = welcome_text()


class WelcomeView(discord.ui.LayoutView):
    def __init__(self, settings: Settings):
        super().__init__(timeout=None)
        links = discord.ui.ActionRow(
            discord.ui.Button(
                label="Conhecer os planos",
                emoji=emoji.store,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_plans_url),
            ),
            discord.ui.Button(
                label="Abrir painel",
                emoji=emoji.website,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_dashboard_url),
            ),
            discord.ui.Button(
                label="Comunidade e suporte",
                emoji=emoji.speech,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_support_url),
            ),
        )
        container = discord.ui.Container(accent_colour=Accent.BRAND)
        container.add_item(discord.ui.TextDisplay(welcome_text()))
        container.add_item(discord.ui.Separator(spacing=discord.SeparatorSpacing.large))
        container.add_item(links)
        self.add_item(container)


class WelcomeCog(commands.Cog):
    def __init__(self, bot: commands.Bot, settings: Settings):
        self.bot = bot
        self.settings = settings

    @app_commands.command(
        name="boas-vindas", description="Publique a apresentação institucional da ZUROS"
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def welcome(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        if not interaction.channel:
            await interaction.followup.send("Não foi possível identificar o canal.", ephemeral=True)
            return
        await interaction.channel.send(view=WelcomeView(self.settings))
        await interaction.followup.send("Boas-vindas publicadas neste canal.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(WelcomeCog(bot, bot.settings))  # type: ignore[attr-defined]
