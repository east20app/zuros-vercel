import json
from functools import wraps
from typing import Optional, Union

import disnake
from disnake.ext import commands


# ═════════════════════════════════════════════════════════════
# CONSTANTES
# ═════════════════════════════════════════════════════════════

CONFIG_PATH = "config.json"

SLASH_ACCESS_DENIED_MESSAGE = (
    "Acesso Negado: Este comando só pode ser usado "
    "no servidor principal."
)

INTERACTION_ACCESS_DENIED_MESSAGE = (
    "Acesso Negado: Esta ação só pode ser realizada "
    "no servidor principal."
)


# ═════════════════════════════════════════════════════════════
# SERVIDOR PRINCIPAL
# ═════════════════════════════════════════════════════════════


def get_main_server_id() -> Optional[int]:
    """
    Obtém o ID do servidor principal
    definido em config.json.
    """

    try:
        with open(
            CONFIG_PATH,
            "r",
            encoding="utf-8",
        ) as file:
            config = json.load(
                file
            )

        server_id = (
            config
            .get("bot", {})
            .get("server")
        )

        if server_id:
            return int(
                server_id
            )

    except Exception as error:
        print(
            f"Erro ao ler config.json: {error}"
        )

    return None


def is_main_server(
    guild_id: Union[int, str],
) -> bool:
    """
    Verifica se o guild_id informado
    pertence ao servidor principal.
    """

    main_server_id = (
        get_main_server_id()
    )

    if main_server_id is None:
        return False

    try:
        return (
            int(guild_id)
            == main_server_id
        )

    except (
        TypeError,
        ValueError,
    ):
        return False


# ═════════════════════════════════════════════════════════════
# SLASH COMMAND
# ═════════════════════════════════════════════════════════════


def check_server_slash_command():
    """
    Decorador para slash commands.

    Verifica se o comando está sendo executado
    no servidor principal.

    Funções marcadas com @exclude_from_check
    não recebem a verificação.
    """

    def decorator(func):

        if getattr(
            func,
            "_exclude_from_check",
            False,
        ):
            return func

        @wraps(func)
        async def wrapper(
            self,
            inter: disnake.ApplicationCommandInteraction,
            *args,
            **kwargs,
        ):
            if not is_main_server(
                inter.guild_id
            ):
                await inter.response.send_message(
                    SLASH_ACCESS_DENIED_MESSAGE,
                    ephemeral=True,
                )
                return

            return await func(
                self,
                inter,
                *args,
                **kwargs,
            )

        return wrapper

    return decorator


# ═════════════════════════════════════════════════════════════
# PREFIX COMMAND
# ═════════════════════════════════════════════════════════════


def check_server_prefix_command():
    """
    Decorador para comandos de prefixo.

    Verifica se o comando está sendo executado
    no servidor principal.
    """

    def decorator(func):

        @wraps(func)
        async def wrapper(
            self,
            ctx: commands.Context,
            *args,
            **kwargs,
        ):
            guild = ctx.guild

            if (
                guild is None
                or not is_main_server(
                    guild.id
                )
            ):
                await ctx.send(
                    SLASH_ACCESS_DENIED_MESSAGE,
                    delete_after=10,
                )
                return

            return await func(
                self,
                ctx,
                *args,
                **kwargs,
            )

        return wrapper

    return decorator


# ═════════════════════════════════════════════════════════════
# EXCLUIR DA VERIFICAÇÃO
# ═════════════════════════════════════════════════════════════


def exclude_from_check(
    func,
):
    """
    Marca uma função para ser excluída
    da verificação de servidor.

    Exemplo:

        @check_server_slash_command()
        @exclude_from_check
        async def backup(...):
            ...
    """

    func._exclude_from_check = True

    return func


# ═════════════════════════════════════════════════════════════
# EVENTOS
# ═════════════════════════════════════════════════════════════


async def check_server_event(
    guild_id: Union[int, str],
) -> bool:
    """
    Verifica se um evento deve ser processado
    baseado no servidor.

    Retorna:
        True:
            Servidor principal.

        False:
            Outro servidor.
    """

    return is_main_server(
        guild_id
    )


# ═════════════════════════════════════════════════════════════
# INTERAÇÕES
# ═════════════════════════════════════════════════════════════


def check_interaction_server(
    inter: Union[
        disnake.Interaction,
        disnake.ApplicationCommandInteraction,
    ],
) -> bool:
    """
    Verifica se uma interação está sendo
    executada no servidor principal.

    Pode ser utilizada para:
    - botões;
    - selects;
    - modais;
    - application commands.
    """

    if not inter.guild:
        return False

    return is_main_server(
        inter.guild.id
    )


# ═════════════════════════════════════════════════════════════
# ERRO PADRÃO
# ═════════════════════════════════════════════════════════════


async def send_server_error(
    inter: Union[
        disnake.Interaction,
        disnake.ApplicationCommandInteraction,
    ],
    ephemeral: bool = True,
):
    """
    Envia a mensagem padrão informando
    que a ação só pode ser utilizada
    no servidor principal.

    Se a interação ainda não foi respondida,
    usa inter.response.

    Caso contrário, usa inter.followup.
    """

    if not inter.response.is_done():
        await inter.response.send_message(
            INTERACTION_ACCESS_DENIED_MESSAGE,
            ephemeral=ephemeral,
        )

    else:
        await inter.followup.send(
            INTERACTION_ACCESS_DENIED_MESSAGE,
            ephemeral=ephemeral,
        )