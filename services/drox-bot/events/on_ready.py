"""
Inicialização principal do bot.

Responsabilidades:
- Executar ações iniciais no on_ready.
- Inicializar e monitorar o WebSocket do Zuros Cloud.
- Inicializar e monitorar o WebSocket do Zuros Boost.
- Recuperar carrinhos com pagamentos pendentes.
- Encerrar corretamente tarefas ao descarregar o Cog.
"""

import asyncio
import logging
from datetime import datetime, timezone

import disnake
from disnake.ext import commands

import core

from functions.database import database as db
from functions.utils import utils


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

CLOUD_INITIAL_DELAY = 3
BOOST_INITIAL_DELAY = 5
CART_INITIAL_DELAY = 5

WEBSOCKET_CHECK_INTERVAL = 30
WEBSOCKET_RECONNECT_DELAY = 3
WEBSOCKET_MAX_FAILURES = 3

CONNECTION_WAIT_ATTEMPTS = 20
CONNECTION_WAIT_INTERVAL = 0.5


class OnLoad(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

        self._ready_initialized = False
        self._ready_lock = asyncio.Lock()

        self._background_tasks: set[
            asyncio.Task
        ] = set()

        self._cloud_reconnect_lock = (
            asyncio.Lock()
        )

        self._boost_reconnect_lock = (
            asyncio.Lock()
        )

        self._closed = False

    # ═════════════════════════════════════════════════════════
    # TASK MANAGER
    # ═════════════════════════════════════════════════════════

    def _create_task(
        self,
        coroutine,
        *,
        name: str,
    ) -> asyncio.Task:
        """
        Cria e registra uma task em background.
        """

        task = asyncio.create_task(
            coroutine,
            name=name,
        )

        self._background_tasks.add(
            task
        )

        task.add_done_callback(
            self._task_done_callback
        )

        return task

    def _task_done_callback(
        self,
        task: asyncio.Task,
    ) -> None:
        """
        Remove a task da lista e registra
        exceções inesperadas.
        """

        self._background_tasks.discard(
            task
        )

        if task.cancelled():
            return

        try:
            error = task.exception()

        except asyncio.CancelledError:
            return

        if error:
            logger.error(
                "Task %s terminou com erro.",
                task.get_name(),
                exc_info=(
                    type(error),
                    error,
                    error.__traceback__,
                ),
            )

    # ═════════════════════════════════════════════════════════
    # READY
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener("on_ready")
    async def on_load(self):
        """
        Executado quando o Discord informa
        que o bot está pronto.
        """

        if self._ready_initialized:
            return

        async with self._ready_lock:

            if self._ready_initialized:
                return

            if not self.bot.user:
                return

            # Marca antes de iniciar os processos.
            # Assim outro on_ready não executa tudo novamente.
            self._ready_initialized = True

            self._print_bot_info()

            # ─────────────────────────────────────
            # STATUS
            # ─────────────────────────────────────

            try:
                await core.change_status(
                    self.bot
                )

            except Exception:
                logger.exception(
                    "Erro ao atualizar o status do bot."
                )

            # ─────────────────────────────────────
            # LOG DE REINICIALIZAÇÃO
            # ─────────────────────────────────────

            try:
                await core.log_restart(
                    self.bot
                )

            except Exception:
                logger.exception(
                    "Erro ao registrar reinicialização do bot."
                )

            # ─────────────────────────────────────
            # WEBSOCKETS
            # ─────────────────────────────────────
            # Zuros Auth usa REST/polling; o WebSocket Cloud legado nao e iniciado.

            self._create_task(
                self._boost_websocket_loop(),
                name="zuros-boost-websocket",
            )

            # ─────────────────────────────────────
            # CARRINHOS PENDENTES
            # ─────────────────────────────────────

            self._create_task(
                self._check_pending_carts(),
                name="pending-carts-recovery",
            )

    # ═════════════════════════════════════════════════════════
    # INFORMAÇÕES
    # ═════════════════════════════════════════════════════════

    def _print_bot_info(
        self,
    ) -> None:
        """
        Exibe informações básicas do bot.
        """

        try:
            principal_id = (
                utils.obter_server_principal()
            )

            servidor_principal = (
                self.bot.get_guild(
                    principal_id
                )
            )

        except Exception:
            servidor_principal = None

        total_usuarios = sum(
            guild.member_count or 0
            for guild in self.bot.guilds
        )

        print()
        print(
            f"Conectado em "
            f"{self.bot.user.name} | "
            f"{self.bot.user.id}"
        )

        print(
            f"Servidores: "
            f"{len(self.bot.guilds)}"
        )

        print(
            f"Usuários: "
            f"{total_usuarios}"
        )

        if servidor_principal:
            print(
                f"Servidor principal: "
                f"{servidor_principal.name}"
            )
        else:
            print(
                "Servidor principal: "
                "Não encontrado"
            )

        print(
            f"Latência: "
            f"{round(self.bot.latency * 1000)}ms"
        )

    # ═════════════════════════════════════════════════════════
    # ZUROS CLOUD
    # ═════════════════════════════════════════════════════════

    async def _cloud_websocket_loop(
        self,
    ) -> None:
        """
        Mantém o WebSocket do Zuros Cloud ativo.

        Substitui as chamadas recursivas que
        existiam anteriormente.
        """

        await asyncio.sleep(
            CLOUD_INITIAL_DELAY
        )

        try:
            from modules.cloud.update_api import (
                get_websocket_manager,
                register_websocket_callbacks,
                set_bot_instance,
            )

        except Exception:
            logger.exception(
                "Não foi possível importar "
                "o WebSocket do Zuros Cloud."
            )
            return

        try:
            set_bot_instance(
                self.bot
            )

            manager = (
                get_websocket_manager()
            )

            manager.set_bot(
                self.bot
            )

            register_websocket_callbacks()

        except Exception:
            logger.exception(
                "Erro ao configurar "
                "o WebSocket do Zuros Cloud."
            )
            return

        failures = 0

        while not self._closed:

            try:
                # ─────────────────────────────────
                # CONECTADO
                # ─────────────────────────────────

                if manager.is_connected():
                    failures = 0

                    await asyncio.sleep(
                        WEBSOCKET_CHECK_INTERVAL
                    )

                    continue

                # ─────────────────────────────────
                # DESCONECTADO
                # ─────────────────────────────────

                failures += 1

                # Na primeira tentativa após iniciar,
                # conecta imediatamente.
                if failures == 1:
                    await self._connect_cloud(
                        manager,
                        register_websocket_callbacks,
                    )

                # Se continuar desconectado por várias
                # verificações, força uma reconexão.
                elif (
                    failures
                    >= WEBSOCKET_MAX_FAILURES
                ):
                    logger.warning(
                        "[ZurosCloud] WebSocket "
                        "desconectado. Reconectando..."
                    )

                    await self._reconnect_cloud(
                        manager,
                        register_websocket_callbacks,
                    )

                    failures = 0

                await asyncio.sleep(
                    WEBSOCKET_CHECK_INTERVAL
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                failures += 1

                logger.exception(
                    "[ZurosCloud] Erro no "
                    "monitoramento do WebSocket."
                )

                await asyncio.sleep(
                    WEBSOCKET_CHECK_INTERVAL
                )

    async def _connect_cloud(
        self,
        manager,
        register_callbacks,
    ) -> bool:
        """
        Inicia o WebSocket Cloud e aguarda
        a conexão ficar disponível.
        """

        async with self._cloud_reconnect_lock:

            if self._closed:
                return False

            if manager.is_connected():
                return True

            try:
                register_callbacks()

                await manager.start()

                conectado = (
                    await self._wait_connection(
                        manager
                    )
                )

                if conectado:
                    logger.info(
                        "[ZurosCloud] WebSocket conectado."
                    )

                    try:
                        await manager.resend_bot_connected()

                    except Exception:
                        logger.exception(
                            "[ZurosCloud] Erro ao reenviar "
                            "evento bot_connected."
                        )

                    return True

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "[ZurosCloud] Erro ao conectar."
                )

            return False

    async def _reconnect_cloud(
        self,
        manager,
        register_callbacks,
    ) -> bool:
        """
        Reinicia completamente a conexão Cloud.
        """

        async with self._cloud_reconnect_lock:

            if self._closed:
                return False

            try:
                await manager.stop()

            except Exception:
                logger.debug(
                    "[ZurosCloud] Não foi possível "
                    "encerrar a conexão antiga.",
                    exc_info=True,
                )

            await asyncio.sleep(
                WEBSOCKET_RECONNECT_DELAY
            )

            try:
                register_callbacks()

                await manager.start()

                conectado = (
                    await self._wait_connection(
                        manager
                    )
                )

                if conectado:
                    logger.info(
                        "[ZurosCloud] WebSocket "
                        "reconectado com sucesso."
                    )

                    try:
                        await manager.resend_bot_connected()

                    except Exception:
                        logger.debug(
                            "[ZurosCloud] Falha ao reenviar "
                            "bot_connected.",
                            exc_info=True,
                        )

                    return True

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "[ZurosCloud] Falha na reconexão."
                )

            return False

    # ═════════════════════════════════════════════════════════
    # ZUROS BOOST
    # ═════════════════════════════════════════════════════════

    async def _boost_websocket_loop(
        self,
    ) -> None:
        """
        Mantém o WebSocket do Zuros Boost ativo.
        """

        await asyncio.sleep(
            BOOST_INITIAL_DELAY
        )

        try:
            from modules.settings.extensions.boost.websocket_manager import (
                get_websocket_manager,
            )

        except Exception:
            logger.exception(
                "Não foi possível importar "
                "o WebSocket do Zuros Boost."
            )
            return

        try:
            manager = (
                get_websocket_manager()
            )

            manager.set_bot(
                self.bot
            )

        except Exception:
            logger.exception(
                "Erro ao configurar "
                "o WebSocket do Zuros Boost."
            )
            return

        failures = 0

        while not self._closed:

            try:
                if manager.is_connected():
                    failures = 0

                    await asyncio.sleep(
                        WEBSOCKET_CHECK_INTERVAL
                    )

                    continue

                failures += 1

                if failures == 1:
                    await self._connect_boost(
                        manager
                    )

                elif (
                    failures
                    >= WEBSOCKET_MAX_FAILURES
                ):
                    logger.warning(
                        "[ZurosBoost] WebSocket "
                        "desconectado. Reconectando..."
                    )

                    await self._reconnect_boost(
                        manager
                    )

                    failures = 0

                await asyncio.sleep(
                    WEBSOCKET_CHECK_INTERVAL
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                failures += 1

                logger.exception(
                    "[ZurosBoost] Erro no "
                    "monitoramento do WebSocket."
                )

                await asyncio.sleep(
                    WEBSOCKET_CHECK_INTERVAL
                )

    async def _connect_boost(
        self,
        manager,
    ) -> bool:

        async with self._boost_reconnect_lock:

            if self._closed:
                return False

            if manager.is_connected():
                return True

            try:
                await manager.start()

                conectado = (
                    await self._wait_connection(
                        manager
                    )
                )

                if conectado:
                    logger.info(
                        "[ZurosBoost] WebSocket conectado."
                    )

                    return True

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "[ZurosBoost] Erro ao conectar."
                )

            return False

    async def _reconnect_boost(
        self,
        manager,
    ) -> bool:

        async with self._boost_reconnect_lock:

            if self._closed:
                return False

            try:
                await manager.stop()

            except Exception:
                logger.debug(
                    "[ZurosBoost] Não foi possível "
                    "encerrar a conexão antiga.",
                    exc_info=True,
                )

            await asyncio.sleep(
                WEBSOCKET_RECONNECT_DELAY
            )

            try:
                await manager.start()

                conectado = (
                    await self._wait_connection(
                        manager
                    )
                )

                if conectado:
                    logger.info(
                        "[ZurosBoost] WebSocket "
                        "reconectado com sucesso."
                    )

                    return True

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "[ZurosBoost] Falha na reconexão."
                )

            return False

    # ═════════════════════════════════════════════════════════
    # ESPERAR CONEXÃO
    # ═════════════════════════════════════════════════════════

    @staticmethod
    async def _wait_connection(
        manager,
    ) -> bool:
        """
        Aguarda até aproximadamente 10 segundos
        pelo WebSocket ficar conectado.
        """

        for _ in range(
            CONNECTION_WAIT_ATTEMPTS
        ):
            if manager.is_connected():
                return True

            await asyncio.sleep(
                CONNECTION_WAIT_INTERVAL
            )

        return bool(
            manager.is_connected()
        )

    # ═════════════════════════════════════════════════════════
    # CARRINHOS PENDENTES
    # ═════════════════════════════════════════════════════════

    async def _check_pending_carts(
        self,
    ) -> None:
        """
        Recupera pagamentos que estavam pendentes
        antes da última reinicialização do bot.
        """

        await asyncio.sleep(
            CART_INITIAL_DELAY
        )

        try:
            loja_data = (
                db.get_document("loja_data")
                or {}
            )

            if not isinstance(
                loja_data,
                dict,
            ):
                loja_data = {}

            carts = (
                loja_data.get("carts")
                or {}
            )

            if not isinstance(
                carts,
                dict,
            ):
                return

            from modules.loja.cart.checkout import (
                _check_single_payment_status,
                _extract_payment_ids,
                _handle_payment_approved,
                _monitor_payment,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "[Cart Monitor] Erro ao inicializar "
                "recuperação dos carrinhos."
            )
            return

        approved_count = 0
        failed_count = 0
        pending_count = 0

        for cart_id, cart in list(
            carts.items()
        ):
            if self._closed:
                return

            if not isinstance(
                cart,
                dict,
            ):
                continue

            if cart.get("status") != "pending":
                continue

            try:
                resultado = (
                    self._extract_payment_data(
                        cart
                    )
                )

                if resultado is None:
                    continue

                (
                    payment_data,
                    provider_data,
                    raw_data,
                    payment_provider,
                    payment_id,
                    payment_method,
                ) = resultado

                is_free_purchase = bool(
                    cart.get(
                        "is_free_purchase",
                        False,
                    )
                )

                if is_free_purchase:
                    continue

                if (
                    not payment_id
                    or not payment_method
                ):
                    logger.warning(
                        "[Cart Monitor] Carrinho %s "
                        "pendente sem payment_id "
                        "ou payment_method.",
                        cart_id,
                    )
                    continue

                # ═════════════════════════════════
                # CONSULTAR PAGAMENTO
                # ═════════════════════════════════

                is_finished, final_status = (
                    await _check_single_payment_status(
                        cart_id=cart_id,
                        payment_id=payment_id,
                        payment_method=payment_method,
                        payment_provider=payment_provider,
                        bot=self.bot,
                    )
                )

                # ═════════════════════════════════
                # FINALIZADO
                # ═════════════════════════════════

                if is_finished:

                    if final_status == "approved":
                        logger.info(
                            "[Cart Monitor] Pagamento "
                            "aprovado para %s.",
                            cart_id,
                        )

                        await _handle_payment_approved(
                            cart_id,
                            self.bot,
                        )

                        approved_count += 1

                    else:
                        logger.info(
                            "[Cart Monitor] Pagamento %s "
                            "finalizado como %s.",
                            cart_id,
                            final_status,
                        )

                        cart["status"] = (
                            final_status
                        )

                        cart["updated_at"] = int(
                            datetime.now(
                                timezone.utc
                            ).timestamp()
                        )

                        loja_data.setdefault(
                            "carts",
                            {},
                        )[cart_id] = cart

                        db.save_document(
                            "loja_data",
                            {},
                            loja_data,
                        )

                        failed_count += 1

                    continue

                # ═════════════════════════════════
                # AINDA PENDENTE
                # ═════════════════════════════════

                payment_ids = (
                    self._build_payment_ids(
                        provider_data,
                        raw_data,
                        _extract_payment_ids,
                    )
                )

                if not payment_ids:
                    logger.warning(
                        "[Cart Monitor] Carrinho %s "
                        "não possui IDs suficientes "
                        "para reiniciar monitoramento.",
                        cart_id,
                    )
                    continue

                self._start_payment_monitor(
                    _monitor_payment,
                    cart_id=cart_id,
                    payment_method=payment_method,
                    payment_ids=payment_ids,
                    payment_provider=payment_provider,
                )

                pending_count += 1

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "[Cart Monitor] Erro ao recuperar "
                    "carrinho %s.",
                    cart_id,
                )

                # Tenta ao menos reiniciar o monitoramento.
                try:
                    resultado = (
                        self._extract_payment_data(
                            cart
                        )
                    )

                    if resultado is None:
                        continue

                    (
                        _,
                        provider_data,
                        raw_data,
                        payment_provider,
                        _,
                        payment_method,
                    ) = resultado

                    payment_ids = (
                        self._build_payment_ids(
                            provider_data,
                            raw_data,
                            _extract_payment_ids,
                        )
                    )

                    if (
                        payment_ids
                        and payment_method
                    ):
                        self._start_payment_monitor(
                            _monitor_payment,
                            cart_id=cart_id,
                            payment_method=payment_method,
                            payment_ids=payment_ids,
                            payment_provider=payment_provider,
                        )

                        pending_count += 1

                except Exception:
                    logger.exception(
                        "[Cart Monitor] Falha no fallback "
                        "do carrinho %s.",
                        cart_id,
                    )

        logger.info(
            "[Cart Monitor] Recuperação concluída | "
            "Aprovados: %s | "
            "Falhados: %s | "
            "Pendentes: %s",
            approved_count,
            failed_count,
            pending_count,
        )

    # ═════════════════════════════════════════════════════════
    # PAYMENT HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _extract_payment_data(
        cart: dict,
    ):
        """
        Extrai informações de pagamento aceitando
        tanto a estrutura nova quanto a antiga.
        """

        payment_data = (
            cart.get("payment_data")
            or {}
        )

        if not isinstance(
            payment_data,
            dict,
        ):
            return None

        provider_data = (
            payment_data.get("provider")
            or {}
        )

        if not isinstance(
            provider_data,
            dict,
        ):
            provider_data = {}

        payment_provider = (
            provider_data.get("name")
            or payment_data.get(
                "payment_provider"
            )
        )

        # ─────────────────────────────────────────
        # PROVIDER
        # ─────────────────────────────────────────

        payment_id = (
            provider_data.get("payment_id")
            or provider_data.get(
                "correlation_id"
            )
            or provider_data.get(
                "charge_id"
            )
            or provider_data.get("txid")
        )

        # ─────────────────────────────────────────
        # ESTRUTURA ANTIGA
        # ─────────────────────────────────────────

        if not payment_id:
            payment_ids = (
                payment_data.get(
                    "payment_ids"
                )
                or {}
            )

            if isinstance(
                payment_ids,
                dict,
            ):
                payment_id = (
                    payment_ids.get(
                        "payment_id"
                    )
                    or payment_ids.get("id")
                    or payment_ids.get("txid")
                    or payment_ids.get(
                        "payment_intent"
                    )
                )

        # ─────────────────────────────────────────
        # RAW
        # ─────────────────────────────────────────

        raw_data = (
            payment_data.get("raw")
            or provider_data.get(
                "raw_response"
            )
            or {}
        )

        if not isinstance(
            raw_data,
            dict,
        ):
            raw_data = {}

        if not payment_id:
            payment_id = (
                raw_data.get(
                    "transactionId"
                )
                or raw_data.get(
                    "paymentId"
                )
                or raw_data.get(
                    "payment_id"
                )
                or raw_data.get("id")
                or raw_data.get("txid")
                or raw_data.get(
                    "externalId"
                )
            )

        payment_method = (
            cart.get("payment_method")
        )

        return (
            payment_data,
            provider_data,
            raw_data,
            payment_provider,
            payment_id,
            payment_method,
        )

    @staticmethod
    def _build_payment_ids(
        provider_data: dict,
        raw_data: dict,
        extract_function,
    ) -> dict:
        """
        Monta os IDs necessários para
        _monitor_payment().
        """

        payment_ids = {}

        if provider_data.get(
            "payment_id"
        ):
            payment_ids[
                "payment_id"
            ] = provider_data[
                "payment_id"
            ]

        if provider_data.get(
            "correlation_id"
        ):
            payment_ids[
                "correlationID"
            ] = provider_data[
                "correlation_id"
            ]

        if provider_data.get(
            "charge_id"
        ):
            payment_ids[
                "charge_id"
            ] = provider_data[
                "charge_id"
            ]

        if provider_data.get("txid"):
            payment_ids[
                "txid"
            ] = provider_data[
                "txid"
            ]

        if not payment_ids and raw_data:
            try:
                payment_ids = (
                    extract_function(
                        raw_data
                    )
                    or {}
                )

            except Exception:
                logger.exception(
                    "[Cart Monitor] Erro ao extrair "
                    "payment IDs."
                )

                payment_ids = {}

        return payment_ids

    def _start_payment_monitor(
        self,
        monitor_function,
        *,
        cart_id,
        payment_method,
        payment_ids,
        payment_provider,
    ) -> None:
        """
        Reinicia o monitoramento de um pagamento
        pendente como task gerenciada.
        """

        self._create_task(
            monitor_function(
                cart_id,
                payment_method,
                payment_ids,
                payment_provider,
                self.bot,
            ),
            name=(
                f"payment-monitor-{cart_id}"
            ),
        )

    # ═════════════════════════════════════════════════════════
    # SHUTDOWN
    # ═════════════════════════════════════════════════════════

    def cog_unload(self):
        """
        Cancela as tasks do Cog quando ele for
        descarregado.
        """

        self._closed = True

        for task in list(
            self._background_tasks
        ):
            if not task.done():
                task.cancel()

        try:
            loop = asyncio.get_running_loop()

            loop.create_task(
                self._shutdown_websockets()
            )

        except RuntimeError:
            pass

    async def _shutdown_websockets(
        self,
    ) -> None:
        """
        Tenta fechar os dois WebSockets.
        """

        # ─────────────────────────────────────────
        # CLOUD
        # ─────────────────────────────────────────

        try:
            from modules.cloud.update_api import (
                get_websocket_manager,
            )

            manager = (
                get_websocket_manager()
            )

            await manager.stop()

        except Exception:
            logger.debug(
                "Erro ao desligar WebSocket Cloud.",
                exc_info=True,
            )

        # ─────────────────────────────────────────
        # BOOST
        # ─────────────────────────────────────────

        try:
            from modules.settings.extensions.boost.websocket_manager import (
                get_websocket_manager,
            )

            manager = (
                get_websocket_manager()
            )

            await manager.stop()

        except Exception:
            logger.debug(
                "Erro ao desligar WebSocket Boost.",
                exc_info=True,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnLoad(bot)
    )