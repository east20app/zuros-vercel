"""
Sistema de entrega automática de produtos
"""
import disnake
import io
from datetime import datetime
from typing import List, Optional
from functions.emoji import emoji
from functions.database import database as db
from functions.utils import utils
from .stock_manager import StockManager


def _color_to_int(value) -> Optional[int]:
    """Converte cores persistidas sem interromper a entrega por configuração inválida."""
    if value is None:
        return None
    try:
        return int(str(value).strip().lstrip("#"), 16)
    except (TypeError, ValueError):
        return None


def _get_display_mode() -> str:
    """Retorna o modo visual configurado, com fallback compatível."""
    mode_config = db.get_document("custom_mode") or {}
    if not isinstance(mode_config, dict):
        return "components"
    return mode_config.get("mode", "components")


def _create_stock_file(items: List[str]) -> disnake.File:
    """Cria arquivo .txt com os itens do estoque (apenas conteúdo)"""
    content = "\n".join(items)

    file_buffer = io.BytesIO(content.encode('utf-8'))
    file_buffer.seek(0)
    return disnake.File(file_buffer, filename="seus_itens.txt")


async def deliver_product_to_user(
    user: disnake.User,
    product_name: str,
    campo_name: str,
    quantity: int,
    items: List[str],
    thread: Optional[disnake.Thread] = None,
    guild: Optional[disnake.Guild] = None,
    instructions: Optional[str] = None,
    product_id: Optional[str] = None,
    campo_id: Optional[str] = None
) -> bool:
    """
    Entrega o produto ao usuário via DM
    Retorna True se a entrega foi bem-sucedida
    """
    try:
        mode = _get_display_mode()
        colors = db.get_document("custom_colors") or {}
        colors = colors if isinstance(colors, dict) else {}
        color = _color_to_int(colors.get("primary"))

        # O incentivo de avaliação será incorporado ao segundo painel, em vez
        # de ser enviado como uma terceira mensagem visual.
        feedback_text = None
        feedback_row = None
        personalization = db.get_document("loja_personalization") or {}
        if isinstance(personalization, dict):
            feedback_config = personalization.get("feedback_incentive", {})
            if isinstance(feedback_config, dict) and feedback_config.get("message"):
                feedback_text = str(feedback_config.get("message"))
                feedback_button_text = str(
                    feedback_config.get("button_text", "Deixar Avaliação")
                )
                canais = db.get_document("canais") or {}
                if isinstance(canais, dict) and canais.get("canal_de_feedback") and guild:
                    feedback_url = (
                        f"https://discord.com/channels/{guild.id}/"
                        f"{canais['canal_de_feedback']}"
                    )
                    feedback_row = disnake.ui.ActionRow(
                        disnake.ui.Button(
                            label=feedback_button_text[:80],
                            style=disnake.ButtonStyle.link,
                            url=feedback_url,
                            emoji=emoji.star
                        )
                    )

        # Cada item permanece em uma linha, mantendo o formato do botão de cópia.
        items_content = "\n".join(f"`{item}`" for item in items)
        content_length = len(items_content)
        
        # Verificar se precisa criar arquivo
        stock_file = None
        use_file = content_length > 2000
        
        # Verificar se deve mostrar botão de copiar (só se conteúdo <= 2000 caracteres)
        show_copy_button = content_length <= 2000

        if use_file:
            stock_file = _create_stock_file(items)
            display_text = f"*Arquivo anexado com {len(items)} item(s)*"
        else:
            display_text = items_content

        if mode == "embed":
            # Modo Embed - mostrar apenas o conteúdo
            embed = disnake.Embed(
                title=f"{emoji.cardbox} Pedido entregue",
                description=(
                    "Sua compra foi entregue com sucesso.\n"
                    f"**Produto:** `{product_name}`\n"
                    f"**Opção:** `{campo_name}`  •  **Quantidade:** `{quantity}`"
                ),
                color=color or disnake.Color.green(),
                timestamp=datetime.utcnow()
            )

            if not use_file:
                embed.add_field(
                    name=f"Seus Itens",
                    value=display_text[:1024],
                    inline=False
                )
            else:
                embed.add_field(
                    name=f"Seus Itens",
                    value=display_text,
                    inline=False
                )

            embed.set_footer(text=f"Obrigado pela compra! {emoji.gift} • Guarde esta mensagem")
            
            # Adicionar instruções se existirem
            instructions_truncated = None
            if instructions:
                # Truncar instruções para exibição (limite do Discord para embed field value é 1024)
                if len(instructions) > 1024:
                    instructions_truncated = instructions[:1021] + "..."
                else:
                    instructions_truncated = instructions
                embed.add_field(
                    name=f"{emoji.alert} Instruções",
                    value=instructions_truncated,
                    inline=False
                )
            
            # Adicionar o incentivo de avaliação no mesmo envio.
            if feedback_text:
                embed.add_field(
                    name=f"{emoji.star} Avalie seu pedido",
                    value=feedback_text[:1024],
                    inline=False
                )

            # Adicionar botões de copiar
            components = []
            button_row = []
            
            # Botão de copiar conteúdo do produto
            if show_copy_button:
                button_row.append(
                    disnake.ui.Button(
                        label="Copiar Conteúdo",
                        emoji=emoji.cardbox,
                        style=disnake.ButtonStyle.grey,
                        custom_id=f"copy_delivered_content:{user.id}"
                    )
                )
            
            # Botão de copiar instruções (se houver instruções e product_id/campo_id disponíveis)
            if instructions and product_id and campo_id:
                button_row.append(
                    disnake.ui.Button(
                        label="Copiar Instruções",
                        emoji=emoji.alert,
                        style=disnake.ButtonStyle.grey,
                        custom_id=f"copy_instructions:{user.id}:{product_id}:{campo_id}"
                    )
                )
            
            if button_row:
                components = [disnake.ui.ActionRow(*button_row)]
            if feedback_row:
                components.append(feedback_row)

            if stock_file:
                await user.send(embed=embed, file=stock_file, components=components if components else None)
            else:
                await user.send(embed=embed, components=components if components else None)

        else:
            # Modo Container: painel único com o formato solicitado.
            container_kwargs = {"accent_colour": disnake.Colour(color)} if color else {}
            item_display = (
                display_text[:1500] if not use_file
                else "-# Os itens completos seguem no arquivo anexado."
            )
            server_name = getattr(guild, "name", None) or "Loja"
            server_icon = getattr(getattr(guild, "icon", None), "url", None)
            delivered_at = datetime.now().strftime("%d/%m/%Y, %H:%M")

            # A Section com Thumbnail reproduz o ícone do servidor no cabeçalho.
            # O fallback textual mantém compatibilidade caso a versão do disnake
            # não disponibilize Section/Thumbnail.
            header_text = [
                disnake.ui.TextDisplay(f"## {emoji.cardbox} Entrega Realizada"),
                disnake.ui.TextDisplay("-# Seu produto foi anexado a esta mensagem")
            ]
            section_type = getattr(disnake.ui, "Section", None)
            thumbnail_type = getattr(disnake.ui, "Thumbnail", None)
            if server_icon and section_type and thumbnail_type:
                try:
                    header = section_type(
                        *header_text,
                        accessory=thumbnail_type(server_icon)
                    )
                except (TypeError, ValueError):
                    header = header_text
            else:
                header = header_text

            delivery_panel = []
            if isinstance(header, list):
                delivery_panel.extend(header)
            else:
                delivery_panel.append(header)
            delivery_panel.extend([
                disnake.ui.TextDisplay(
                    f"-# **Produto:** `{product_name}`\n"
                    f" • **Opção:** `{campo_name}`\n"
                    f" • **Quantidade:** `{quantity}`"
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(f"### {emoji.bag} seu produto abaixo!!"),
                disnake.ui.TextDisplay(item_display)
            ])
            if instructions:
                instructions_truncated = instructions[:900] + "..." if len(instructions) > 900 else instructions
                delivery_panel.extend([
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.alert} Instruções"),
                    disnake.ui.TextDisplay(instructions_truncated)
                ])
            if feedback_text:
                delivery_panel.extend([
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(f"### {emoji.star} Avalie seu pedido"),
                    disnake.ui.TextDisplay(feedback_text[:900])
                ])
            delivery_panel.extend([
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(f"-# {server_name} • {delivered_at}"),
                disnake.ui.TextDisplay("-# Obrigado pela preferência • Loja")
            ])
            components = [disnake.ui.Container(*delivery_panel, **container_kwargs)]

            # Três ações em uma linha própria, fora do painel, como na referência.
            button_row = []
            if show_copy_button:
                button_row.append(
                    disnake.ui.Button(
                        label="Copiar produto entregue",
                        emoji=emoji.cardbox,
                        style=disnake.ButtonStyle.grey,
                        custom_id=f"copy_delivered_content:{user.id}"
                    )
                )
            if product_id and campo_id:
                button_row.append(
                    disnake.ui.Button(
                        label="Avisar atualizações de estoque",
                        emoji=emoji.alert,
                        style=disnake.ButtonStyle.grey,
                        custom_id=f"notify_stock:{product_id}:{campo_id}"
                    )
                )
            purchase_url = None
            if thread:
                purchase_url = getattr(thread, "jump_url", None)
                if not purchase_url and guild:
                    purchase_url = f"https://discord.com/channels/{guild.id}/{thread.id}"
            if purchase_url:
                button_row.append(
                    disnake.ui.Button(
                        label="Comprar novamente",
                        emoji=emoji.cart,
                        style=disnake.ButtonStyle.link,
                        url=purchase_url
                    )
                )
            if button_row:
                components.append(disnake.ui.ActionRow(*button_row[:5]))

            # Enviar um único painel; o arquivo continua separado quando necessário.
            await user.send(components=components, flags=disnake.MessageFlags(is_components_v2=True))
            if stock_file:
                await user.send(file=stock_file)


        # Se houver thread, enviar confirmação (content simples)
        # Não enviar aqui - será enviado em _handle_payment_approved como reply

        return True

    except disnake.Forbidden:
        # Usuário bloqueou DMs - Entregar no carrinho (content simples)
        if thread:
            # Calcular conteúdo puro (sem numeração) - cada item em uma linha com `
            items_content = "\n".join([f"`{item}`" for item in items])
            content_length = len(items_content)
            use_file = content_length > 2000
            
            if use_file:
                stock_file = _create_stock_file(items)
                display_text = f"*Arquivo anexado com {len(items)} item(s)*"
            else:
                stock_file = None
                display_text = items_content
            
            # Avisar que a DM está fechada
            await thread.send(
                f"{emoji.warn} **DM Fechada**\n{user.mention}, suas mensagens diretas estão desativadas!\nOs itens serão entregues aqui no carrinho."
            )
            
            # Entregar os itens no carrinho (apenas conteúdo)
            delivery_message = f"# {emoji.correct} **Produto Entregue!**\n\n"
            
            if use_file:
                delivery_message += f"**Seus Itens:** *Arquivo anexado com {len(items)} item(s)*"
            else:
                delivery_message += f"**Seus Itens:**\n{display_text}"
            
            # Adicionar instruções se existirem
            if instructions:
                delivery_message += f"\n\n**Instruções:**\n{instructions}"
            
            if use_file:
                await thread.send(
                    content=delivery_message,
                    file=stock_file
                )
            else:
                await thread.send(content=delivery_message)
            
            return True  # Entrega bem-sucedida no carrinho
        
        return False

    except Exception as e:
        if thread:
            # Mensagem de erro (content simples)
            await thread.send(
                f"{emoji.wrong} **Erro na Entrega**\nErro ao entregar produto: {str(e)}"
            )
        return False


