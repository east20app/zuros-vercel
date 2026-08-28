from pathlib import Path

import aiohttp
import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message
from functions import plan


class ConfigurarPagamentos(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ─────────────────────────────────────────────
    # PROVEDORES PIX
    # ─────────────────────────────────────────────

    @staticmethod
    def _providers():
        return {
            "zuros_wallet": (
                "Zuros Wallet",
                emoji.wallet,
            ),

            "pix_manual": (
                "Pix Manual",
                emoji.pix,
            ),

            "mercado_pago": (
                "Mercado Pago",
                emoji.mercado_pago,
            ),

            "efibank": (
                "Efi Bank",
                emoji.efi_bank,
            ),

            "pushinpay": (
                "Pushin Pay",
                emoji.pushin_pay,
            ),

            "misticpay": (
                "MisticPay",
                emoji.pix,
            ),
        }

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────

    @staticmethod
    def _load_config() -> dict:
        return db.get_document("payment_configs") or {}

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
            return int(
                str(primary).replace("#", ""),
                16,
            )

        except (TypeError, ValueError):
            return None

    # ─────────────────────────────────────────────
    # STATUS
    # ─────────────────────────────────────────────

    @classmethod
    def _get_provider_status(
        cls,
        key: str,
        config: dict,
        pagamentos: dict,
    ) -> tuple[bool, bool, str]:

        entry = config.get(key)

        if isinstance(entry, dict):
            enabled = bool(
                entry.get("enabled", False)
            )

            if key == "zuros_wallet":
                configured = bool(
                    entry.get("api_key")
                )

            elif key == "pix_manual":
                configured = bool(
                    entry.get("pix_key")
                    and entry.get("pix_key_type")
                )

            elif key == "mercado_pago":
                configured = bool(
                    entry.get("access_token")
                )

            elif key == "efibank":
                cert_path = entry.get("cert_file")

                cert_ok = (
                    bool(cert_path)
                    and Path(cert_path).exists()
                )

                has_client = bool(
                    entry.get("client_id")
                    or entry.get("client")
                )

                has_secret = bool(
                    entry.get("client_secret")
                    or entry.get("token")
                )

                has_pix = bool(
                    entry.get("pix_key")
                )

                configured = bool(
                    has_client
                    and has_secret
                    and has_pix
                    and cert_ok
                )

            elif key == "pushinpay":
                configured = bool(
                    entry.get("token_pushinpay")
                )

            elif key == "misticpay":
                configured = bool(
                    entry.get("client_id")
                    and entry.get("client_secret")
                )

            else:
                configured = False

        elif isinstance(entry, bool):
            enabled = entry
            configured = False

        else:
            enabled = bool(
                pagamentos.get(key, False)
            )
            configured = False

        if enabled:
            status_text = "Ativado"

        elif configured:
            status_text = "Desativado"

        else:
            status_text = "Não configurado"

        return (
            enabled,
            configured,
            status_text,
        )

    # ─────────────────────────────────────────────
    # OPTIONS
    # ─────────────────────────────────────────────

    @classmethod
    def _build_provider_options(
        cls,
    ) -> tuple[list[str], list[disnake.SelectOption]]:

        pagamentos = (
            db.get_document("pagamentos")
            or {}
        )

        config = cls._load_config()

        status_lines = []
        options = []

        for key, (label, icon) in cls._providers().items():

            enabled, configured, status_text = (
                cls._get_provider_status(
                    key,
                    config,
                    pagamentos,
                )
            )

            if enabled:
                status_icon = emoji.on

            elif configured:
                status_icon = emoji.settings2

            else:
                status_icon = emoji.wrong

            status_lines.append(
                f"{status_icon} **{label}**"
            )

            options.append(
                disnake.SelectOption(
                    label=label,
                    value=key,
                    emoji=icon,
                    description=(
                        f"Status: {status_text}"
                    ),
                )
            )

        return status_lines, options

    # ─────────────────────────────────────────────
    # COMPONENTS V2
    # ─────────────────────────────────────────────

    @classmethod
    def pagamentos_components(
        cls,
        inter: disnake.MessageInteraction,
    ) -> list[disnake.ui.Container]:

        status_lines, options = (
            cls._build_provider_options()
        )

        container_kwargs = {}

        primary_color = cls._get_primary_color()

        if primary_color is not None:
            container_kwargs["accent_colour"] = (
                disnake.Colour(primary_color)
            )

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Configurações › "
                    "**Pagamentos PIX**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Gerencie as formas de pagamento "
                    "via **PIX** utilizadas pelo sistema.\n"
                    "Selecione um provedor abaixo para "
                    "configurar."
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "\n".join(status_lines)
                    if status_lines
                    else "Nenhum provedor disponível."
                ),

                disnake.ui.Separator(),

                disnake.ui.ActionRow(
                    disnake.ui.StringSelect(
                        custom_id=(
                            "Configuracoes_"
                            "Pagamentos_Select"
                        ),
                        placeholder=(
                            "Selecione um provedor PIX"
                        ),
                        options=options,
                        min_values=1,
                        max_values=1,
                    )
                ),

                **container_kwargs,
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes",
                ),

                disnake.ui.Button(
                    label="Tutorial PIX",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.information,
                    custom_id=(
                        "Configuracoes_"
                        "Pagamentos_Tutorial_Pix"
                    ),
                ),
            ),
        ]

    # ─────────────────────────────────────────────
    # EMBED
    # ─────────────────────────────────────────────

    @classmethod
    def pagamentos_embed(
        cls,
        inter: disnake.MessageInteraction,
    ):

        status_lines, options = (
            cls._build_provider_options()
        )

        embed = disnake.Embed(
            title="Pagamentos PIX",
            description=(
                "-# Painel › Configurações › "
                "**Pagamentos PIX**\n\n"
                + (
                    "\n".join(status_lines)
                    if status_lines
                    else "Nenhum provedor disponível."
                )
            ),
        )

        primary_color = cls._get_primary_color()

        if primary_color is not None:
            embed.color = primary_color

        components = [
            disnake.ui.ActionRow(
                disnake.ui.StringSelect(
                    custom_id=(
                        "Configuracoes_"
                        "Pagamentos_Select"
                    ),
                    placeholder=(
                        "Selecione um provedor PIX"
                    ),
                    options=options,
                    min_values=1,
                    max_values=1,
                )
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes",
                ),

                disnake.ui.Button(
                    label="Tutorial PIX",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.information,
                    custom_id=(
                        "Configuracoes_"
                        "Pagamentos_Tutorial_Pix"
                    ),
                ),
            ),
        ]

        return embed, components

    # ─────────────────────────────────────────────
    # ABRIR PAINEL
    # ─────────────────────────────────────────────

    async def display_payments_panel(
        self,
        inter: disnake.MessageInteraction,
    ):

        mode = self._get_mode()

        if mode == "embed":
            await embed_message.wait(
                inter,
                send=False,
            )

            embed, components = (
                self.pagamentos_embed(inter)
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await message.wait(
                inter,
                send=False,
            )

            await inter.edit_original_message(
                components=(
                    self.pagamentos_components(inter)
                )
            )

    # ─────────────────────────────────────────────
    # BUTTON
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_button_click")
    async def on_button_click(
        self,
        inter: disnake.MessageInteraction,
    ):

        custom_id = inter.component.custom_id

        if custom_id == "Configuracoes_Pagamentos":

            await self.display_payments_panel(inter)
            return

        if (
            custom_id
            == "Configuracoes_Pagamentos_Tutorial_Pix"
        ):
            await inter.response.send_message(
                f"{emoji.information} "
                "**Tutorial de integração PIX**\n\n"
                "Acesse a documentação completa para "
                "configurar seus pagamentos.\n\n"
                "O grande diferencial da **Zuros Wallet** "
                "é que aceita menores e não possui MEDs.\n\n"
                "https://docs.zuroswallet.com.br/"
                "tutoriais/integrar-zuros-bot",
                ephemeral=True,
            )

    # ─────────────────────────────────────────────
    # DROPDOWN
    # ─────────────────────────────────────────────

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(
        self,
        inter: disnake.MessageInteraction,
    ):

        if (
            inter.component.custom_id
            != "Configuracoes_Pagamentos_Select"
        ):
            return

        if not inter.values:
            return

        key = inter.values[0]

        if key not in self._providers():
            return

        # Plano Free
        if not plan.should_allow_payment_provider(key):

            await inter.response.send_message(
                f"{emoji.wrong} O plano **Free** permite "
                "apenas a forma de pagamento "
                "**Zuros Wallet**.\n"
                f"{emoji.arrow} Acesse "
                "https://zuroswallet.com.br "
                "para criar sua conta.",
                ephemeral=True,
            )

            return

        await inter.response.send_modal(
            PaymentProviderModal(key)
        )


# ═════════════════════════════════════════════════
# MODAL DOS PROVEDORES
# ═════════════════════════════════════════════════


class PaymentProviderModal(disnake.ui.Modal):
    def __init__(
        self,
        provider_key: str,
    ):
        self.provider_key = provider_key

        config = ConfigurarPagamentos._load_config()

        entry = (
            config.get(provider_key)
            or {}
        )

        if isinstance(entry, bool):
            entry = {
                "enabled": entry
            }

        enabled = bool(
            entry.get("enabled", False)
        )

        providers = ConfigurarPagamentos._providers()

        label = providers.get(
            provider_key,
            (
                provider_key.capitalize(),
                "",
            ),
        )[0]

        components = [
            disnake.ui.Label(
                text="Status do provedor",

                component=disnake.ui.StringSelect(
                    placeholder="Ativar ou desativar",
                    custom_id="payment_status",
                    required=True,

                    options=[
                        disnake.SelectOption(
                            label="Ativado",
                            description=(
                                "O provedor ficará ativado"
                            ),
                            emoji=emoji.on,
                            value="enabled_True",
                            default=enabled,
                        ),

                        disnake.SelectOption(
                            label="Desativado",
                            description=(
                                "O provedor ficará desativado"
                            ),
                            emoji=emoji.off,
                            value="enabled_False",
                            default=not enabled,
                        ),
                    ],
                ),

                description=(
                    "Define se este provedor "
                    "estará ativo."
                ),
            )
        ]

        # ─────────────────────────────────────────
        # ZUROS WALLET
        # ─────────────────────────────────────────

        if provider_key == "zuros_wallet":

            api_key = entry.get("api_key")

            cover_fee = entry.get(
                "cover_fee",
                False,
            )

            components.append(
                disnake.ui.Label(
                    text="API Key da Zuros Wallet",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Cole sua API Key aqui (vp_...)"
                        ),
                        custom_id=(
                            "zuros_wallet_api_key"
                        ),
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(api_key or ""),
                    ),

                    description=(
                        "API Key obtida no painel "
                        "da Zuros Wallet."
                    ),
                )
            )

            components.append(
                disnake.ui.Label(
                    text="Cobrir taxas",

                    component=disnake.ui.StringSelect(
                        placeholder=(
                            "Selecione como tratar as taxas"
                        ),
                        custom_id=(
                            "zuros_wallet_cover_fee"
                        ),
                        required=False,

                        options=[
                            disnake.SelectOption(
                                label="Não cobrir taxas",
                                description=(
                                    "A taxa será descontada "
                                    "do pagamento"
                                ),
                                value="false",
                                default=not cover_fee,
                            ),

                            disnake.SelectOption(
                                label="Cobrir taxas",
                                description=(
                                    "O cliente pagará a taxa"
                                ),
                                value="true",
                                default=cover_fee,
                            ),
                        ],
                    ),

                    description=(
                        "Define quem irá arcar "
                        "com as taxas."
                    ),
                )
            )

        # ─────────────────────────────────────────
        # PIX MANUAL
        # ─────────────────────────────────────────

        elif provider_key == "pix_manual":

            components.append(
                disnake.ui.Label(
                    text="Chave PIX",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Digite sua chave PIX"
                        ),
                        custom_id="pix_manual_key",
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        max_length=100,
                        value=str(
                            entry.get("pix_key")
                            or ""
                        ),
                    ),

                    description=(
                        "Chave usada para receber "
                        "os pagamentos."
                    ),
                )
            )

            key_type = entry.get(
                "pix_key_type"
            )

            components.append(
                disnake.ui.Label(
                    text="Tipo da chave PIX",

                    component=disnake.ui.StringSelect(
                        placeholder=(
                            "Selecione o tipo da chave"
                        ),
                        custom_id=(
                            "pix_manual_key_type"
                        ),
                        required=False,

                        options=[
                            disnake.SelectOption(
                                label="Email",
                                value="email",
                                emoji=emoji.mail2,
                                default=(
                                    key_type == "email"
                                ),
                            ),

                            disnake.SelectOption(
                                label="Telefone",
                                value="telefone",
                                emoji=emoji.mobile,
                                default=(
                                    key_type == "telefone"
                                ),
                            ),

                            disnake.SelectOption(
                                label="CPF",
                                value="cpf",
                                emoji=emoji.member,
                                default=(
                                    key_type == "cpf"
                                ),
                            ),

                            disnake.SelectOption(
                                label="CNPJ",
                                value="cnpj",
                                emoji=emoji.store,
                                default=(
                                    key_type == "cnpj"
                                ),
                            ),

                            disnake.SelectOption(
                                label="Aleatória",
                                value="aleatoria",
                                emoji=emoji.link,
                                default=(
                                    key_type == "aleatoria"
                                ),
                            ),
                        ],
                    ),

                    description=(
                        "Tipo da chave PIX informada."
                    ),
                )
            )

        # ─────────────────────────────────────────
        # MERCADO PAGO
        # ─────────────────────────────────────────

        elif provider_key == "mercado_pago":

            components.append(
                disnake.ui.Label(
                    text="Access Token",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Cole o Access Token "
                            "do Mercado Pago"
                        ),
                        custom_id=(
                            "mercado_pago_access_token"
                        ),
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get("access_token")
                            or ""
                        ),
                    ),

                    description=(
                        "Access Token da sua "
                        "conta Mercado Pago."
                    ),
                )
            )

        # ─────────────────────────────────────────
        # EFI BANK
        # ─────────────────────────────────────────

        elif provider_key == "efibank":

            components.append(
                disnake.ui.Label(
                    text="Client ID",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe o Client ID da Efi"
                        ),
                        custom_id="efibank_client_id",
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get("client_id")
                            or entry.get("client")
                            or ""
                        ),
                    ),

                    description=(
                        "Client ID fornecido pela Efi."
                    ),
                )
            )

            components.append(
                disnake.ui.Label(
                    text="Client Secret",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe o Client Secret da Efi"
                        ),
                        custom_id=(
                            "efibank_client_secret"
                        ),
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get("client_secret")
                            or entry.get("token")
                            or ""
                        ),
                    ),

                    description=(
                        "Client Secret fornecido "
                        "pela Efi."
                    ),
                )
            )

            components.append(
                disnake.ui.Label(
                    text="Chave PIX",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe sua chave PIX "
                            "da Efi"
                        ),
                        custom_id="efibank_pix_key",
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get("pix_key")
                            or ""
                        ),
                    ),

                    description=(
                        "Chave PIX cadastrada "
                        "na Efi."
                    ),
                )
            )

            cert_path = entry.get(
                "cert_file"
            )

            cert_exists = (
                bool(cert_path)
                and Path(cert_path).exists()
            )

            components.append(
                disnake.ui.Label(
                    text="Certificado .p12",

                    component=disnake.ui.FileUpload(
                        custom_id=(
                            "efibank_cert_file"
                        ),
                        required=False,
                    ),

                    description=(
                        "Envie um novo certificado "
                        ".p12 ou deixe vazio para "
                        "manter o atual."
                        if cert_exists
                        else
                        "Envie o certificado .p12 "
                        "fornecido pela Efi."
                    ),
                )
            )

        # ─────────────────────────────────────────
        # PUSHIN PAY
        # ─────────────────────────────────────────

        elif provider_key == "pushinpay":

            components.append(
                disnake.ui.Label(
                    text="Token Pushin Pay",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe o token "
                            "da Pushin Pay"
                        ),
                        custom_id="pushinpay_token",
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get(
                                "token_pushinpay"
                            )
                            or ""
                        ),
                    ),

                    description=(
                        "Token de API da Pushin Pay."
                    ),
                )
            )

        # ─────────────────────────────────────────
        # MISTICPAY
        # ─────────────────────────────────────────

        elif provider_key == "misticpay":

            components.append(
                disnake.ui.Label(
                    text="Client ID",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe o Client ID "
                            "do MisticPay"
                        ),
                        custom_id=(
                            "misticpay_client_id"
                        ),
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get("client_id")
                            or ""
                        ),
                    ),

                    description=(
                        "Client ID do MisticPay."
                    ),
                )
            )

            components.append(
                disnake.ui.Label(
                    text="Client Secret",

                    component=disnake.ui.TextInput(
                        placeholder=(
                            "Informe o Client Secret "
                            "do MisticPay"
                        ),
                        custom_id=(
                            "misticpay_client_secret"
                        ),
                        style=(
                            disnake.TextInputStyle.short
                        ),
                        required=False,
                        value=str(
                            entry.get(
                                "client_secret"
                            )
                            or ""
                        ),
                    ),

                    description=(
                        "Client Secret do MisticPay."
                    ),
                )
            )

        super().__init__(
            title=f"Configurar {label}",
            components=components,
            custom_id=(
                f"payment_provider_modal:"
                f"{provider_key}"
            ),
        )

    # ═════════════════════════════════════════════
    # CALLBACK
    # ═════════════════════════════════════════════

    async def callback(
        self,
        inter: disnake.ModalInteraction,
    ):

        mode = ConfigurarPagamentos._get_mode()

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

        valores = inter.resolved_values

        # ─────────────────────────────────────────
        # STATUS
        # ─────────────────────────────────────────

        status_value = valores.get(
            "payment_status"
        )

        if isinstance(
            status_value,
            (list, tuple),
        ):
            status_value = (
                status_value[0]
                if status_value
                else None
            )

        enabled = (
            status_value == "enabled_True"
        )

        configured = False
        error_text = None

        config = (
            ConfigurarPagamentos._load_config()
        )

        entry = config.get(
            self.provider_key
        )

        if not isinstance(entry, dict):
            entry = {}

        # ═════════════════════════════════════════
        # ZUROS WALLET
        # ═════════════════════════════════════════

        if self.provider_key == "zuros_wallet":

            api_key_value = valores.get(
                "zuros_wallet_api_key"
            )

            cover_fee = valores.get(
                "zuros_wallet_cover_fee"
            )

            if isinstance(
                cover_fee,
                (list, tuple),
            ):
                cover_fee = (
                    cover_fee[0]
                    if cover_fee
                    else None
                )

            existing_key = entry.get(
                "api_key"
            )

            api_key = (
                api_key_value.strip()
                if api_key_value
                else existing_key
            )

            if api_key:

                if (
                    api_key.startswith("vp_")
                    and len(api_key) > 10
                ):
                    try:
                        from functions.payments.zuros_wallet import (
                            get_zuros_user,
                        )

                        result = await get_zuros_user(
                            api_key
                        )

                        if (
                            result
                            and result.get("id")
                        ):
                            configured = True
                            entry["api_key"] = api_key

                        else:
                            configured = False
                            enabled = False
                            error_text = (
                                "API Key inválida. "
                                "Verifique e tente novamente."
                            )

                    except RuntimeError as exc:
                        configured = False
                        enabled = False

                        error_text = (
                            f"{emoji.wrong} "
                            "**Erro ao validar a API Key**\n"
                            f"{exc}"
                        )

                    except Exception as exc:
                        configured = False
                        enabled = False

                        error_text = (
                            "Erro ao validar a API Key: "
                            f"{exc}"
                        )

                else:
                    configured = False
                    enabled = False

                    error_text = (
                        "API Key inválida. "
                        "Ela deve começar com `vp_`."
                    )

            else:
                configured = False

                if enabled:
                    enabled = False

                    error_text = (
                        "Informe sua API Key "
                        "para ativar a Zuros Wallet."
                    )

            if cover_fee is not None:
                entry["cover_fee"] = (
                    cover_fee == "true"
                )

        # ═════════════════════════════════════════
        # PIX MANUAL
        # ═════════════════════════════════════════

        elif self.provider_key == "pix_manual":

            import re

            pix_key_value = valores.get(
                "pix_manual_key"
            )

            pix_key_type = valores.get(
                "pix_manual_key_type"
            )

            if isinstance(
                pix_key_type,
                (list, tuple),
            ):
                pix_key_type = (
                    pix_key_type[0]
                    if pix_key_type
                    else None
                )

            pix_key = (
                pix_key_value.strip()
                if pix_key_value
                else entry.get("pix_key")
            )

            pix_key_type = (
                pix_key_type
                or entry.get("pix_key_type")
            )

            is_valid = False

            if pix_key and pix_key_type:

                # EMAIL
                if pix_key_type == "email":
                    is_valid = bool(
                        re.fullmatch(
                            r"[A-Za-z0-9._%+-]+"
                            r"@[A-Za-z0-9.-]+"
                            r"\.[A-Za-z]{2,}",
                            pix_key,
                        )
                    )

                    if not is_valid:
                        error_text = (
                            "Email inválido."
                        )

                # TELEFONE
                elif pix_key_type == "telefone":

                    clean = re.sub(
                        r"\D",
                        "",
                        pix_key,
                    )

                    is_valid = (
                        10 <= len(clean) <= 13
                    )

                    if not is_valid:
                        error_text = (
                            "Número de telefone inválido."
                        )

                # CPF
                elif pix_key_type == "cpf":

                    clean = re.sub(
                        r"\D",
                        "",
                        pix_key,
                    )

                    is_valid = (
                        len(clean) == 11
                        and len(set(clean)) > 1
                    )

                    if is_valid:
                        digits = [
                            int(d)
                            for d in clean
                        ]

                        soma = sum(
                            digits[i] * (10 - i)
                            for i in range(9)
                        )

                        primeiro = (
                            0
                            if soma % 11 < 2
                            else 11 - soma % 11
                        )

                        soma = sum(
                            digits[i] * (11 - i)
                            for i in range(10)
                        )

                        segundo = (
                            0
                            if soma % 11 < 2
                            else 11 - soma % 11
                        )

                        is_valid = (
                            digits[9] == primeiro
                            and digits[10] == segundo
                        )

                    if not is_valid:
                        error_text = "CPF inválido."

                # CNPJ
                elif pix_key_type == "cnpj":

                    clean = re.sub(
                        r"\D",
                        "",
                        pix_key,
                    )

                    is_valid = (
                        len(clean) == 14
                        and len(set(clean)) > 1
                    )

                    if is_valid:
                        digits = [
                            int(d)
                            for d in clean
                        ]

                        weights1 = [
                            5, 4, 3, 2,
                            9, 8, 7, 6,
                            5, 4, 3, 2,
                        ]

                        soma = sum(
                            digits[i]
                            * weights1[i]
                            for i in range(12)
                        )

                        primeiro = (
                            0
                            if soma % 11 < 2
                            else 11 - soma % 11
                        )

                        weights2 = [
                            6, 5, 4, 3, 2,
                            9, 8, 7, 6,
                            5, 4, 3, 2,
                        ]

                        soma = sum(
                            digits[i]
                            * weights2[i]
                            for i in range(13)
                        )

                        segundo = (
                            0
                            if soma % 11 < 2
                            else 11 - soma % 11
                        )

                        is_valid = (
                            digits[12] == primeiro
                            and digits[13] == segundo
                        )

                    if not is_valid:
                        error_text = "CNPJ inválido."

                # ALEATÓRIA
                elif pix_key_type == "aleatoria":

                    is_valid = (
                        8 <= len(pix_key) <= 100
                    )

                    if not is_valid:
                        error_text = (
                            "Chave PIX aleatória inválida."
                        )

            configured = is_valid

            if configured:
                entry["pix_key"] = pix_key
                entry["pix_key_type"] = (
                    pix_key_type
                )

            elif enabled:
                enabled = False

                if not error_text:
                    error_text = (
                        "Informe uma chave PIX válida."
                    )

        # ═════════════════════════════════════════
        # MERCADO PAGO
        # ═════════════════════════════════════════

        elif self.provider_key == "mercado_pago":

            new_token = valores.get(
                "mercado_pago_access_token"
            )

            old_token = entry.get(
                "access_token"
            )

            token = (
                new_token.strip()
                if new_token
                else old_token
            )

            if token:

                try:
                    timeout = aiohttp.ClientTimeout(
                        total=10
                    )

                    async with aiohttp.ClientSession(
                        timeout=timeout
                    ) as session:

                        headers = {
                            "Authorization": (
                                f"Bearer {token}"
                            )
                        }

                        async with session.get(
                            "https://api.mercadopago.com/"
                            "users/me",
                            headers=headers,
                        ) as response:

                            configured = (
                                response.status == 200
                            )

                except aiohttp.ClientError:
                    configured = False

                except TimeoutError:
                    configured = False

                if configured:
                    entry["access_token"] = token

                elif enabled:
                    enabled = False

                    error_text = (
                        "Access Token do Mercado Pago "
                        "inválido ou expirado."
                    )

            else:
                configured = False

                if enabled:
                    enabled = False

                    error_text = (
                        "Informe o Access Token "
                        "do Mercado Pago."
                    )

        # ═════════════════════════════════════════
        # EFI BANK
        # ═════════════════════════════════════════

        elif self.provider_key == "efibank":

            client_id = valores.get(
                "efibank_client_id"
            )

            client_secret = valores.get(
                "efibank_client_secret"
            )

            pix_key = valores.get(
                "efibank_pix_key"
            )

            cert_value = valores.get(
                "efibank_cert_file"
            )

            cert_file = None

            if isinstance(
                cert_value,
                (list, tuple),
            ):
                cert_file = (
                    cert_value[0]
                    if cert_value
                    else None
                )
            else:
                cert_file = cert_value

            cert_path = entry.get(
                "cert_file"
            )

            if cert_file:

                try:
                    filename = (
                        cert_file.filename
                        or ""
                    )

                    if not filename.lower().endswith(
                        ".p12"
                    ):
                        error_text = (
                            "O certificado da Efi "
                            "deve ser um arquivo `.p12`."
                        )

                    else:
                        base_dir = (
                            Path(__file__)
                            .resolve()
                            .parents[3]
                            / "database"
                            / "payments"
                            / "certs"
                            / "efibank"
                        )

                        base_dir.mkdir(
                            parents=True,
                            exist_ok=True,
                        )

                        save_path = (
                            base_dir
                            / (
                                f"cert_"
                                f"{inter.author.id}.p12"
                            )
                        )

                        data = (
                            await cert_file.read()
                        )

                        with save_path.open(
                            "wb"
                        ) as fp:
                            fp.write(data)

                        cert_path = str(save_path)

                except Exception as exc:
                    error_text = (
                        "Erro ao processar "
                        "o certificado: "
                        f"{exc}"
                    )

            if client_id is not None:
                entry["client_id"] = (
                    client_id.strip()
                )

            if client_secret is not None:
                entry["client_secret"] = (
                    client_secret.strip()
                )

            if pix_key is not None:
                entry["pix_key"] = (
                    pix_key.strip()
                )

            if cert_path:
                entry["cert_file"] = (
                    cert_path
                )

            cert_exists = (
                bool(entry.get("cert_file"))
                and Path(
                    entry["cert_file"]
                ).exists()
            )

            configured = bool(
                entry.get("client_id")
                and entry.get("client_secret")
                and entry.get("pix_key")
                and cert_exists
            )

            if enabled and not configured:
                enabled = False

                if not error_text:
                    error_text = (
                        "Para ativar a Efi Bank, "
                        "informe Client ID, "
                        "Client Secret, chave PIX "
                        "e certificado `.p12`."
                    )

        # ═════════════════════════════════════════
        # PUSHIN PAY
        # ═════════════════════════════════════════

        elif self.provider_key == "pushinpay":

            token_value = valores.get(
                "pushinpay_token"
            )

            if token_value is not None:
                entry["token_pushinpay"] = (
                    token_value.strip()
                )

            configured = bool(
                entry.get("token_pushinpay")
            )

            if enabled and not configured:
                enabled = False

                error_text = (
                    "Informe o token da Pushin Pay "
                    "para ativar o provedor."
                )

        # ═════════════════════════════════════════
        # MISTICPAY
        # ═════════════════════════════════════════

        elif self.provider_key == "misticpay":

            client_id = valores.get(
                "misticpay_client_id"
            )

            client_secret = valores.get(
                "misticpay_client_secret"
            )

            if client_id is not None:
                entry["client_id"] = (
                    client_id.strip()
                )

            if client_secret is not None:
                entry["client_secret"] = (
                    client_secret.strip()
                )

            configured = bool(
                entry.get("client_id")
                and entry.get("client_secret")
            )

            if enabled and not configured:
                enabled = False

                error_text = (
                    "Informe Client ID e "
                    "Client Secret do MisticPay."
                )

        # ═════════════════════════════════════════
        # SALVAR
        # ═════════════════════════════════════════

        entry["enabled"] = enabled

        config[self.provider_key] = entry

        db.save_document(
            "payment_configs",
            config,
        )

        pagamentos = (
            db.get_document("pagamentos")
            or {}
        )

        pagamentos[self.provider_key] = enabled

        db.save_document(
            "pagamentos",
            {},
            pagamentos,
        )

        # ═════════════════════════════════════════
        # ATUALIZAR PAINEL
        # ═════════════════════════════════════════

        if mode == "embed":

            embed, components = (
                ConfigurarPagamentos
                .pagamentos_embed(inter)
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:

            await inter.edit_original_message(
                components=(
                    ConfigurarPagamentos
                    .pagamentos_components(inter)
                )
            )

        # ═════════════════════════════════════════
        # ERRO
        # ═════════════════════════════════════════

        if error_text:
            await message.error(
                inter,
                error_text,
                followup=True,
            )


def setup(bot: commands.Bot):
    bot.add_cog(
        ConfigurarPagamentos(bot)
    )