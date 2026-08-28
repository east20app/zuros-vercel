import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from .listar import CANAIS_OPCOES
from .cog import ConfigurarCanais


# ─────────────────────────────────────────────
# CONFIGURAÇÕES
# ─────────────────────────────────────────────

CATEGORIA_LOGS = "📁・logs"

CANAIS_NA_CATEGORIA_LOGS = {
    "canal_de_evento_de_compras",
    "canal_de_boas_vindas",
    "canal_de_feedback",
    "canal_de_logs_de_pedidos",
}


# ─────────────────────────────────────────────
# MENSAGENS
# ─────────────────────────────────────────────

class MensagensCanais:

    @staticmethod
    def canal_criado_components(
        ch: disnake.TextChannel,
        auto: bool
    ) -> disnake.ui.Container:

        origem = (
            "Criar Todos os Canais Automaticamente"
            if auto
            else "Criar Canal"
        )

        return disnake.ui.Container(
            disnake.ui.TextDisplay(
                f"# {emoji.zuros}\n"
                f"-# {origem} › Canal Criado"
            ),
            disnake.ui.Separator(),
            disnake.ui.TextDisplay(
                "### Informações do canal\n"
                f"**Nome:** {ch.mention}\n"
                f"**ID:** `{ch.id}`\n"
                f"**Categoria:** `{ch.category.name if ch.category else 'Nenhuma'}`"
            ),
        )

    @staticmethod
    def canais_criados_components(
        criados: list[disnake.TextChannel]
    ) -> list[disnake.ui.Container]:

        canais = "\n".join(
            f"> {canal.mention} `({canal.id})`"
            for canal in criados
        )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "## Canais Criados\n"
                    f"-# `{len(criados)}` canais foram criados com sucesso."
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(canais),
            )
        ]

    @staticmethod
    def canal_criado_embed(
        ch: disnake.TextChannel,
        auto: bool
    ) -> tuple[disnake.Embed, list]:

        embed = disnake.Embed(
            title="Canal Criado",
            description=(
                f"**Nome:** {ch.mention}\n"
                f"**ID:** `{ch.id}`\n"
                f"**Categoria:** "
                f"`{ch.category.name if ch.category else 'Nenhuma'}`"
            ),
        )

        MensagensCanais._aplicar_cor(embed)

        return embed, []

    @staticmethod
    def canais_criados_embed(
        criados: list[disnake.TextChannel]
    ) -> tuple[disnake.Embed, list]:

        canais = "\n".join(
            f"• {canal.mention} `({canal.id})`"
            for canal in criados
        )

        embed = disnake.Embed(
            title="Canais Criados",
            description=(
                f"`{len(criados)}` canais foram criados com sucesso."
            ),
        )

        embed.add_field(
            name="Canais",
            value=canais or "Nenhum canal criado.",
            inline=False,
        )

        MensagensCanais._aplicar_cor(embed)

        return embed, []

    @staticmethod
    def _aplicar_cor(embed: disnake.Embed) -> None:
        colors = db.get_document("custom_colors") or {}
        primary = colors.get("primary")

        if not primary:
            return

        try:
            embed.color = int(
                str(primary).replace("#", ""),
                16
            )
        except (TypeError, ValueError):
            pass


# ─────────────────────────────────────────────
# COG
# ─────────────────────────────────────────────

