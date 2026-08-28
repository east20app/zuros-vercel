from disnake.ext import commands
import disnake

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .listar import CANAIS_OPCOES


class ConfigurarCanais(commands.Cog):
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
    def _get_canal(
        guild: disnake.Guild | None,
        canal_id,
    ) -> disnake.TextChannel | None:

        if guild is None or not canal_id:
            return None

        try:
            canal_id = int(canal_id)
        except (TypeError, ValueError):
            return None

        canal = guild.get_channel(canal_id)

        if isinstance(canal, disnake.TextChannel):
            return canal

        return None

    # ─────────────────────────────────────────────
    # SELECT OPTIONS
    # ─────────────────────────────────────────────

    @staticmethod
    def _build_options(
        inter: disnake.MessageInteraction,
    ) -> list[disnake.SelectOption]:

        definicoes = db.get_document("canais") or {}
        guild = inter.guild

        options = []

        for key, label, emoji_icon in CANAIS_OPCOES:
            canal = ConfigurarCanais._get_canal(
                guild,
                definicoes.get(key),
            )

            if canal:
                nome = canal.name

                if len(nome) > 28:
                    nome = f"{nome[:28]}..."

                descricao = f"Atual: #{nome}"
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
    # SELECT ROWS
    # ─────────────────────────────────────────────

    @staticmethod
    def _build_select_rows(
        inter: disnake.MessageInteraction,
    ) -> list[disnake.ui.ActionRow]:

        options = ConfigurarCanais._build_options(inter)

        rows = []

        for index, chunk in enumerate(
            ConfigurarCanais._chunks(options, 25)
        ):
            rows.append(
                disnake.ui.ActionRow(
                    disnake.ui.Select(
                        placeholder=(
                            "Escolha um canal para configurar"
                            if index == 0
                            else "Mais canais para configurar"
                        ),
                        options=chunk,
                        custom_id=f"Configuracoes_EditarCanal:{index}",
                        min_values=1,
                        max_values=1,
                    )
                )
            )

        return rows

    # ─────────────────────────────────────────────
    # COMPONENTS
    # ─────────────────────────────────────────────

    @staticmethod
    def canais_components(
        inter: disnake.MessageInteraction,
    ) -> list:

        select_rows = ConfigurarCanais._build_select_rows(inter)

        container_kwargs = {}

        primary_color = ConfigurarCanais._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(
                primary_color
            )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Configurações › Canais"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Gerencie todos os canais utilizados pelo sistema.\n"
                    "Selecione uma opção abaixo para configurar um canal "
                    "ou utilize a criação automática."
                ),

                disnake.ui.Separator(),

                *select_rows,

                disnake.ui.Separator(),

                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Criar todos os canais",
                        emoji=emoji.wand,
                        style=disnake.ButtonStyle.blurple,
                        custom_id="Configuracoes_CriarTodosCanais",
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
    def canais_embed(
        inter: disnake.MessageInteraction,
    ):

        select_rows = ConfigurarCanais._build_select_rows(inter)

        embed = disnake.Embed(
            title="Canais",
            description=(
                "Gerencie todos os canais utilizados pelo sistema.\n"
                "Selecione uma opção abaixo para configurar um canal "
                "ou utilize a criação automática."
            ),
        )

        primary_color = ConfigurarCanais._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        components = [
            *select_rows,

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Criar todos os canais",
                    emoji=emoji.wand,
                    style=disnake.ButtonStyle.blurple,
                    custom_id="Configuracoes_CriarTodosCanais",
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
    # ATUALIZAR PAINEL
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

            embed, components = self.canais_embed(inter)

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
            components=self.canais_components(inter)
        )

    # ─────────────────────────────────────────────
    # BUTTON LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def on_button_click(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if custom_id != "Configuracoes_EditarCanais":
            return

        await self._abrir_painel(inter)