async def _send_feedback_incentive(user: disnake.User, guild: Optional[disnake.Guild]):
    """Envia mensagem de incentivo de feedback"""
    try:
        config = db.get_document("loja_personalization") or {}
        config = config if isinstance(config, dict) else {}
        feedback_config = config.get("feedback_incentive", {})
        feedback_config = feedback_config if isinstance(feedback_config, dict) else {}

        if not feedback_config.get("message"):
            return

        mode = _get_display_mode()
        colors = db.get_document("custom_colors") or {}
        colors = colors if isinstance(colors, dict) else {}
        color = _color_to_int(colors.get("primary"))

        message_text = feedback_config.get("message", "")
        button_text = feedback_config.get("button_text", "Deixar Avaliação")

        # Obter canal de avaliações se existir
        canais = db.get_document("canais") or {}
        canais = canais if isinstance(canais, dict) else {}
        feedback_channel_id = canais.get("canal_de_feedback")

        components_list = []
        if feedback_channel_id and guild:
            feedback_url = f"https://discord.com/channels/{guild.id}/{feedback_channel_id}"
            components_list = [
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label=button_text,
                        style=disnake.ButtonStyle.link,
                        url=feedback_url,
                        emoji=emoji.star
                    )
                )
            ]

        if mode == "embed":
            embed = disnake.Embed(
                description=message_text,
                color=color or disnake.Color.blurple()
            )
            await user.send(embed=embed, components=components_list if components_list else None)
        else:
            container_kwargs = {}
            if color:
                container_kwargs["accent_colour"] = disnake.Colour(color)

            main_components = [
                disnake.ui.Container(
                    disnake.ui.TextDisplay(message_text),
                    **container_kwargs
                )
            ]

            if components_list:
                main_components.extend(components_list)

            await user.send(components=main_components, flags=disnake.MessageFlags(is_components_v2=True))

    except Exception:
        pass


