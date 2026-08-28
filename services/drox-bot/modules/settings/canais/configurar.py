import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .criar_todos import MensagensCanais
from .listar import CANAIS_OPCOES


class ConfigurarCanal(commands.Cog):
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
    def _get_canal_info(canal_key: str):
        return next(
            (
                canal
                for canal in CANAIS_OPCOES
                if canal[0] == canal_key
            ),
            None,
        )

    @staticmethod
    def _get_canal_obj(
        inter: disnake.MessageInteraction,
        canal_key: str,
    ) -> disnake.TextChannel | None:

        if not inter.guild:
            return None

        definicoes = db.get_document("canais") or {}
        canal_id = definicoes.get(canal_key)

        if not canal_id:
            return None

        try:
            canal_id = int(canal_id)
        except (TypeError, ValueError):
            return None

        canal = inter.guild.get_channel(canal_id)

        if isinstance(canal, disnake.TextChannel):
            return canal

        return None

    @staticmethod
    def _get_categoria_logs(
        guild: disnake.Guild,
    ) -> disnake.CategoryChannel | None:

        return next(
            (
                categoria
                for categoria in guild.categories
                if categoria.name.strip().casefold() in {
                    "logs",
                    "📁・logs",
                }
            ),
            None,
        )

    @staticmethod
    def _deve_ir_para_logs(canal_key: str) -> bool:
        extras = {
            "canal_de_evento_de_compras",
            "canal_de_boas_vindas",
            "canal_de_feedback",
            "canal_de_logs_de_pedidos",
        }

        return (
            "logs" in canal_key
            or canal_key in extras
        )

    # ─────────────────────────────────────────────
    # COMPONENTS
    # ─────────────────────────────────────────────

    @staticmethod
    def canal_components(
        inter: disnake.MessageInteraction,
        canal_key: str,
    ) -> list:

        canal_info = ConfigurarCanal._get_canal_info(canal_key)

        if not canal_info:
            return []

        _, canal_nome, _ = canal_info

        canal_obj = ConfigurarCanal._get_canal_obj(
            inter,
            canal_key,
        )

        canal_atual = (
            f"{canal_obj.mention} (`{canal_obj.id}`)"
            if canal_obj
            else "`Não definido`"
        )

        container_kwargs = {}

        primary_color = ConfigurarCanal._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(
                primary_color
            )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    f"-# Painel › Configurações › Canais › {canal_nome}"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Gerencie o canal utilizado pelo sistema.\n"
                    "Você pode selecionar um canal existente, "
                    "remover a configuração ou criar um automaticamente."
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    f"### Canal selecionado\n"
                    f"**Tipo:** {canal_nome}\n"
                    f"**Canal atual:** {canal_atual}"
                ),

                disnake.ui.ActionRow(
                    disnake.ui.ChannelSelect(
                        channel_types=[
                            disnake.ChannelType.text
                        ],
                        placeholder="Selecione um canal",
                        custom_id=(
                            f"Configuracoes_EditarNovoCanal:"
                            f"{canal_key}"
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
                            f"Configuracoes_ApagarCanal:"
                            f"{canal_key}"
                        ),
                        style=disnake.ButtonStyle.red,
                        disabled=canal_obj is None,
                    ),

                    disnake.ui.Button(
                        label="Criar canal",
                        emoji=emoji.wand,
                        custom_id=(
                            f"Configuracoes_CriarCanal:"
                            f"{canal_key}"
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
                    custom_id="Configuracoes_EditarCanais",
                )
            ),
        ]

    # ─────────────────────────────────────────────
    # EMBED
    # ─────────────────────────────────────────────

    @staticmethod
    def canal_embed(
        inter: disnake.MessageInteraction,
        canal_key: str,
    ):

        canal_info = ConfigurarCanal._get_canal_info(canal_key)

        if not canal_info:
            return disnake.Embed(
                title="Canal não encontrado"
            ), []

        _, canal_nome, _ = canal_info

        canal_obj = ConfigurarCanal._get_canal_obj(
            inter,
            canal_key,
        )

        canal_atual = (
            f"{canal_obj.mention} (`{canal_obj.id}`)"
            if canal_obj
            else "`Não definido`"
        )

        embed = disnake.Embed(
            title=canal_nome,
            description=(
                "Gerencie o canal utilizado pelo sistema.\n"
                "Selecione um canal existente ou crie um automaticamente."
            ),
        )

        primary_color = ConfigurarCanal._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        embed.add_field(
            name="Canal configurado",
            value=canal_atual,
            inline=False,
        )

        components = [
            disnake.ui.ActionRow(
                disnake.ui.ChannelSelect(
                    channel_types=[
                        disnake.ChannelType.text
                    ],
                    placeholder="Selecione um canal",
                    custom_id=(
                        f"Configuracoes_EditarNovoCanal:"
                        f"{canal_key}"
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
                        f"Configuracoes_ApagarCanal:"
                        f"{canal_key}"
                    ),
                    style=disnake.ButtonStyle.red,
                    disabled=canal_obj is None,
                ),

                disnake.ui.Button(
                    label="Criar canal",
                    emoji=emoji.wand,
                    custom_id=(
                        f"Configuracoes_CriarCanal:"
                        f"{canal_key}"
                    ),
                    style=disnake.ButtonStyle.blurple,
                ),
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    emoji=emoji.back,
                    custom_id="Configuracoes_EditarCanais",
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
        canal_key: str,
    ) -> None:

        mode = self._get_mode()

        if mode == "embed":
            embed, components = self.canal_embed(
                inter,
                canal_key,
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await inter.edit_original_message(
                components=self.canal_components(
                    inter,
                    canal_key,
                )
            )

    # ─────────────────────────────────────────────
    # BUTTON LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def configurar_canais_button_listener(
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
            "Configuracoes_ApagarCanal:"
        ):
            canal_key = custom_id.split(":", 1)[1]

            canais_db = db.get_document("canais") or {}
            canais_db[canal_key] = None

            db.save_document(
                "canais",
                {},
                canais_db,
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
                canal_key,
            )

            return

        # ─────────────────────────────────────
        # CRIAR CANAL
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_CriarCanal:"
        ):
            canal_key = custom_id.split(":", 1)[1]

            canal_info = self._get_canal_info(canal_key)

            if not canal_info:
                return

            _, canal_nome, _ = canal_info

            if not inter.guild:
                return

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

            # Verifica se já existe um canal configurado
            canal_existente = self._get_canal_obj(
                inter,
                canal_key,
            )

            if canal_existente:
                await self._atualizar_painel(
                    inter,
                    canal_key,
                )
                return

            # Procura canal com mesmo nome
            canal_existente = next(
                (
                    canal
                    for canal in inter.guild.text_channels
                    if canal.name.casefold()
                    == canal_nome.casefold()
                ),
                None,
            )

            if canal_existente:
                canais_db = db.get_document("canais") or {}
                canais_db[canal_key] = str(
                    canal_existente.id
                )

                db.save_document(
                    "canais",
                    {},
                    canais_db,
                )

                await self._atualizar_painel(
                    inter,
                    canal_key,
                )

                return

            categoria = None

            if self._deve_ir_para_logs(canal_key):
                categoria = self._get_categoria_logs(
                    inter.guild
                )

            try:
                ch = await inter.guild.create_text_channel(
                    name=canal_nome,
                    category=categoria,
                    reason=(
                        "Auto-criação pelo painel de configurações "
                        f"por {inter.user} ({inter.user.id})"
                    ),
                )

            except disnake.Forbidden:
                await self._atualizar_painel(
                    inter,
                    canal_key,
                )
                return

            except disnake.HTTPException:
                await self._atualizar_painel(
                    inter,
                    canal_key,
                )
                return

            canais_db = db.get_document("canais") or {}
            canais_db[canal_key] = str(ch.id)

            db.save_document(
                "canais",
                {},
                canais_db,
            )

            await self._atualizar_painel(
                inter,
                canal_key,
            )

            # ─────────────────────────────────
            # AVISO
            # ─────────────────────────────────

            if mode == "embed":
                embed, components = (
                    MensagensCanais.canal_criado_embed(
                        ch,
                        auto=False,
                    )
                )

                await inter.followup.send(
                    embed=embed,
                    components=components,
                    ephemeral=True,
                )

            else:
                await ch.send(
                    components=(
                        MensagensCanais.canal_criado_components(
                            ch,
                            auto=False,
                        )
                    ),
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )

    # ─────────────────────────────────────────────
    # DROPDOWN LISTENER
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_dropdown")
    async def configurar_canais_dropdown_listener(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if not custom_id:
            return

        mode = self._get_mode()

        # ─────────────────────────────────────
        # ABRIR CONFIGURAÇÃO DO CANAL
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_EditarCanal"
        ):
            if not inter.values:
                return

            canal_key = inter.values[0]

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
                canal_key,
            )

            return

        # ─────────────────────────────────────
        # DEFINIR NOVO CANAL
        # ─────────────────────────────────────

        if custom_id.startswith(
            "Configuracoes_EditarNovoCanal:"
        ):
            if not inter.values:
                return

            canal_key = custom_id.split(":", 1)[1]
            canal_id = inter.values[0]

            canais_db = db.get_document("canais") or {}
            canais_db[canal_key] = str(canal_id)

            db.save_document(
                "canais",
                {},
                canais_db,
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
                canal_key,
            )