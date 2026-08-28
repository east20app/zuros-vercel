"""
Sistema visual de registros de compras, carrinhos e entregas.
Versão com geração automática de imagem para o evento público de compra,
com layout estilo card/preview de compra.
"""

from datetime import datetime
import io
from typing import List, Optional

import aiohttp
import disnake
from disnake.ext import commands
from PIL import Image, ImageDraw, ImageFont, ImageOps

from functions.database import database as db
from functions.emoji import emoji
from functions.utils import utils


class PurchaseLogsSystem(commands.Cog):
    """Centraliza os registros internos e os eventos públicos da loja."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def _get_mode_and_color() -> tuple:
        mode_config = db.get_document("custom_mode") or {}
        color_config = db.get_document("custom_colors") or {}

        mode = mode_config.get("mode", "embed")
        primary_hex = color_config.get("primary")

        color = None
        if primary_hex:
            try:
                color = disnake.Colour(int(primary_hex.replace("#", ""), 16))
            except (ValueError, TypeError):
                pass

        return mode, color

    @staticmethod
    def _payment_name(payment_method: str) -> str:
        methods = {
            "pix": "PIX",
            "pix_manual": "PIX Manual",
            "card": "Cartão de Crédito",
            "crypto": "Criptomoeda",
            "mercado_pago": "Mercado Pago",
            "stripe": "Stripe",
            "paypal": "PayPal",
        }
        return methods.get(payment_method, payment_method.replace("_", " ").title())

    @staticmethod
    def _delivery_name(delivery_type: str) -> str:
        return "Entrega manual" if delivery_type == "manual" else "Entrega automática"

    @staticmethod
    def _create_stock_file(items: List[str]) -> disnake.File:
        lines = ["ITENS ENTREGUES", "=" * 46, ""]
        for index, item in enumerate(items, start=1):
            lines.append(f"{index:02d}. {item}")
        lines.extend(
            [
                "",
                "-" * 46,
                f"Total entregue: {len(items)} item(s)",
                f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}",
            ]
        )
        buffer = io.BytesIO("\n".join(lines).encode("utf-8"))
        buffer.seek(0)
        return disnake.File(buffer, filename="itens_entregues.txt")

    @staticmethod
    def _safe_items(items: Optional[List[str]]) -> List[str]:
        if not items or isinstance(items, bool):
            return []
        if isinstance(items, list):
            return items
        return list(items)

    @staticmethod
    def _order_reference(cart_id: Optional[str]) -> str:
        return cart_id or "Não informado"

    @staticmethod
    def _normalize_event_mode(raw_mode: str) -> str:
        aliases = {
            "components": "components",
            "component": "components",
            "components_v2": "components",
            "component_v2": "components",
            "v2": "components",
            "embed": "embed",
            "panel": "embed",
            "painel": "embed",
            "message": "message",
            "mensagem": "message",
            "normal": "message",
            "text": "message",
            "texto": "message",
            "image": "image",
            "imagem": "image",
            "preview": "image",
            "card": "image",
        }
        return aliases.get(str(raw_mode or "components").lower(), "components")

    @staticmethod
    def _font(size: int, bold: bool = False):
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        ]
        for path in font_paths:
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
        return ImageFont.load_default()

    @staticmethod
    def _fit_text(draw, text, font, max_width):
        text = str(text or "-")
        bbox = draw.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            return text

        while len(text) > 3:
            text = text[:-4].rstrip() + "..."
            bbox = draw.textbbox((0, 0), text, font=font)
            if (bbox[2] - bbox[0]) <= max_width:
                return text

        return text

    async def _download_avatar(self, user: disnake.User):
        try:
            avatar_url = str(user.display_avatar.replace(size=128).url)
        except Exception:
            return None

        try:
            timeout = aiohttp.ClientTimeout(total=8)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(avatar_url) as response:
                    if response.status != 200:
                        return None
                    data = await response.read()
            return Image.open(io.BytesIO(data)).convert("RGBA")
        except Exception:
            return None

    async def _create_purchase_event_image(
        self,
        guild_name: str,
        user: disnake.User,
        product_name: str,
        campo_name: str,
        quantity: int,
        price_display: str,
    ) -> disnake.File:
        """Gera uma arte no estilo do preview de compra enviado pelo usuário."""
        width, height = 900, 520
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        bg = (28, 31, 43, 255)
        line = (54, 58, 78, 255)
        success = (68, 193, 117, 255)
        text_main = (243, 245, 248, 255)
        text_soft = (151, 156, 171, 255)
        text_dim = (108, 114, 129, 255)

        draw.rounded_rectangle((0, 0, width, height), radius=24, fill=bg)

        name_font = self._font(18, bold=True)
        handle_font = self._font(14)
        date_font = self._font(14)
        status_font = self._font(17, bold=True)
        section_font = self._font(14, bold=True)
        product_font = self._font(24, bold=True)
        variation_font = self._font(15)
        price_font = self._font(18)
        total_label_font = self._font(15, bold=True)
        total_font = self._font(38, bold=True)
        mark_font = self._font(18, bold=True)
        initial_font = self._font(28, bold=True)

        avatar = await self._download_avatar(user)
        avatar_size = 68
        avatar_x, avatar_y = 32, 28

        if avatar is not None:
            avatar = ImageOps.fit(avatar, (avatar_size, avatar_size), method=Image.Resampling.LANCZOS)
            mask = Image.new("L", (avatar_size, avatar_size), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, avatar_size, avatar_size), fill=255)
            image.paste(avatar, (avatar_x, avatar_y), mask)
        else:
            draw.ellipse(
                (avatar_x, avatar_y, avatar_x + avatar_size, avatar_y + avatar_size),
                fill=(35, 39, 55, 255),
                outline=(60, 67, 88, 255),
                width=2,
            )
            initial = (getattr(user, "display_name", None) or getattr(user, "name", "U") or "U")[:1].upper()
            bbox = draw.textbbox((0, 0), initial, font=initial_font)
            tx = avatar_x + (avatar_size - (bbox[2] - bbox[0])) / 2
            ty = avatar_y + (avatar_size - (bbox[3] - bbox[1])) / 2 - 2
            draw.text((tx, ty), initial, font=initial_font, fill=success)

        display_name = getattr(user, "display_name", None) or getattr(user, "name", "Cliente")
        username = getattr(user, "name", "usuario")

        draw.text((118, 30), self._fit_text(draw, str(display_name), name_font, 420), font=name_font, fill=text_main)
        draw.text((118, 55), self._fit_text(draw, f"@{username}", handle_font, 420), font=handle_font, fill=text_soft)
        draw.text((width - 180, 34), datetime.now().strftime('%d/%m às %H:%M'), font=date_font, fill=text_soft)

        draw.line((32, 118, width - 32, 118), fill=line, width=1)
        draw.line((32, 204, width - 32, 204), fill=line, width=1)
        draw.line((32, 344, width - 32, 344), fill=line, width=1)

        icon_center = (36, 167)
        draw.ellipse((icon_center[0] - 14, icon_center[1] - 14, icon_center[0] + 14, icon_center[1] + 14), fill=success)
        draw.text((icon_center[0] - 6, icon_center[1] - 11), "✓", font=mark_font, fill=(255, 255, 255, 255))
        draw.text((66, 153), "Compra Realizada", font=status_font, fill=success)

        draw.text((32, 230), "PRODUTOS", font=section_font, fill=text_dim)
        product_title = self._fit_text(draw, f"{quantity}x {product_name}", product_font, 560)
        draw.text((32, 274), product_title, font=product_font, fill=text_main)

        if campo_name:
            variation_text = self._fit_text(draw, campo_name, variation_font, 560)
            draw.text((34, 308), variation_text, font=variation_font, fill=text_soft)

        price_bbox = draw.textbbox((0, 0), price_display, font=price_font)
        draw.text((width - 32 - (price_bbox[2] - price_bbox[0]), 280), price_display, font=price_font, fill=text_main)

        draw.text((32, 378), "TOTAL PAGO", font=total_label_font, fill=text_dim)
        draw.text((32, 420), price_display, font=total_font, fill=success)
        draw.text((width - 220, height - 34), guild_name, font=date_font, fill=text_soft)

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        return disnake.File(fp=buffer, filename="preview-compra.png")

    async def send_order_log(
        self,
        guild: disnake.Guild,
        user: disnake.User,
        product_name: str,
        campo_name: str,
        quantity: int,
        price: float,
        payment_method: str,
        items: Optional[List[str]] = None,
        delivery_type: str = "automatic",
        cart_id: Optional[str] = None,
    ):
        try:
            channels = db.get_document("canais") or {}
            log_channel_id = channels.get("canal_de_logs_de_pedidos")
            if not log_channel_id:
                print("[PEDIDOS] Canal de logs não configurado")
                return

            try:
                channel = guild.get_channel(int(log_channel_id))
            except (ValueError, TypeError) as error:
                print(f"[PEDIDOS] ID de canal inválido: {log_channel_id} - {error}")
                return

            if not channel:
                print(f"[PEDIDOS] Canal {log_channel_id} não encontrado")
                return

            mode, color = self._get_mode_and_color()
            payment_display = self._payment_name(payment_method)
            delivery_display = self._delivery_name(delivery_type)
            price_display = utils.format_price_brl(price)
            order_reference = self._order_reference(cart_id)
            items = self._safe_items(items)

            if mode == "embed":
                embed = disnake.Embed(
                    title="Pedido confirmado",
                    description=(
                        f"{emoji.correct} A compra foi processada e registrada com sucesso.\n"
                        f"-# Referência do pedido: `{order_reference}`"
                    ),
                    color=color or disnake.Color.green(),
                    timestamp=datetime.now(),
                )
                embed.add_field(name=f"{emoji.member} Cliente", value=f"{user.mention}\n-# ID: `{user.id}`", inline=True)
                embed.add_field(name=f"{emoji.bag} Produto", value=f"**{product_name}**\n-# {campo_name}", inline=True)
                embed.add_field(name=f"{emoji.cart} Quantidade", value=f"`{quantity}x`", inline=True)
                embed.add_field(name=f"{emoji.dollar} Pagamento", value=f"**{price_display}**\n-# {payment_display}", inline=True)
                embed.add_field(name=f"{emoji.truck if delivery_type == 'manual' else emoji.correct} Entrega", value=delivery_display, inline=True)
                embed.add_field(name="Identificação", value=f"`{order_reference}`", inline=True)
                embed.set_footer(text=f"Registro de venda • {guild.name}", icon_url=guild.icon.url if guild.icon else None)
                log_message = await channel.send(embed=embed)
            else:
                container_kwargs = {}
                if color:
                    container_kwargs["accent_colour"] = color
                container = disnake.ui.Container(
                    disnake.ui.TextDisplay(f"# {emoji.correct} Pedido confirmado\n-# Compra processada com sucesso • `{order_reference}`"),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.member} Cliente\n{user.mention}\n-# ID da conta: `{user.id}`"),
                    disnake.ui.TextDisplay(f"### {emoji.bag} Resumo do pedido\n**{product_name}**\n-# Variação: {campo_name}\n-# Quantidade: `{quantity}x`"),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.dollar} Pagamento\n**{price_display}**\n-# Método utilizado: {payment_display}"),
                    disnake.ui.TextDisplay(f"### {emoji.truck if delivery_type == 'manual' else emoji.correct} Entrega\n**{delivery_display}**\n-# Referência: `{order_reference}`"),
                    **container_kwargs,
                )
                log_message = await channel.send(components=[container], flags=disnake.MessageFlags(is_components_v2=True))

            if items and log_message:
                try:
                    stock_file = self._create_stock_file(items)
                    await log_message.reply(
                        f"{emoji.cardbox} **Conteúdo entregue ao cliente**\n"
                        f"-# {len(items)} item(s) registrados no arquivo abaixo.",
                        file=stock_file,
                    )
                except Exception as error:
                    print(f"[PEDIDOS] Falha ao anexar itens entregues: {error}")

            print(f"[PEDIDOS] Registro enviado para {channel.name} ({mode})")
        except Exception as error:
            print(f"[PEDIDOS] Erro ao enviar registro: {error}")
            import traceback
            traceback.print_exc()

    async def send_cart_created_log(
        self,
        guild: disnake.Guild,
        user: disnake.User,
        product_name: str,
        campo_name: str,
        quantity: int,
        price: float,
        payment_method: str,
        cart_url: str,
        cart_id: str,
    ):
        try:
            channels = db.get_document("canais") or {}
            log_channel_id = channels.get("canal_de_logs_de_pedidos")
            if not log_channel_id:
                print("[CARRINHO] Canal de logs não configurado")
                return

            try:
                channel = guild.get_channel(int(log_channel_id))
            except (ValueError, TypeError) as error:
                print(f"[CARRINHO] ID de canal inválido: {log_channel_id} - {error}")
                return

            if not channel:
                print(f"[CARRINHO] Canal {log_channel_id} não encontrado")
                return

            mode, color = self._get_mode_and_color()
            payment_display = self._payment_name(payment_method)
            price_display = utils.format_price_brl(price)

            button = disnake.ui.ActionRow(
                disnake.ui.Button(label="Visualizar carrinho", style=disnake.ButtonStyle.link, url=cart_url, emoji=emoji.cart)
            )

            if mode == "embed":
                embed = disnake.Embed(
                    title="Carrinho iniciado",
                    description="Um cliente avançou para a etapa de pagamento.\n-# O pedido ainda não foi confirmado.",
                    color=color or disnake.Color.blue(),
                    timestamp=datetime.now(),
                )
                embed.add_field(name=f"{emoji.member} Cliente", value=f"{user.mention}\n-# `{user.id}`", inline=True)
                embed.add_field(name=f"{emoji.bag} Item selecionado", value=f"**{product_name}**\n-# {campo_name}", inline=True)
                embed.add_field(name=f"{emoji.cart} Quantidade", value=f"`{quantity}x`", inline=True)
                embed.add_field(name=f"{emoji.dollar} Total", value=f"**{price_display}**", inline=True)
                embed.add_field(name="Forma de pagamento", value=payment_display, inline=True)
                embed.add_field(name="Status", value="Aguardando pagamento", inline=True)
                embed.set_footer(text=f"Carrinho {cart_id} • {guild.name}", icon_url=guild.icon.url if guild.icon else None)
                await channel.send(embed=embed, components=[button])
            else:
                container_kwargs = {}
                if color:
                    container_kwargs["accent_colour"] = color
                container = disnake.ui.Container(
                    disnake.ui.TextDisplay(f"# {emoji.cart} Carrinho iniciado\n-# Aguardando confirmação do pagamento • `{cart_id}`"),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.member} Cliente\n{user.mention}\n-# ID: `{user.id}`"),
                    disnake.ui.TextDisplay(f"### {emoji.bag} Seleção\n**{product_name}**\n-# {campo_name} • `{quantity}x`"),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.dollar} Pagamento\n**{price_display}**\n-# {payment_display} • Aguardando pagamento"),
                    **container_kwargs,
                )
                await channel.send(components=[container, button], flags=disnake.MessageFlags(is_components_v2=True))

            print(f"[CARRINHO] Registro enviado para {channel.name} ({mode})")
        except Exception as error:
            print(f"[CARRINHO] Erro ao enviar registro: {error}")
            import traceback
            traceback.print_exc()

    async def send_purchase_event(
        self,
        guild: disnake.Guild,
        user: disnake.User,
        product_name: str,
        campo_name: str,
        quantity: int,
        price: float,
        product_id: str,
    ):
        try:
            channels = db.get_document("canais") or {}
            event_channel_id = channels.get("canal_de_evento_de_compras")
            if not event_channel_id:
                print("[EVENTO] Canal de eventos não configurado")
                return

            try:
                channel = guild.get_channel(int(event_channel_id))
            except (ValueError, TypeError) as error:
                print(f"[EVENTO] ID de canal inválido: {event_channel_id} - {error}")
                return

            if not channel:
                print(f"[EVENTO] Canal {event_channel_id} não encontrado")
                return

            products = db.get_document("loja_products") or {}
            product = products.get(product_id, {})
            product_url = None
            product_messages = product.get("messages", [])

            if product_messages:
                latest_message = max(product_messages, key=lambda message: message.get("created_at", 0))
                product_channel_id = latest_message.get("channel_id")
                product_guild_id = latest_message.get("guild_id")
                product_message_id = latest_message.get("message_id")
                if product_channel_id and product_message_id and product_guild_id == guild.id:
                    product_url = f"https://discord.com/channels/{guild.id}/{product_channel_id}/{product_message_id}"

            global_mode, default_color = self._get_mode_and_color()
            personalization = db.get_document("loja_personalization") or {}
            event_config = personalization.get("purchase_event") or {}

            raw_event_mode = event_config.get("mode") or global_mode or "components"
            event_mode = self._normalize_event_mode(raw_event_mode)
            event_image = str(event_config.get("image", "") or "").strip()
            price_display = utils.format_price_brl(price)

            action_row = None
            if product_url:
                action_row = disnake.ui.ActionRow(
                    disnake.ui.Button(label="Ver produto", style=disnake.ButtonStyle.link, url=product_url, emoji=emoji.cart)
                )

            generated_card = None
            if event_mode == "image":
                try:
                    generated_card = await self._create_purchase_event_image(
                        guild.name,
                        user,
                        product_name,
                        campo_name,
                        quantity,
                        price_display,
                    )
                except Exception as error:
                    print(f"[EVENTO] Falha ao gerar imagem automática: {error}")

            # 1) IMAGEM AUTOMÁTICA — opção independente
            if event_mode == "image":
                if generated_card:
                    send_kwargs = {"file": generated_card}
                    if action_row:
                        send_kwargs["components"] = [action_row]
                    await channel.send(**send_kwargs)
                else:
                    fallback = (
                        f"{emoji.sparkles} **Compra confirmada**\n"
                        f"{user.mention} comprou **{product_name}** • `{quantity}x` • **{price_display}**"
                    )
                    await channel.send(
                        content=fallback,
                        components=[action_row] if action_row else None,
                    )

            # 2) PAINEL NORMAL / EMBED
            elif event_mode == "embed":
                embed = disnake.Embed(
                    title="Compra confirmada",
                    description=(
                        f"{emoji.sparkles} {user.mention} acabou de fazer uma compra.\n\n"
                        f"{emoji.bag} **{product_name}**\n"
                        f"-# {campo_name} • `{quantity}x`\n\n"
                        f"{emoji.coin} **{price_display}**"
                    ),
                    color=disnake.Color.green(),
                    timestamp=datetime.now(),
                )
                send_kwargs = {"embed": embed}

                if event_image:
                    embed.set_image(url=event_image)

                embed.set_footer(text=f"Compra realizada em {guild.name}", icon_url=guild.icon.url if guild.icon else None)
                if action_row:
                    send_kwargs["components"] = [action_row]
                await channel.send(**send_kwargs)

            elif event_mode == "message":
                content = (
                    f"## {emoji.sparkles} Compra confirmada\n"
                    f"{user.mention} acabou de comprar **{product_name}**.\n\n"
                    f"> {emoji.bag} **Produto:** {product_name}\n"
                    f"> **Opção:** {campo_name}\n"
                    f"> **Quantidade:** `{quantity}x`\n"
                    f"> {emoji.coin} **Valor:** {price_display}"
                )
                send_kwargs = {"content": content}

                if event_image:
                    send_kwargs["content"] += f"\n\n{event_image}"

                if action_row:
                    send_kwargs["components"] = [action_row]
                await channel.send(**send_kwargs)

            # 4) COMPONENTS V2
            else:
                container_children = [
                    disnake.ui.TextDisplay(
                        f"# {emoji.sparkles} Compra confirmada\n"
                        "-# Um novo pedido foi concluído com sucesso"
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(
                        f"{emoji.member} **Cliente**\n{user.mention}\n\n"
                        f"{emoji.bag} **Produto**\n**{product_name}**\n"
                        f"-# {campo_name} • `{quantity}x`\n\n"
                        f"{emoji.coin} **Total**\n**{price_display}**"
                    ),
                ]

                if event_image:
                    container_children.extend(
                        [
                            disnake.ui.Separator(),
                            disnake.ui.MediaGallery(
                                disnake.MediaGalleryItem(
                                    event_image,
                                    description=f"Imagem de {product_name}",
                                )
                            ),
                        ]
                    )

                if action_row:
                    container_children.extend([disnake.ui.Separator(), action_row])

                container = disnake.ui.Container(*container_children)
                await channel.send(
                    components=[container],
                    flags=disnake.MessageFlags(is_components_v2=True),
                )

            print(f"[EVENTO] Compra publicada em {channel.name} ({event_mode})")
        except Exception as error:
            print(f"[EVENTO] Erro ao publicar compra: {error}")
            import traceback
            traceback.print_exc()


def setup(bot: commands.Bot):
    bot.add_cog(PurchaseLogsSystem(bot))