async def process_automatic_delivery(
    user: disnake.User,
    product_id: str,
    campo_id: str,
    product_name: str,
    campo_name: str,
    quantity: int,
    thread: Optional[disnake.Thread] = None,
    guild: Optional[disnake.Guild] = None
) -> bool:
    """
    Processa a entrega automática de um produto
    Retorna True se a entrega foi bem-sucedida
    """
    
    # A retirada centralizada faz a validação final de quantidade e saldo.
    # Evitamos uma leitura prévia para não decidir com base em estoque desatualizado.
    items = StockManager.get_stock_items(product_id, campo_id, quantity)
    if items is None:
        # Sem estoque suficiente
        if thread:
            mode = _get_display_mode()
            if mode == "embed":
                error_embed = disnake.Embed(
                    title=f"{emoji.wrong} Estoque Insuficiente",
                    description=(
                        f"Não há estoque suficiente para entregar este produto.\n"
                        f"Por favor, entre em contato com um administrador."
                    ),
                    color=disnake.Color.red()
                )
                await thread.send(embed=error_embed)
            else:
                await thread.send(
                    components=[
                        disnake.ui.Container(
                            disnake.ui.TextDisplay(f"# {emoji.wrong} Estoque Insuficiente"),
                            disnake.ui.Separator(),
                            disnake.ui.TextDisplay(
                                f"Não há estoque suficiente para entregar este produto.\n"
                                f"Por favor, entre em contato com um administrador."
                            ),
                            accent_colour=disnake.Colour.red()
                        )
                    ],
                    flags=disnake.MessageFlags(is_components_v2=True)
                )
        return False

    # Buscar instruções do campo
    products = db.get_document("loja_products") or {}
    products = products if isinstance(products, dict) else {}
    product = products.get(product_id, {})
    product = product if isinstance(product, dict) else {}
    fields = product.get("campos", {})
    fields = fields if isinstance(fields, dict) else {}
    campo = fields.get(campo_id, {})
    campo = campo if isinstance(campo, dict) else {}
    instructions = campo.get("instructions")
    
    # Entregar ao usuário
    success = await deliver_product_to_user(
        user=user,
        product_name=product_name,
        campo_name=campo_name,
        quantity=quantity,
        items=items,
        thread=thread,
        guild=guild,
        instructions=instructions,
        product_id=product_id,
        campo_id=campo_id
    )

    if not success:
        # Devolver itens ao estoque
        StockManager.return_stock_items(product_id, campo_id, items)
        return False
    
    # Logs são enviados centralmente em _handle_payment_approved para evitar duplicação
    # Não enviar logs aqui para evitar duplicação quando há múltiplos produtos no carrinho
    
    return success


