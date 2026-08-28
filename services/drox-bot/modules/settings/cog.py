from disnake.ext import commands
import disnake

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message
from functions.plan import should_enable_settings_button


class Settings(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────

    @staticmethod
    def _get_mode() -> str:
        data = db.get_document("custom_mode") or {}
        return data.get("mode", "components")

    @staticmethod
    def _get_primary_color() -> int | None:
        colors = db.get_document("custom_colors") or {}
        primary = colors.get("primary")

        if not primary:
            return None

        try:
            return int(
                str(primary).replace("#", ""),
                16,
            )
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _build_options() -> list[disnake.SelectOption]:
        return [
            disnake.SelectOption(
                label="Cargos",
                value="cargos",
                emoji=emoji.role,
                description="Gerencie cargos do servidor",
            ),
            disnake.SelectOption(
                label="Canais",
                value="canais",
                emoji=emoji.textc,
                description="Gerencie canais do servidor",
            ),
            disnake.SelectOption(
                label="Formas de Pagamento",
                value="pagamentos",
                emoji=emoji.wallet,
                description="Configure os pagamentos via PIX",
            ),
            disnake.SelectOption(
                label="Anti-Fake",
                value="antifake",
                emoji=emoji.members,
                description="Configure proteção contra contas falsas",
            ),
            disnake.SelectOption(
                label="Notificações",
                value="notificacoes",
                emoji=emoji.warn,
                description="Configure as notificações de vendas",
            ),
            disnake.SelectOption(
                label="Bloquear Usuários",
                value="blacklist",
                emoji=emoji.lock,
                description="Bloqueie usuários de comprar em seu bot",
            ),
        ]

    # ─────────────────────────────────────────────
    # COMPONENTS V2
    # ─────────────────────────────────────────────

    def settings_components(
        self,
        inter: disnake.MessageInteraction,
    ) -> list[disnake.ui.Container]:

        container_kwargs = {}

        primary_color = self._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = (
                disnake.Colour(primary_color)
            )

        options = self._build_options()

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › **Configurações**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Configure e personalize os recursos do servidor.\n"
                    "Selecione uma seção abaixo para configurar."
                ),

                disnake.ui.Separator(),

                disnake.ui.ActionRow(
                    disnake.ui.StringSelect(
                        custom_id="Configuracoes_Select",
                        placeholder="Selecione uma seção para configurar",
                        options=options,
                        min_values=1,
                        max_values=1,
                    )
                ),

                **container_kwargs,
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Personalização",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.wand,
                    custom_id="Painel_Personalizacao",
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="PainelInicial",
                )
            ),
        ]

    # ─────────────────────────────────────────────
    # EMBED
    # ─────────────────────────────────────────────

    def settings_embed(
        self,
        inter: disnake.MessageInteraction,
    ):

        embed = disnake.Embed(
            title="Configurações",
            description=(
                "Configure e personalize os recursos do servidor.\n"
                "Selecione uma seção abaixo para configurar."
            ),
        )

        primary_color = self._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        options = self._build_options()

        components = [
            disnake.ui.ActionRow(
                disnake.ui.StringSelect(
                    custom_id="Configuracoes_Select",
                    placeholder="Selecione uma seção para configurar",
                    options=options,
                    min_values=1,
                    max_values=1,
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Personalização",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.wand,
                    custom_id="Painel_Personalizacao",
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="PainelInicial",
                )
            ),
        ]

        return embed, components

    # ─────────────────────────────────────────────
    # BOTÃO
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def on_button_click(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if custom_id != "Painel_Configuracoes":
            return

        mode = self._get_mode()

        if mode == "embed":
            await embed_message.wait(
                inter,
                send=False,
            )

            embed, components = self.settings_embed(inter)

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await message.wait(
                inter,
                send=False,
            )

            await inter.edit_original_message(
                components=self.settings_components(inter)
            )

    # ─────────────────────────────────────────────
    # DROPDOWN
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(
        self,
        inter: disnake.MessageInteraction,
    ):

        if (
            inter.component.custom_id
            != "Configuracoes_Select"
        ):
            return

        if not inter.values:
            return

        choice = inter.values[0]
        mode = self._get_mode()

        # ─────────────────────────────────────────
        # NOTIFICAÇÕES
        # ─────────────────────────────────────────

        if choice == "notificacoes":
            from .notificacoes.cog import ConfigureNotifications

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                panel = ConfigureNotifications.panel(inter)

                await inter.edit_original_message(
                    content=None,
                    **panel,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                panel = ConfigureNotifications.panel(inter)

                await inter.edit_original_message(
                    **panel,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )

            return

        # ─────────────────────────────────────────
        # BLACKLIST
        # ─────────────────────────────────────────

        if choice == "blacklist":
            from .bloquear.cog import ConfigurarBlacklist

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                panel = ConfigurarBlacklist.panel(inter)

                await inter.edit_original_message(
                    content=None,
                    **panel,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                panel = ConfigurarBlacklist.panel(inter)

                await inter.edit_original_message(
                    **panel,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )

            return

        # ─────────────────────────────────────────
        # ANTI-FAKE
        # ─────────────────────────────────────────

        if choice == "antifake":
            from .antifake.cog import AntiFakeConfig

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                panel = AntiFakeConfig.panel(inter)

                await inter.edit_original_message(
                    content=None,
                    **panel,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                panel = AntiFakeConfig.panel(inter)

                await inter.edit_original_message(
                    **panel,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )

            return

        # ─────────────────────────────────────────
        # CARGOS
        # ─────────────────────────────────────────

        if choice == "cargos":
            from .cargos.cog import ConfigurarCargos

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                embed, components = (
                    ConfigurarCargos.cargos_embed(inter)
                )

                await inter.edit_original_message(
                    content=None,
                    embed=embed,
                    components=components,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                await inter.edit_original_message(
                    components=(
                        ConfigurarCargos
                        .cargos_components(inter)
                    )
                )

            return

        # ─────────────────────────────────────────
        # CANAIS
        # ─────────────────────────────────────────

        if choice == "canais":
            from .canais.cog import ConfigurarCanais

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                embed, components = (
                    ConfigurarCanais.canais_embed(inter)
                )

                await inter.edit_original_message(
                    content=None,
                    embed=embed,
                    components=components,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                await inter.edit_original_message(
                    components=(
                        ConfigurarCanais
                        .canais_components(inter)
                    )
                )

            return

        # ─────────────────────────────────────────
        # PAGAMENTOS PIX
        # ─────────────────────────────────────────

        if choice == "pagamentos":
            from .payments.cog import ConfigurarPagamentos

            if mode == "embed":
                await embed_message.wait(
                    inter,
                    send=False,
                )

                embed, components = (
                    ConfigurarPagamentos
                    .pagamentos_embed(inter)
                )

                await inter.edit_original_message(
                    content=None,
                    embed=embed,
                    components=components,
                )

            else:
                await message.wait(
                    inter,
                    send=False,
                )

                await inter.edit_original_message(
                    components=(
                        ConfigurarPagamentos
                        .pagamentos_components(inter)
                    )
                )

            return


def setup(bot: commands.Bot):
    bot.add_cog(Settings(bot))