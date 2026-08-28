import asyncio
import json
import logging
from pathlib import Path

import disnake
from disnake.ext import commands


logger = logging.getLogger(__name__)


CONFIG_PATH = Path(
    "configs/config_websocket.json"
)

DEFAULT_SERVER_URL = (
    "https://boost.zurosapplications.com.br"
)

DEFAULT_RECONNECT_INTERVAL = 5

INITIAL_DELAY = 3


class BoostWebSocketReady(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

        self.websocket_started = False
        self._starting = False
        self._start_lock = asyncio.Lock()

        self._manager = None

    # ═════════════════════════════════════════════════════════
    # CONFIG
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _load_config() -> dict:
        """
        Carrega a configuração do WebSocket Boost.
        """

        try:
            with CONFIG_PATH.open(
                "r",
                encoding="utf-8",
            ) as file:
                data = json.load(
                    file
                )

        except FileNotFoundError:
            logger.warning(
                "[Boost WebSocket] Arquivo %s "
                "não encontrado.",
                CONFIG_PATH,
            )
            return {}

        except json.JSONDecodeError:
            logger.exception(
                "[Boost WebSocket] JSON inválido em %s.",
                CONFIG_PATH,
            )
            return {}

        except OSError:
            logger.exception(
                "[Boost WebSocket] Erro ao abrir %s.",
                CONFIG_PATH,
            )
            return {}

        except Exception:
            logger.exception(
                "[Boost WebSocket] Erro inesperado "
                "ao carregar configuração."
            )
            return {}

        if not isinstance(
            data,
            dict,
        ):
            return {}

        boost_config = (
            data.get(
                "websocket_boost"
            )
            or {}
        )

        if not isinstance(
            boost_config,
            dict,
        ):
            return {}

        return boost_config

    # ═════════════════════════════════════════════════════════
    # CONFIG VALUES
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _get_server_url(
        config: dict,
    ) -> str:

        server_url = str(
            config.get(
                "server_url",
                DEFAULT_SERVER_URL,
            )
            or DEFAULT_SERVER_URL
        ).strip()

        return (
            server_url
            or DEFAULT_SERVER_URL
        )

    @staticmethod
    def _get_reconnect_interval(
        config: dict,
    ) -> float:

        try:
            value = float(
                config.get(
                    "reconnect_interval",
                    DEFAULT_RECONNECT_INTERVAL,
                )
            )

        except (
            TypeError,
            ValueError,
        ):
            value = float(
                DEFAULT_RECONNECT_INTERVAL
            )

        return max(
            1.0,
            value,
        )

    # ═════════════════════════════════════════════════════════
    # MANAGER
    # ═════════════════════════════════════════════════════════

    async def _get_manager(
        self,
    ):
        if self._manager is not None:
            return self._manager

        try:
            from modules.settings.extensions.boost.websocket_manager import (
                get_websocket_manager,
            )

            manager = (
                get_websocket_manager()
            )

            if manager is None:
                raise RuntimeError(
                    "get_websocket_manager() retornou None."
                )

            manager.set_bot(
                self.bot
            )

            self._manager = manager

            return manager

        except Exception:
            logger.exception(
                "[Boost WebSocket] Não foi possível "
                "obter o WebSocket Manager."
            )

            return None

    # ═════════════════════════════════════════════════════════
    # START
    # ═════════════════════════════════════════════════════════

    async def _start_websocket(
        self,
    ) -> None:
        """
        Inicializa o WebSocket Boost de forma segura.
        """

        if self.websocket_started:
            return

        async with self._start_lock:

            if self.websocket_started:
                return

            if self._starting:
                return

            self._starting = True

            try:
                config = self._load_config()

                auto_start = bool(
                    config.get(
                        "auto_start",
                        True,
                    )
                )

                if not auto_start:
                    logger.info(
                        "[Boost WebSocket] Auto-start "
                        "desabilitado."
                    )
                    return

                manager = await self._get_manager()

                if manager is None:
                    return

                # ─────────────────────────────────
                # CONFIGURAR
                # ─────────────────────────────────

                server_url = (
                    self._get_server_url(
                        config
                    )
                )

                reconnect_interval = (
                    self._get_reconnect_interval(
                        config
                    )
                )

                manager.server_url = (
                    server_url
                )

                manager.reconnect_interval = (
                    reconnect_interval
                )

                manager.set_bot(
                    self.bot
                )

                # ─────────────────────────────────
                # JÁ CONECTADO
                # ─────────────────────────────────

                try:
                    if manager.is_connected():
                        self.websocket_started = True

                        logger.info(
                            "[Boost WebSocket] "
                            "Já estava conectado."
                        )

                        return

                except Exception:
                    logger.debug(
                        "[Boost WebSocket] Falha ao "
                        "consultar estado da conexão.",
                        exc_info=True,
                    )

                # ─────────────────────────────────
                # CONECTAR
                # ─────────────────────────────────

                logger.info(
                    "[Boost WebSocket] "
                    "Conectando em %s...",
                    server_url,
                )

                await manager.start()

                self.websocket_started = True

                # ─────────────────────────────────
                # ESTADO
                # ─────────────────────────────────

                try:
                    connected = (
                        manager.is_connected()
                    )

                except Exception:
                    connected = False

                if connected:
                    logger.info(
                        "[Boost WebSocket] "
                        "Conectado com sucesso."
                    )

                else:
                    logger.warning(
                        "[Boost WebSocket] "
                        "Conexão ainda não estabelecida. "
                        "O manager continuará tentando "
                        "reconectar."
                    )

            except asyncio.CancelledError:
                raise

            except Exception:
                self.websocket_started = False

                logger.exception(
                    "[Boost WebSocket] "
                    "Erro ao inicializar."
                )

            finally:
                self._starting = False

    # ═════════════════════════════════════════════════════════
    # READY
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_ready"
    )
    async def on_ready(
        self,
    ):
        """
        Inicializa o WebSocket quando o bot
        estiver completamente pronto.
        """

        if self.websocket_started:
            return

        await asyncio.sleep(
            INITIAL_DELAY
        )

        await self._start_websocket()

    # ═════════════════════════════════════════════════════════
    # RESUME
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_resumed"
    )
    async def on_resumed(
        self,
    ):
        """
        Verifica novamente o WebSocket após
        reconexão com o Discord.
        """

        manager = await self._get_manager()

        if manager is None:
            return

        try:
            if manager.is_connected():
                self.websocket_started = True
                return

        except Exception:
            pass

        self.websocket_started = False

        await self._start_websocket()

    # ═════════════════════════════════════════════════════════
    # UNLOAD
    # ═════════════════════════════════════════════════════════

    def cog_unload(
        self,
    ):
        """
        Desconecta o WebSocket ao descarregar o Cog.
        """

        manager = self._manager

        if manager is None:
            return

        try:
            loop = asyncio.get_running_loop()

            loop.create_task(
                self._shutdown()
            )

        except RuntimeError:
            pass

    async def _shutdown(
        self,
    ) -> None:

        manager = self._manager

        if manager is None:
            return

        try:
            await manager.stop()

            logger.info(
                "[Boost WebSocket] "
                "Conexão encerrada."
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "[Boost WebSocket] "
                "Erro ao encerrar conexão."
            )

        finally:
            self.websocket_started = False
            self._manager = None


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        BoostWebSocketReady(bot)
    )