async def send_payment_approved_dm(
    user: disnake.User,
    product_name: str,
    campo_name: str,
    quantity: int,
    delivery_type: str,
    thread_url: Optional[str] = None
):
    """Envia DM informando que o pagamento foi aprovado"""
    try:
        mode = _get_display_mode()
        colors = db.get_document("custom_colors") or {}
        colors = colors if isinstance(colors, dict) else {}
        color = _color_to_int(colors.get("primary"))

        delivery_text = ""
        if delivery_type == "automatic":
            delivery_text = "Seu produto será entregue automaticamente em instantes!"
        else:
            delivery_text = f"Entrega manual. Um administrador irá entregar seu produto em breve.\nAcompanhe no carrinho: {thread_url if thread_url else 'Verifique o servidor'}"

        if mode == "embed":
            embed = disnake.Embed(
                title=f"{emoji.correct} Compra aprovada",
                description=(
                    "Seu pagamento foi confirmado com sucesso.\n"
                    "Confira os detalhes do seu pedido abaixo."
                ),
                color=color or disnake.Color.green(),
                timestamp=datetime.utcnow()
            )
            embed.add_field(
                name=f"{emoji.bag} Resumo do pedido",
                value=(
                    f"**Produto:** `{product_name}`\n"
                    f"**Opção:** `{campo_name}`\n"
                    f"**Quantidade:** `{quantity}`"
                ),
                inline=False
            )
            embed.add_field(
                name=f"{emoji.alert} Próximo passo",
                value=delivery_text,
                inline=False
            )
            embed.set_footer(text="Obrigado pela preferência • Loja")

            components = []
            if delivery_type != "automatic" and thread_url:
                components = [
                    disnake.ui.ActionRow(
                        disnake.ui.Button(
                            label="Acompanhar pedido",
                            style=disnake.ButtonStyle.url,
                            url=thread_url,
                            emoji=emoji.cart
                        )
                    )
                ]
            await user.send(embed=embed, components=components or None)

        else:
            container_items = [
                disnake.ui.TextDisplay(f"# {emoji.correct} Compra aprovada"),
                disnake.ui.TextDisplay("-# Seu pagamento foi confirmado com sucesso."),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    f"### {emoji.bag} Resumo do pedido\n"
                    f"-# **Produto:** `{product_name}`\n"
                    f"-# **Opção:** `{campo_name}`\n"
                    f"-# **Quantidade:** `{quantity}`"
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    f"### {emoji.alert} Próximo passo\n{delivery_text}"
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay("-# Obrigado pela preferência • Loja")
            ]
            components = [
                disnake.ui.Container(
                    *container_items,
                    accent_colour=disnake.Colour(color) if color else disnake.Color.green()
                )
            ]
            if delivery_type != "automatic" and thread_url:
                components.append(
                    disnake.ui.ActionRow(
                        disnake.ui.Button(
                            label="Acompanhar pedido",
                            style=disnake.ButtonStyle.url,
                            url=thread_url,
                            emoji=emoji.cart
                        )
                    )
                )

            await user.send(
                components=components,
                flags=disnake.MessageFlags(is_components_v2=True)
            )

    except disnake.Forbidden:
        pass  # Usuário bloqueou DMs
    except Exception:
        pass  # Ignorar outros erros
