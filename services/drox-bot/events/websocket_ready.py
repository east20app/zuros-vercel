"""
Inicialização e gerenciamento do WebSocket.

Responsabilidades:
- Inicializar o WebSocket quando o bot estiver pronto.
- Evitar múltiplas inicializações.
- Informar desconexão/reconexão do Discord.
- Encerrar o WebSocket ao descarregar o Cog.
"""

import asyncio
import logging
from datetime import datetime, timezone

import disnake
from disnake.ext import commands


logger = logging.getLogger(__name__)


class WebSocketReady(commands.Cog):
    """Gerencia o ciclo de vida do WebSocket."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

        self.websocket_initialized = False
        self._initializing = False
        self._initialization_lock = asyncio.Lock()

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _now_iso() -> str:
        """Retorna horário UTC em ISO 8601."""

        return datetime.now(
            timezone.utc
        ).isoformat()

    def _get_websocket_manager(self):
        """Retorna o WebSocket Manager salvo no bot."""

        return getattr(
            self.bot,
            "websocket_manager",
            None,
        )

    async def _emit_event(
        self,
        event_name: str,
        data: dict | None = None,
    ) -> bool:
        """
        Envia um evento pelo WebSocket com tratamento de erro.
        """

        manager = self._get_websocket_manager()

        if not manager:
            return False

        payload = data or {}

        try:
            await manager.emit_event(
                event_name,
                payload,
            )

            return True

        except Exception:
            logger.exception(
                "Erro ao emitir evento WebSocket '%s'.",
                event_name,
            )

            return False

    # ═════════════════════════════════════════════════════════
    # INICIALIZAÇÃO
    # ═════════════════════════════════════════════════════════

    async def _initialize_websocket(self) -> None:
        """
        Inicializa o WebSocket Manager uma única vez.
        """

        if self.websocket_initialized:
            return

        async with self._initialization_lock:

            # Verifica novamente após adquirir o lock.
            if self.websocket_initialized:
                return

            if self._initializing:
                return

            self._initializing = True

            try:
                from connections import setup as setup_websocket

                manager = setup_websocket(
                    self.bot
                )

                if manager is None:
                    raise RuntimeError(
                        "connections.setup() retornou None."
                    )

                # Garante acesso global pelo bot.
                self.bot.websocket_manager = manager

                await manager.initialize()

                self.websocket_initialized = True

                logger.info(
                    "WebSocket Manager inicializado com sucesso."
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                self.websocket_initialized = False

                logger.exception(
                    "Falha ao inicializar o WebSocket Manager."
                )

            finally:
                self._initializing = False

    # ═════════════════════════════════════════════════════════
    # DISCORD READY
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener()
    async def on_ready(self):
        """
        Inicializa o WebSocket quando o bot estiver pronto.
        """

        if not self.bot.user:
            return

        # Guarda o horário inicial do processo do bot.
        if not hasattr(
            self.bot,
            "start_time",
        ):
            self.bot.start_time = datetime.now(
                timezone.utc
            )

        logger.info(
            "Bot %s conectado.",
            self.bot.user,
        )

        logger.info(
            "Bot ID: %s",
            self.bot.user.id,
        )

        logger.info(
            "Servidores: %s",
            len(self.bot.guilds),
        )

        await self._initialize_websocket()

    # ═════════════════════════════════════════════════════════
    # DISCONNECT
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener()
    async def on_disconnect(self):
        """
        Chamado quando a conexão do bot com o Discord é perdida.
        """

        logger.warning(
            "Bot desconectado do Discord."
        )

        await self._emit_event(
            "bot_disconnected",
            {
                "timestamp": self._now_iso(),
            },
        )

    # ═════════════════════════════════════════════════════════
    # RESUMED
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener()
    async def on_resumed(self):
        """
        Chamado quando a sessão do Discord é retomada.
        """

        logger.info(
            "Conexão com o Discord retomada."
        )

        manager = self._get_websocket_manager()

        # Caso o WebSocket não tenha sido inicializado
        # corretamente antes, tenta novamente.
        if not manager or not self.websocket_initialized:
            await self._initialize_websocket()

        await self._emit_event(
            "bot_resumed",
            {
                "timestamp": self._now_iso(),
            },
        )

    # ═════════════════════════════════════════════════════════
    # COG UNLOAD
    # ═════════════════════════════════════════════════════════

    def cog_unload(self):
        """
        Encerra o WebSocket ao descarregar o Cog.
        """

        manager = self._get_websocket_manager()

        if not manager:
            return

        try:
            loop = asyncio.get_running_loop()

        except RuntimeError:
            logger.warning(
                "Não foi possível encerrar o WebSocket: "
                "nenhum event loop ativo."
            )
            return

        loop.create_task(
            self._disconnect_websocket()
        )

    async def _disconnect_websocket(self):
        """
        Desconecta o WebSocket Manager com segurança.
        """

        manager = self._get_websocket_manager()

        if not manager:
            return

        try:
            await manager.disconnect()

            logger.info(
                "WebSocket Manager desconectado."
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao desconectar o WebSocket Manager."
            )

        finally:
            self.websocket_initialized = False

            try:
                self.bot.websocket_manager = None

            except Exception:
                pass


def setup(bot: commands.Bot):
    bot.add_cog(
        WebSocketReady(bot)
    )