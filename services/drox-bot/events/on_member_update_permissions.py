import logging

import disnake
from disnake.ext import commands

from ._common import (
    obter_canal_id,
    enviar_log,
    buscar_executor_auditlog,
    verificar_guild,
)
from functions.emoji import emoji


logger = logging.getLogger(__name__)

AUDIT_MAX_AGE = 30
MAX_PERMISSIONS_LOG = 25


class OnMemberUpdatePermissions(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _roles_changed(
        before: disnake.Member,
        after: disnake.Member,
    ) -> bool:
        """
        Verifica se houve alteração nos cargos do membro.

        Permissões globais de membro são alteradas,
        normalmente, através dos cargos.
        """

        before_roles = {
            role.id
            for role in before.roles
        }

        after_roles = {
            role.id
            for role in after.roles
        }

        return before_roles != after_roles

    @staticmethod
    def _get_permissions(
        member: disnake.Member,
    ) -> dict[str, bool]:
        """
        Retorna as permissões globais efetivas do membro.
        """

        try:
            return {
                name: bool(value)
                for name, value
                in member.guild_permissions
            }

        except Exception:
            logger.exception(
                "Erro ao obter permissões do membro %s.",
                getattr(member, "id", "desconhecido"),
            )

            return {}

    @staticmethod
    def _format_executor(
        executor,
    ) -> str:
        if executor is None:
            return "`Não identificado`"

        mention = getattr(
            executor,
            "mention",
            str(executor),
        )

        executor_id = getattr(
            executor,
            "id",
            None,
        )

        if executor_id is None:
            return mention

        return (
            f"{mention} "
            f"(`{executor_id}`)"
        )

    @staticmethod
    def _format_permission_name(
        permission: str,
    ) -> str:
        """
        Formata o nome técnico da permissão
        para facilitar a leitura.
        """

        aliases = {
            "administrator": "Administrador",
            "manage_guild": "Gerenciar Servidor",
            "manage_roles": "Gerenciar Cargos",
            "manage_channels": "Gerenciar Canais",
            "manage_messages": "Gerenciar Mensagens",
            "manage_webhooks": "Gerenciar Webhooks",
            "manage_emojis": "Gerenciar Emojis",
            "manage_emojis_and_stickers": "Gerenciar Emojis e Stickers",
            "manage_events": "Gerenciar Eventos",
            "manage_threads": "Gerenciar Tópicos",
            "manage_nicknames": "Gerenciar Apelidos",
            "kick_members": "Expulsar Membros",
            "ban_members": "Banir Membros",
            "moderate_members": "Moderar Membros",
            "mention_everyone": "Mencionar @everyone",
            "view_audit_log": "Ver Registro de Auditoria",
            "view_guild_insights": "Ver Insights do Servidor",
            "view_channel": "Ver Canal",
            "send_messages": "Enviar Mensagens",
            "send_messages_in_threads": "Enviar Mensagens em Tópicos",
            "create_public_threads": "Criar Tópicos Públicos",
            "create_private_threads": "Criar Tópicos Privados",
            "embed_links": "Inserir Links",
            "attach_files": "Anexar Arquivos",
            "read_message_history": "Ver Histórico de Mensagens",
            "add_reactions": "Adicionar Reações",
            "use_external_emojis": "Usar Emojis Externos",
            "use_external_stickers": "Usar Stickers Externos",
            "connect": "Conectar em Call",
            "speak": "Falar em Call",
            "stream": "Transmitir em Call",
            "mute_members": "Mutar Membros",
            "deafen_members": "Ensurdecer Membros",
            "move_members": "Mover Membros",
            "use_voice_activation": "Usar Detecção de Voz",
            "priority_speaker": "Voz Prioritária",
            "request_to_speak": "Solicitar para Falar",
        }

        return aliases.get(
            permission,
            permission.replace(
                "_",
                " ",
            ).title(),
        )

    async def _find_executor(
        self,
        member: disnake.Member,
    ):
        """
        Procura quem alterou os cargos do membro,
        causando a mudança de permissões.
        """

        try:
            return await buscar_executor_auditlog(
                member.guild,
                [
                    disnake.AuditLogAction.member_role_update,
                ],
                lambda entry: (
                    getattr(
                        entry.target,
                        "id",
                        None,
                    )
                    == member.id
                ),
                max_age_seconds=AUDIT_MAX_AGE,
            )

        except disnake.Forbidden:
            return None

        except disnake.HTTPException:
            logger.debug(
                "Erro HTTP ao consultar Audit Log "
                "de alteração de permissões.",
                exc_info=True,
            )

            return None

        except Exception:
            logger.exception(
                "Erro ao localizar executor "
                "da alteração de permissões."
            )

            return None

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_member_update"
    )
    async def on_member_update(
        self,
        before: disnake.Member,
        after: disnake.Member,
    ):
        guild = after.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        # Permissões globais do membro mudam através
        # dos cargos. Ignora nickname, timeout etc.
        if not self._roles_changed(
            before,
            after,
        ):
            return

        canal_add = obter_canal_id(
            "canal_de_logs_de_permissoes_adicionadas"
        )

        canal_rem = obter_canal_id(
            "canal_de_logs_de_permissoes_removidas"
        )

        if not canal_add and not canal_rem:
            return

        # ═════════════════════════════════════════
        # PERMISSÕES
        # ═════════════════════════════════════════

        perms_before = self._get_permissions(
            before
        )

        perms_after = self._get_permissions(
            after
        )

        if not perms_before or not perms_after:
            return

        adicionadas = sorted(
            permission
            for permission, enabled
            in perms_after.items()
            if (
                enabled
                and not perms_before.get(
                    permission,
                    False,
                )
            )
        )

        removidas = sorted(
            permission
            for permission, enabled
            in perms_before.items()
            if (
                enabled
                and not perms_after.get(
                    permission,
                    False,
                )
            )
        )

        if not adicionadas and not removidas:
            return

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        executor = await self._find_executor(
            after
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        base_linhas = [
            (
                f"{emoji.member} "
                f"**Alvo:** "
                f"{after.mention} "
                f"(`{after.id}`)"
            ),

            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{executor_text}"
            ),
        ]

        # ═════════════════════════════════════════
        # PERMISSÕES ADICIONADAS
        # ═════════════════════════════════════════

        if adicionadas and canal_add:
            linhas = list(
                base_linhas
            )

            linhas.append(
                f"{emoji.plus} "
                f"**Permissões adicionadas:** "
                f"`{len(adicionadas)}`"
            )

            for permission in adicionadas[
                :MAX_PERMISSIONS_LOG
            ]:
                pretty_name = (
                    self._format_permission_name(
                        permission
                    )
                )

                linhas.append(
                    f"{emoji.arrow} "
                    f"**{pretty_name}** "
                    f"(`{permission}`)"
                )

            restante = (
                len(adicionadas)
                - MAX_PERMISSIONS_LOG
            )

            if restante > 0:
                linhas.append(
                    f"{emoji.arrow} "
                    f"... e mais "
                    f"`{restante}` "
                    f"permissão"
                    f"{'ões' if restante != 1 else ''}."
                )

            try:
                await enviar_log(
                    guild,
                    canal_add,
                    (
                        "Logs de Permissões - "
                        "Adicionadas"
                    ),
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de permissões "
                    "adicionadas no servidor %s.",
                    guild.id,
                )

        # ═════════════════════════════════════════
        # PERMISSÕES REMOVIDAS
        # ═════════════════════════════════════════

        if removidas and canal_rem:
            linhas = list(
                base_linhas
            )

            linhas.append(
                f"{emoji.minus} "
                f"**Permissões removidas:** "
                f"`{len(removidas)}`"
            )

            for permission in removidas[
                :MAX_PERMISSIONS_LOG
            ]:
                pretty_name = (
                    self._format_permission_name(
                        permission
                    )
                )

                linhas.append(
                    f"{emoji.arrow} "
                    f"**{pretty_name}** "
                    f"(`{permission}`)"
                )

            restante = (
                len(removidas)
                - MAX_PERMISSIONS_LOG
            )

            if restante > 0:
                linhas.append(
                    f"{emoji.arrow} "
                    f"... e mais "
                    f"`{restante}` "
                    f"permissão"
                    f"{'ões' if restante != 1 else ''}."
                )

            try:
                await enviar_log(
                    guild,
                    canal_rem,
                    (
                        "Logs de Permissões - "
                        "Removidas"
                    ),
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de permissões "
                    "removidas no servidor %s.",
                    guild.id,
                )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMemberUpdatePermissions(bot)
    )