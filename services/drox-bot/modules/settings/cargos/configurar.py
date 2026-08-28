import random

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .criar_todos import MensagensCargos
from .listar import CARGOS_OPCOES, CARGOS_CORES


class ConfigurarCargo(commands.Cog):
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
    def _get_cargo_info(cargo_key: str):
        return next(
            (
                cargo
                for cargo in CARGOS_OPCOES
                if cargo[0] == cargo_key
            ),
            None,
        )

    @staticmethod
    def _get_cargo_obj(
        inter: disnake.MessageInteraction,
        cargo_key: str,
    ) -> disnake.Role | None:

        if not inter.guild:
            return None

        definicoes = db.get_document("cargos") or {}
        cargo_id = definicoes.get(cargo_key)

        if not cargo_id:
            return None

        try:
            cargo_id = int(cargo_id)
        except (TypeError, ValueError):
            return None

        return inter.guild.get_role(cargo_id)

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

    @staticmethod
    def _salvar_cargo(
        cargo_key: str,
        cargo_id: int | str | None,
    ) -> None:

        cargos_db = db.get_document("cargos") or {}

        cargos_db[cargo_key] = (
            str(cargo_id)
            if cargo_id is not None
            else None
        )

        db.save_document(
            "cargos",
            {},
            cargos_db,
        )

    # ─────────────────────────────────────────────
    # COMPONENTS
    # ─────────────────────────────────────────────

    @staticmethod
    def cargo_components(
        inter: disnake.MessageInteraction,
        cargo_key: str,
    ) -> list:

        cargo_info = ConfigurarCargo._get_cargo_info(
            cargo_key
        )

        if not cargo_info:
            return []

        _, cargo_nome, _ = cargo_info

        cargo_obj = ConfigurarCargo._get_cargo_obj(
            inter,
            cargo_key,
        )

        cargo_atual = (
            f"{cargo_obj.mention} (`{cargo_obj.id}`)"
            if cargo_obj
            else "`Não definido`"
        )

        container_kwargs = {}

        primary_color = ConfigurarCargo._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(
                primary_color
            )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    f"-# Painel › Configurações › Cargos › {cargo_nome}"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Gerencie o cargo utilizado pelo sistema.\n"
                    "Você pode selecionar um cargo existente, "
                    "remover a configuração ou criar um automaticamente."
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    f"### Cargo selecionado\n"
                    f"**Tipo:** {cargo_nome}\n"
                    f"**Cargo atual:** {cargo_atual}"
                ),

                disnake.ui.ActionRow(
                    disnake.ui.RoleSelect(
                        placeholder="Selecione um cargo",
                        custom_id=(
                            f"Configuracoes_EditarNovoCargo:"
                            f"{cargo_key}"
                        ),
                        min_values=1,
                        max_values=1,
                    )
                ),

                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Apagar",
                        emoji=emoji.delete,
                        custom_id=(
                            f"Configuracoes_ApagarCargo:"
                            f"{cargo_key}"
                        ),
                        style=disnake.ButtonStyle.red,
                        disabled=cargo_obj is None,
                    ),

                    disnake.ui.Button(
                        label="Criar cargo",
                        emoji=emoji.wand,
                        custom_id=(
                            f"Configuracoes_CriarCargo:"
                            f"{cargo_key}"
                        ),
                        style=disnake.ButtonStyle.blurple,
                    ),
                ),

                **container_kwargs,
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    emoji=emoji.back,
                    custom_id="Configuracoes_EditarCargos",
                )
            ),
        ]

    # ─────────────────────────────────────────────
    # EMBED
    # ─────────────────────────────────────────────

    @staticmethod
    def cargo_embed(
        inter: disnake.MessageInteraction,
        cargo_key: str,
    ):

        cargo_info = ConfigurarCargo._get_cargo_info(
            cargo_key
        )

        if not cargo_info:
            return disnake.Embed(
                title="Cargo não encontrado"
            ), []

        _, cargo_nome, _ = cargo_info

        cargo_obj = ConfigurarCargo._get_cargo_obj(
            inter,
            cargo_key,
        )

        cargo_atual = (
            f"{cargo_obj.mention} (`{cargo_obj.id}`)"
            if cargo_obj
            else "`Não definido`"
        )

        embed = disnake.Embed(
            title=cargo_nome,
            description=(
                "Gerencie o cargo utilizado pelo sistema.\n"
                "Selecione um cargo existente ou crie um automaticamente."
            ),
        )

        primary_color = ConfigurarCargo._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        embed.add_field(
            name="Cargo configurado",
            value=cargo_atual,
            inline=False,
        )

        components = [
            disnake.ui.ActionRow(
                disnake.ui.RoleSelect(
                    placeholder="Selecione um cargo",
                    custom_id=(
                        f"Configuracoes_EditarNovoCargo:"
                        f"{cargo_key}"
                    ),
                    min_values=1,
                    max_values=1,
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Apagar",
                    emoji=emoji.delete,
                    custom_id=(
                        f"Configuracoes_ApagarCargo:"
                        f"{cargo_key}"
                    ),
                    style=disnake.ButtonStyle.red,
                    disabled=cargo_obj is None,
                ),

                disnake.ui.Button(
                    label="Criar cargo",
                    emoji=emoji.wand,
                    custom_id=(
                        f"Configuracoes_CriarCargo:"
                        f"{cargo_key}"
                    ),
                    style=disnake.ButtonStyle.blurple,
                ),
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    emoji=emoji.back,
                    custom_id="Configuracoes_EditarCargos",
                )
            ),
        ]

        return embed, components

    # ─────────────────────────────────────────────
    # ATUALIZAR PAINEL
    # ─────────────────────────────────────────────

    async def _atualizar_painel(
        self,
        inter: disnake.MessageInteraction,
        cargo_key: str,
    ) -> None:

        mode = self._get_mode()

        if mode == "embed":
            embed, components = self.cargo_embed(
                inter,
                cargo_key,
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

            return

        await inter.edit_original_message(
            components=self.cargo_components(
                inter,
                cargo_key,
            )
        )

    # ─────────────────────────────────────────────
    # BUTTON LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def configurar_cargos_button_listener(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if not custom_id:
            return

        mode = self._get_mode()

        # ─────────────────────────────────────
        # APAGAR CONFIGURAÇÃO
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_ApagarCargo:"
        ):
            cargo_key = custom_id.split(":", 1)[1]

            self._salvar_cargo(
                cargo_key,
                None,
            )

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

            await self._atualizar_painel(
                inter,
                cargo_key,
            )

            return

        # ─────────────────────────────────────
        # CRIAR CARGO
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_CriarCargo:"
        ):
            cargo_key = custom_id.split(":", 1)[1]

            cargo_info = self._get_cargo_info(
                cargo_key
            )

            if not cargo_info:
                return

            if not inter.guild:
                return

            _, cargo_nome, _ = cargo_info

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

            # Já existe um cargo configurado?
            cargo_existente = self._get_cargo_obj(
                inter,
                cargo_key,
            )

            if cargo_existente:
                await self._atualizar_painel(
                    inter,
                    cargo_key,
                )
                return

            # Procura um cargo com o mesmo nome
            cargo_existente = self._buscar_cargo_por_nome(
                inter.guild,
                cargo_nome,
            )

            if cargo_existente:
                self._salvar_cargo(
                    cargo_key,
                    cargo_existente.id,
                )

                await self._atualizar_painel(
                    inter,
                    cargo_key,
                )

                return

            # Criação do cargo
            try:
                cargo = await inter.guild.create_role(
                    name=cargo_nome,
                    color=self._cor_aleatoria(),
                    reason=(
                        "Auto-criação pelo painel de configurações "
                        f"por {inter.user} ({inter.user.id})"
                    ),
                )

            except disnake.Forbidden:
                await self._atualizar_painel(
                    inter,
                    cargo_key,
                )
                return

            except disnake.HTTPException:
                await self._atualizar_painel(
                    inter,
                    cargo_key,
                )
                return

            # Salva no banco
            self._salvar_cargo(
                cargo_key,
                cargo.id,
            )

            # Atualiza painel
            await self._atualizar_painel(
                inter,
                cargo_key,
            )

            # Resultado
            if mode == "embed":
                embed, components = (
                    MensagensCargos.cargo_criado_embed(
                        cargo,
                        auto=False,
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
                        MensagensCargos.cargo_criado_components(
                            cargo,
                            auto=False,
                        )
                    ),
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                    ephemeral=True,
                )

    # ─────────────────────────────────────────────
    # DROPDOWN LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_dropdown")
    async def configurar_cargos_dropdown_listener(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if not custom_id:
            return

        mode = self._get_mode()

        # ─────────────────────────────────────
        # ABRIR CONFIGURAÇÃO
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_EditarCargo"
        ):
            if not inter.values:
                return

            cargo_key = inter.values[0]

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

            await self._atualizar_painel(
                inter,
                cargo_key,
            )

            return

        # ─────────────────────────────────────
        # DEFINIR CARGO EXISTENTE
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_EditarNovoCargo:"
        ):
            if not inter.values:
                return

            cargo_key = custom_id.split(":", 1)[1]
            cargo_id = inter.values[0]

            self._salvar_cargo(
                cargo_key,
                cargo_id,
            )

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

            await self._atualizar_painel(
                inter,
                cargo_key,
            )