"""
Mensagens pré-definidas para o bot.

Classes:
- message:
    Utiliza Components V2.

- embed_message:
    Utiliza mensagens tradicionais / embeds.
"""

from typing import Optional, Union

import disnake

from functions.emoji import emoji


# ═════════════════════════════════════════════════════════════
# TIPOS
# ═════════════════════════════════════════════════════════════

InteractionType = Union[
    disnake.MessageInteraction,
    disnake.ApplicationCommandInteraction,
    disnake.ModalInteraction,
]

ComponentType = Optional[
    Union[
        disnake.ui.Item,
        list,
        tuple,
    ]
]


# ═════════════════════════════════════════════════════════════
# CONSTANTES
# ═════════════════════════════════════════════════════════════

LOADING_MESSAGE = (
    "Carregando informações..."
)

MISSING_PERMS_MESSAGE = (
    "Você não tem permissão para usar este comando"
)


# ═════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════


def _normalize_components(
    component,
) -> list:
    """
    Normaliza componentes extras para uma lista.

    Mantém o comportamento atual:
    - None -> []
    - list/tuple -> seus itens
    - componente único -> [componente]
    """

    if component is None:
        return []

    if isinstance(
        component,
        (list, tuple),
    ):
        return list(
            component
        )

    return [
        component
    ]


def _create_v2_container(
    text: str,
) -> disnake.ui.Container:
    """
    Cria o Container padrão utilizado
    pelas mensagens Components V2.
    """

    return disnake.ui.Container(
        disnake.ui.TextDisplay(
            text
        )
    )


# ═════════════════════════════════════════════════════════════
# COMPONENTS V2
# ═════════════════════════════════════════════════════════════


class message:
    # ═════════════════════════════════════════════
    # WAIT
    # ═════════════════════════════════════════════

    @staticmethod
    async def wait(
        inter: InteractionType,
        send: bool = False,
        ephemeral: bool = True,
        followup: bool = False,
    ) -> disnake.Message:
        """
        Mostra mensagem de carregamento
        utilizando Components V2.
        """

        components = (
            disnake.ui.TextDisplay(
                f"{emoji.loading} "
                f"{LOADING_MESSAGE}"
            )
        )

        if send:
            return (
                await inter.response.send_message(
                    components=components,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                    ephemeral=ephemeral,
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    components=components,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                    ephemeral=ephemeral,
                )
            )

        if not inter.response.is_done():
            await inter.response.defer(
                with_message=False
            )

        return (
            await inter.edit_original_message(
                embed=None,
                components=components,
            )
        )

    # ═════════════════════════════════════════════
    # MISSING PERMS
    # ═════════════════════════════════════════════

    @staticmethod
    async def missing_perms(
        inter: InteractionType,
    ) -> disnake.Message:
        """
        Informa que o usuário não possui
        permissão para executar a ação.
        """

        components = [
            _create_v2_container(
                f"{emoji.wrong} "
                f"{MISSING_PERMS_MESSAGE}"
            )
        ]

        return (
            await inter.response.send_message(
                components=components,
                ephemeral=True,
                flags=disnake.MessageFlags(
                    is_components_v2=True
                ),
            )
        )

    # ═════════════════════════════════════════════
    # ERROR
    # ═════════════════════════════════════════════

    @staticmethod
    async def error(
        inter: InteractionType,
        message: str,
        send: bool = False,
        followup: bool = False,
        component=None,
    ) -> disnake.Message:
        """
        Envia mensagem de erro
        utilizando Components V2.
        """

        components = [
            _create_v2_container(
                f"{emoji.wrong} "
                f"{message}"
            )
        ]

        components.extend(
            _normalize_components(
                component
            )
        )

        if send:
            return (
                await inter.response.send_message(
                    components=components,
                    ephemeral=True,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    components=components,
                    ephemeral=True,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )
            )

        return (
            await inter.edit_original_message(
                embed=None,
                components=components,
            )
        )

    # ═════════════════════════════════════════════
    # SUCCESS
    # ═════════════════════════════════════════════

    @staticmethod
    async def success(
        inter: InteractionType,
        message: str,
        send: bool = False,
        followup: bool = False,
        component=None,
    ) -> disnake.Message:
        """
        Envia mensagem de sucesso
        utilizando Components V2.
        """

        components = [
            _create_v2_container(
                f"{emoji.correct} "
                f"{message}"
            )
        ]

        components.extend(
            _normalize_components(
                component
            )
        )

        if send:
            return (
                await inter.response.send_message(
                    components=components,
                    ephemeral=True,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    components=components,
                    ephemeral=True,
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                )
            )

        return (
            await inter.edit_original_message(
                embed=None,
                components=components,
            )
        )


