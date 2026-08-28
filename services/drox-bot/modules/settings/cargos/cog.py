from disnake.ext import commands
import disnake

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .listar import CARGOS_OPCOES


class ConfigurarCargos(commands.Cog):
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
            return int(str(primary).replace("#", ""), 16)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _chunks(seq, size: int = 25):
        for i in range(0, len(seq), size):
            yield seq[i:i + size]

    @staticmethod
    def _get_cargo(
        guild: disnake.Guild | None,
        cargo_id,
    ) -> disnake.Role | None:

        if guild is None or not cargo_id:
            return None

        try:
            cargo_id = int(cargo_id)
        except (TypeError, ValueError):
            return None

        return guild.get_role(cargo_id)

    # ─────────────────────────────────────────────
    # OPTIONS
    # ─────────────────────────────────────────────

    @staticmethod
    def _build_options(
        inter: disnake.MessageInteraction,
    ) -> list[disnake.SelectOption]:

        definicoes = db.get_document("cargos") or {}
        guild = inter.guild

        options = []

        for key, label, emoji_icon in CARGOS_OPCOES:
            cargo = ConfigurarCargos._get_cargo(
                guild,
                definicoes.get(key),
            )

            if cargo:
                nome = cargo.name

                if len(nome) > 28:
                    nome = f"{nome[:28]}..."

                descricao = f"Atual: @{nome}"
            else:
                descricao = "Atual: Não definido"

            options.append(
                disnake.SelectOption(
                    label=label,
                    value=key,
                    emoji=emoji_icon,
                    description=descricao,
                )
            )

        return options

    # ─────────────────────────────────────────────
    # SELECTS
    # ─────────────────────────────────────────────

    @staticmethod
    def _build_select_rows(
        inter: disnake.MessageInteraction,
    ) -> list[disnake.ui.ActionRow]:

        options = ConfigurarCargos._build_options(inter)

        rows = []

        for index, chunk in enumerate(
            ConfigurarCargos._chunks(options, 25)
        ):
            rows.append(
                disnake.ui.ActionRow(
                    disnake.ui.Select(
                        placeholder=(
                            "Escolha um cargo para configurar"
                            if index == 0
                            else "Mais cargos para configurar"
                        ),
                        options=chunk,
                        custom_id=f"Configuracoes_EditarCargo:{index}",
                        min_values=1,
                        max_values=1,
                    )
                )
            )

        return rows

    # ─────────────────────────────────────────────
    # COMPONENTS V2
    # ─────────────────────────────────────────────

    @staticmethod
    def cargos_components(
        inter: disnake.MessageInteraction,
    ) -> list:

        select_rows = ConfigurarCargos._build_select_rows(inter)

        container_kwargs = {}

        primary_color = ConfigurarCargos._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(
                primary_color
            )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Configurações › Cargos"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Gerencie todos os cargos utilizados pelo sistema.\n"
                    "Selecione uma opção abaixo para configurar um cargo "
                    "ou utilize a criação automática."
                ),

                disnake.ui.Separator(),

                *select_rows,

                disnake.ui.Separator(),

                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Criar todos os cargos",
                        emoji=emoji.wand,
                        style=disnake.ButtonStyle.blurple,
                        custom_id="Configuracoes_CriarTodosCargos",
                    )
                ),

                **container_kwargs,
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes",
                )
            ),
        ]

    # ─────────────────────────────────────────────
    # EMBED
    # ─────────────────────────────────────────────

    @staticmethod
    def cargos_embed(
        inter: disnake.MessageInteraction,
    ):

        select_rows = ConfigurarCargos._build_select_rows(inter)

        embed = disnake.Embed(
            title="Cargos",
            description=(
                "Gerencie todos os cargos utilizados pelo sistema.\n"
                "Selecione uma opção abaixo para configurar um cargo "
                "ou utilize a criação automática."
            ),
        )

        primary_color = ConfigurarCargos._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        components = [
            *select_rows,

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Criar todos os cargos",
                    emoji=emoji.wand,
                    style=disnake.ButtonStyle.blurple,
                    custom_id="Configuracoes_CriarTodosCargos",
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes",
                )
            ),
        ]

        return embed, components

    # ─────────────────────────────────────────────
    # ABRIR / ATUALIZAR PAINEL
    # ─────────────────────────────────────────────

    async def _abrir_painel(
        self,
        inter: disnake.MessageInteraction,
    ) -> None:

        mode = self._get_mode()

        if mode == "embed":
            await embed_message.wait(
                inter,
                send=False,
            )

            embed, components = self.cargos_embed(inter)

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

            return

        await message.wait(
            inter,
            send=False,
        )

        await inter.edit_original_message(
            components=self.cargos_components(inter)
        )

    # ─────────────────────────────────────────────
    # BUTTON
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def on_button_click(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if custom_id != "Configuracoes_EditarCargos":
            return

        await self._abrir_painel(inter)