class CriarTodosCanais(commands.Cog):

    def __init__(self, bot):
        self.bot = bot

    # ─────────────────────────────────────────

    @staticmethod
    def _canal_deve_ir_para_logs(key: str) -> bool:
        return (
            "logs" in key
            or key in CANAIS_NA_CATEGORIA_LOGS
        )

    # ─────────────────────────────────────────

    @staticmethod
    def _buscar_canal_por_nome(
        guild: disnake.Guild,
        nome: str
    ) -> disnake.TextChannel | None:

        nome_normalizado = nome.casefold()

        return next(
            (
                canal
                for canal in guild.text_channels
                if canal.name.casefold() == nome_normalizado
            ),
            None,
        )

    # ─────────────────────────────────────────

    @staticmethod
    async def _buscar_ou_criar_categoria_logs(
        guild: disnake.Guild,
        inter: disnake.MessageInteraction,
    ) -> disnake.CategoryChannel | None:

        # Procura tanto pelo nome novo quanto pelo antigo.
        nomes_validos = {
            "logs",
            CATEGORIA_LOGS.casefold(),
        }

        categoria = next(
            (
                categoria
                for categoria in guild.categories
                if categoria.name.strip().casefold() in nomes_validos
            ),
            None,
        )

        if categoria:
            return categoria

        try:
            return await guild.create_category(
                CATEGORIA_LOGS,
                reason=(
                    "Auto-criação da categoria de logs "
                    f"por {inter.author} ({inter.author.id})"
                ),
            )

        except disnake.Forbidden:
            return None

        except disnake.HTTPException:
            return None

    # ─────────────────────────────────────────

    async def _enviar_mensagem_canal_criado(
        self,
        canal: disnake.TextChannel,
        mode: str,
    ) -> None:

        try:
            if mode == "embed":
                embed, components = (
                    MensagensCanais.canal_criado_embed(
                        canal,
                        auto=True,
                    )
                )

                await canal.send(
                    embed=embed,
                    components=components,
                )

                return

            await canal.send(
                components=(
                    MensagensCanais.canal_criado_components(
                        canal,
                        auto=True,
                    )
                ),
                flags=disnake.MessageFlags(
                    is_components_v2=True
                ),
            )

        except (disnake.Forbidden, disnake.HTTPException):
            pass

    # ─────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def criar_todos_canais(
        self,
        inter: disnake.MessageInteraction,
    ):

        if inter.component.custom_id != "Configuracoes_CriarTodosCanais":
            return

        guild = inter.guild

        if guild is None:
            return

        # ─────────────────────────────────────
        # Modo de mensagem
        # ─────────────────────────────────────

        mode_data = db.get_document("custom_mode") or {}
        mode = mode_data.get("mode", "components")

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

        defs = db.get_document("canais") or {}

        # ─────────────────────────────────────
        # Categoria
        # ─────────────────────────────────────

        categoria_logs = (
            await self._buscar_ou_criar_categoria_logs(
                guild,
                inter,
            )
        )

        # ─────────────────────────────────────
        # Permissões
        # ─────────────────────────────────────

        overwrites = {
            guild.default_role:
                disnake.PermissionOverwrite(
                    view_channel=False
                )
        }

        criados: list[disnake.TextChannel] = []

        # ─────────────────────────────────────
        # Criar canais
        # ─────────────────────────────────────

        for key, label, _ in CANAIS_OPCOES:

            # Usa DIRETAMENTE o nome definido
            # em CANAIS_OPCOES:
            #
            # 📥・entradas
            # 📤・saídas
            # 🔨・banimentos
            #
            nome_canal = label.strip()

            # ─────────────────────────────────
            # Canal salvo no banco ainda existe?
            # ─────────────────────────────────

            canal_salvo = defs.get(key)

            if canal_salvo:
                try:
                    canal_existente = guild.get_channel(
                        int(canal_salvo)
                    )

                    if isinstance(
                        canal_existente,
                        disnake.TextChannel,
                    ):
                        continue

                except (TypeError, ValueError):
                    pass

            # ─────────────────────────────────
            # Procura pelo nome
            # ─────────────────────────────────

            existente = self._buscar_canal_por_nome(
                guild,
                nome_canal,
            )

            if existente:
                defs[key] = str(existente.id)
                continue

            # ─────────────────────────────────
            # Define categoria
            # ─────────────────────────────────

            categoria = None

            if (
                categoria_logs
                and self._canal_deve_ir_para_logs(key)
            ):
                categoria = categoria_logs

            # ─────────────────────────────────
            # Criação
            # ─────────────────────────────────

            try:
                canal = await guild.create_text_channel(
                    name=nome_canal,
                    category=categoria,
                    overwrites=overwrites,
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

            defs[key] = str(canal.id)
            criados.append(canal)

            # ─────────────────────────────────
            # Mensagem dentro do canal
            # ─────────────────────────────────

            await self._enviar_mensagem_canal_criado(
                canal,
                mode,
            )

        # ─────────────────────────────────────
        # Atualiza banco
        # ─────────────────────────────────────

        db.save_document(
            "canais",
            {},
            defs,
        )

        # ─────────────────────────────────────
        # Atualiza painel
        # ─────────────────────────────────────

        if mode == "embed":
            embed, components = (
                ConfigurarCanais.canais_embed(inter)
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await inter.edit_original_message(
                components=(
                    ConfigurarCanais.canais_components(inter)
                )
            )

        # ─────────────────────────────────────
        # Resumo
        # ─────────────────────────────────────

        if not criados:
            return

        if mode == "embed":
            embed, components = (
                MensagensCanais.canais_criados_embed(
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
                    MensagensCanais.canais_criados_components(
                        criados
                    )
                ),
                flags=disnake.MessageFlags(
                    is_components_v2=True
                ),
                ephemeral=True,
            )