# ═════════════════════════════════════════════════════════════
# EMBED / MENSAGEM TRADICIONAL
# ═════════════════════════════════════════════════════════════


class embed_message:
    # ═════════════════════════════════════════════
    # WAIT
    # ═════════════════════════════════════════════

    @staticmethod
    async def wait(
        inter: InteractionType,
        send: bool = False,
        ephemeral: bool = True,
        followup: bool = False,
    ) -> disnake.Message:
        """
        Mostra mensagem de carregamento
        utilizando mensagem tradicional.
        """

        content = (
            f"{emoji.loading} "
            f"{LOADING_MESSAGE}"
        )

        if send:
            return (
                await inter.response.send_message(
                    content=content,
                    ephemeral=ephemeral,
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    content=content,
                    ephemeral=ephemeral,
                )
            )

        if not inter.response.is_done():
            await inter.response.defer(
                with_message=False
            )

        # Mantém o comportamento original:
        # ao editar, usa Embed para evitar
        # conflito com Components V2.
        embed = disnake.Embed(
            description=content
        )

        return (
            await inter.edit_original_message(
                embed=embed,
                components=[],
            )
        )

    # ═════════════════════════════════════════════
    # MISSING PERMS
    # ═════════════════════════════════════════════

    @staticmethod
    async def missing_perms(
        inter: InteractionType,
    ) -> disnake.Message:
        """
        Informa que o usuário não possui
        permissão para executar a ação.
        """

        content = (
            f"{emoji.wrong} "
            f"{MISSING_PERMS_MESSAGE}"
        )

        return (
            await inter.response.send_message(
                content=content,
                ephemeral=True,
            )
        )

    # ═════════════════════════════════════════════
    # ERROR
    # ═════════════════════════════════════════════

    @staticmethod
    async def error(
        inter: InteractionType,
        message: str,
        send: bool = False,
        followup: bool = False,
        component=None,
    ) -> disnake.Message:
        """
        Envia uma mensagem de erro.
        """

        content = (
            f"{emoji.wrong} "
            f"{message}"
        )

        if send:
            return (
                await inter.response.send_message(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        # Mantém o comportamento original:
        # não usa content na edição.
        embed = disnake.Embed(
            description=content
        )

        return (
            await inter.edit_original_message(
                embed=embed,
                components=component,
            )
        )

    # ═════════════════════════════════════════════
    # SUCCESS
    # ═════════════════════════════════════════════

    @staticmethod
    async def success(
        inter: InteractionType,
        message: str,
        send: bool = False,
        followup: bool = False,
        component=None,
    ) -> disnake.Message:
        """
        Envia uma mensagem de sucesso.
        """

        content = (
            f"{emoji.correct} "
            f"{message}"
        )

        if send:
            return (
                await inter.response.send_message(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        embed = disnake.Embed(
            description=content
        )

        return (
            await inter.edit_original_message(
                embed=embed,
                components=component,
            )
        )

    # ═════════════════════════════════════════════
    # PLAIN
    # ═════════════════════════════════════════════

    @staticmethod
    async def plain(
        inter: InteractionType,
        content: str,
        send: bool = False,
        followup: bool = False,
        component=None,
    ) -> disnake.Message:
        """
        Envia uma mensagem sem ícone
        de erro ou sucesso.
        """

        if send:
            return (
                await inter.response.send_message(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        if followup:
            return (
                await inter.followup.send(
                    content=content,
                    ephemeral=True,
                    components=component,
                )
            )

        # Mantém o comportamento original:
        # durante edição usa Embed.
        embed = disnake.Embed(
            description=content
        )

        return (
            await inter.edit_original_message(
                embed=embed,
                components=component,
            )
        )