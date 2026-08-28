import random

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .listar import CARGOS_OPCOES, CARGOS_CORES
from .cog import ConfigurarCargos


class MensagensCargos:

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
    def cargo_criado_components(
        cargo: disnake.Role,
        auto: bool,
    ) -> disnake.ui.Container:

        origem = (
            "Criar Todos os Cargos Automaticamente"
            if auto
            else "Criar Cargo"
        )

        return disnake.ui.Container(
            disnake.ui.TextDisplay(
                f"# {emoji.zuros}\n"
                f"-# {origem} › Cargo Criado"
            ),

            disnake.ui.Separator(),

            disnake.ui.TextDisplay(
                "### Informações do cargo\n"
                f"**Nome:** {cargo.mention}\n"
                f"**ID:** `{cargo.id}`\n"
                f"**Cor:** `{cargo.color}`"
            ),
        )

    @staticmethod
    def cargos_criados_components(
        criados: list[disnake.Role],
    ) -> list[disnake.ui.Container]:

        cargos = "\n".join(
            f"> {cargo.mention} `({cargo.id})`"
            for cargo in criados
        )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "## Cargos Criados\n"
                    f"-# `{len(criados)}` cargos foram criados com sucesso."
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(cargos),
            )
        ]

    @staticmethod
    def cargo_criado_embed(
        cargo: disnake.Role,
        auto: bool,
    ):

        embed = disnake.Embed(
            title="Cargo Criado",
            description=(
                f"**Nome:** {cargo.mention}\n"
                f"**ID:** `{cargo.id}`\n"
                f"**Cor:** `{cargo.color}`"
            ),
        )

        primary_color = MensagensCargos._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        return embed, []

    @staticmethod
    def cargos_criados_embed(
        criados: list[disnake.Role],
    ):

        cargos = "\n".join(
            f"• {cargo.mention} `({cargo.id})`"
            for cargo in criados
        )

        embed = disnake.Embed(
            title="Cargos Criados",
            description=(
                f"`{len(criados)}` cargos foram criados com sucesso."
            ),
        )

        embed.add_field(
            name="Cargos",
            value=cargos or "Nenhum cargo criado.",
            inline=False,
        )

        primary_color = MensagensCargos._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        return embed, []


class CriarTodosCargos(commands.Cog):

    def __init__(self, bot):
        self.bot = bot

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────

    @staticmethod
    def _get_mode() -> str:
        data = db.get_document("custom_mode") or {}
        return data.get("mode", "components")

    @staticmethod
    def _get_role(
        guild: disnake.Guild,
        role_id,
    ) -> disnake.Role | None:

        if not role_id:
            return None

        try:
            role_id = int(role_id)
        except (TypeError, ValueError):
            return None

        return guild.get_role(role_id)

    @staticmethod
    def _buscar_cargo_por_nome(
        guild: disnake.Guild,
        nome: str,
    ) -> disnake.Role | None:

        nome_normalizado = nome.casefold()

        return next(
            (
                cargo
                for cargo in guild.roles
                if cargo.name.casefold() == nome_normalizado
            ),
            None,
        )

    @staticmethod
    def _cor_aleatoria() -> disnake.Colour:

        if not CARGOS_CORES:
            return disnake.Colour.default()

        return disnake.Colour(
            random.choice(CARGOS_CORES)
        )

    # ─────────────────────────────────────────────
    # LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def criar_todos_cargos(
        self,
        inter: disnake.MessageInteraction,
    ):

        if (
            inter.component.custom_id
            != "Configuracoes_CriarTodosCargos"
        ):
            return

        guild = inter.guild

        if guild is None:
            return

        mode = self._get_mode()

        # ─────────────────────────────────────
        # Loading
        # ─────────────────────────────────────

        if mode == "embed":
            await embed_message.wait(
                inter,
                send=False,
            )
        else:
            await message.wait(
                inter,
                send=False,
            )

        # ─────────────────────────────────────
        # Banco
        # ─────────────────────────────────────

        defs = db.get_document("cargos") or {}

        criados: list[disnake.Role] = []

        # ─────────────────────────────────────
        # Criar cargos
        # ─────────────────────────────────────

        for key, label, _ in CARGOS_OPCOES:

            # ─────────────────────────────────
            # Cargo salvo ainda existe?
            # ─────────────────────────────────

            cargo_existente = self._get_role(
                guild,
                defs.get(key),
            )

            if cargo_existente:
                continue

            # ─────────────────────────────────
            # Procura pelo nome
            # ─────────────────────────────────

            cargo_existente = self._buscar_cargo_por_nome(
                guild,
                label,
            )

            if cargo_existente:
                defs[key] = str(cargo_existente.id)
                continue

            # ─────────────────────────────────
            # Criação
            # ─────────────────────────────────

            try:
                cargo = await guild.create_role(
                    name=label,
                    color=self._cor_aleatoria(),
                    reason=(
                        "Auto-criação pelo painel de configurações "
                        f"por {inter.author} ({inter.author.id})"
                    ),
                )

            except disnake.Forbidden:
                continue

            except disnake.HTTPException:
                continue

            # ─────────────────────────────────
            # Salva
            # ─────────────────────────────────

            defs[key] = str(cargo.id)
            criados.append(cargo)

        # ─────────────────────────────────────
        # Atualiza banco
        # ─────────────────────────────────────

        db.save_document(
            "cargos",
            {},
            defs,
        )

        # ─────────────────────────────────────
        # Atualiza painel
        # ─────────────────────────────────────

        if mode == "embed":
            embed, components = (
                ConfigurarCargos.cargos_embed(inter)
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await inter.edit_original_message(
                components=(
                    ConfigurarCargos.cargos_components(inter)
                )
            )

        # ─────────────────────────────────────
        # Resultado
        # ─────────────────────────────────────

        if not criados:
            return

        if mode == "embed":
            embed, components = (
                MensagensCargos.cargos_criados_embed(
                    criados
                )
            )

            await inter.followup.send(
                embed=embed,
                components=components,
                ephemeral=True,
            )

        else:
            await inter.followup.send(
                components=(
                    MensagensCargos.cargos_criados_components(
                        criados
                    )
                ),
                flags=disnake.MessageFlags(
                    is_components_v2=True
                ),
                ephemeral=True,
            )