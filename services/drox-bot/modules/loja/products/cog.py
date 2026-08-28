from disnake.ext import commands, tasks
import disnake

from functions.emoji import emoji
from functions.message import message, embed_message
from functions.database import database as db
from functions.utils import utils
from modules.loja.cart.stock_manager import StockManager

class GerenciarProdutos(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def _document(name: str) -> dict:
        data = db.get_document(name) or {}
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _primary_color():
        color_data = GerenciarProdutos._document("custom_colors")
        primary_color_hex = color_data.get("primary")
        if not primary_color_hex:
            return None
        return int(primary_color_hex.replace("#", ""), 16)

    @staticmethod
    def _slice_name(product: dict) -> str:
        name = product.get("name", "Sem nome")
        return name if len(name) <= 80 else name[:77] + "..."

    @staticmethod
    def _product_options(product_items: list) -> list:
        options = []
        for product_id, product in product_items:
            options.append(
                disnake.SelectOption(
                    label=GerenciarProdutos._slice_name(product),
                    value=str(product_id),
                    description=(
                        f"Campos: {len(product.get('campos', {}))} | "
                        f"Cupons: {len(product.get('cupons', {}))}"
                    )[:100],
                )
            )
        return options

    def gerar_dropdown_produtos(self, products: dict, page: int = 0, duplicar_mode: bool = False) -> list:
        """Gera os seletores de produtos, com até 25 produtos por página."""
        custom_id_prefix = (
            "Loja_DuplicarProduto_Select"
            if duplicar_mode
            else "Loja_Produtos_Select"
        )

        if not products:
            return [
                disnake.ui.StringSelect(
                    placeholder="Nenhum produto encontrado",
                    options=[
                        disnake.SelectOption(
                            label="Nenhum produto encontrado",
                            value="disabled",
                        )
                    ],
                    custom_id=custom_id_prefix,
                    disabled=True,
                )
            ]

        product_list = sorted(
            products.items(),
            key=lambda item: item[1].get("name", "").lower(),
        )
        total_products = len(product_list)
        total_pages = max(1, (total_products + 24) // 25)
        dropdowns = []

        for page_num in range(total_pages):
            start_idx = page_num * 25
            end_idx = min(start_idx + 25, total_products)
            page_items = product_list[start_idx:end_idx]

            if total_pages == 1:
                placeholder = f"[{total_products}] Selecione um produto (1 a {total_products})"
                custom_id = custom_id_prefix
            else:
                placeholder = f"[{page_num + 1}] Selecione um produto ({start_idx + 1} a {end_idx})"
                custom_id = f"{custom_id_prefix}_Page{page_num}"

            dropdowns.append(
                disnake.ui.StringSelect(
                    placeholder=placeholder,
                    options=self._product_options(page_items),
                    custom_id=custom_id,
                )
            )

        return dropdowns

    def gerar_dropdown_paineis(self, panels: dict, page: int = 0) -> list:
        """Gera o seletor de painéis com o mesmo padrão visual do seletor de produtos."""
        if not panels:
            return [
                disnake.ui.StringSelect(
                    placeholder="Nenhum painel encontrado",
                    options=[
                        disnake.SelectOption(
                            label="Nenhum painel encontrado",
                            value="disabled",
                        )
                    ],
                    custom_id="Loja_Paineis_Select",
                    disabled=True,
                )
            ]

        panel_list = sorted(
            panels.items(),
            key=lambda item: item[1].get("name", "").lower(),
        )
        total_panels = len(panel_list)
        total_pages = max(1, (total_panels + 24) // 25)
        dropdowns = []

        for page_num in range(total_pages):
            start_idx = page_num * 25
            end_idx = min(start_idx + 25, total_panels)
            page_items = panel_list[start_idx:end_idx]
            options = []

            for panel_id, panel in page_items:
                panel_name = panel.get("name", "Sem nome")
                options.append(
                    disnake.SelectOption(
                        label=panel_name[:80],
                        value=str(panel_id),
                        description="Configure e edite este painel."[:100],
                    )
                )

            if total_pages == 1:
                placeholder = f"[{total_panels}] Selecione um painel (1 a {total_panels})"
                custom_id = "Loja_Paineis_Select"
            else:
                placeholder = f"[{page_num + 1}] Selecione um painel ({start_idx + 1} a {end_idx})"
                custom_id = f"Loja_Paineis_Select_Page{page_num}"

            dropdowns.append(
                disnake.ui.StringSelect(
                    placeholder=placeholder,
                    options=options,
                    custom_id=custom_id,
                )
            )

        return dropdowns

    def _navigation_row(self, current_page: int, total_pages: int, prefix: str) -> disnake.ui.ActionRow:
        previous_disabled = current_page <= 0
        next_disabled = current_page >= total_pages - 1

        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="←",
                style=disnake.ButtonStyle.grey,
                custom_id=f"{prefix}_Prev_{current_page}",
                disabled=previous_disabled,
            ),
            disnake.ui.Button(
                label=f"{current_page + 1}/{total_pages}",
                style=disnake.ButtonStyle.grey,
                custom_id=f"{prefix}_Page_{current_page}",
                disabled=True,
            ),
            disnake.ui.Button(
                label="→",
                style=disnake.ButtonStyle.grey,
                custom_id=f"{prefix}_Next_{current_page}",
                disabled=next_disabled,
            ),
        )

    def _create_product_row(
        self,
        current_page: int = 0,
        total_pages: int = 1,
    ) -> disnake.ui.ActionRow:
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Criar Produto",
                style=disnake.ButtonStyle.green,
                emoji=emoji.plus,
                custom_id="Loja_CriarProduto",
            ),
            disnake.ui.Button(
                label="←",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Produtos_Prev_{current_page}",
                disabled=current_page <= 0,
            ),
            disnake.ui.Button(
                label=f"{current_page + 1}/{total_pages}",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Produtos_Page_{current_page}",
                disabled=True,
            ),
            disnake.ui.Button(
                label="→",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Produtos_Next_{current_page}",
                disabled=current_page >= total_pages - 1,
            ),
        )

    def _create_panel_row(
        self,
        current_page: int = 0,
        total_pages: int = 1,
    ) -> disnake.ui.ActionRow:
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Criar Painel",
                style=disnake.ButtonStyle.green,
                emoji=emoji.plus,
                custom_id="Loja_CriarPainel",
            ),
            disnake.ui.Button(
                label="←",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Paineis_Prev_{current_page}",
                disabled=current_page <= 0,
            ),
            disnake.ui.Button(
                label=f"{current_page + 1}/{total_pages}",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Paineis_Page_{current_page}",
                disabled=True,
            ),
            disnake.ui.Button(
                label="→",
                style=disnake.ButtonStyle.grey,
                custom_id=f"Loja_Paineis_Next_{current_page}",
                disabled=current_page >= total_pages - 1,
            ),
        )

    def _back_row(self) -> disnake.ui.ActionRow:
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Voltar",
                style=disnake.ButtonStyle.grey,
                emoji=emoji.back,
                custom_id="Painel_Loja",
            )
        )

    def panel(
        self,
        inter: disnake.MessageInteraction,
        product_page: int = 0,
        panel_page: int = 0,
    ):
        mode_data = self._document("custom_mode")
        mode = mode_data.get("mode", "components")
        if mode == "embed":
            return self._panel_embed(inter, product_page, panel_page)
        return self._panel_components(inter, product_page, panel_page)

    def _panel_components(
        self,
        inter: disnake.MessageInteraction,
        product_page: int = 0,
        panel_page: int = 0,
    ) -> dict:
        products = self._document("loja_products")
        product_total = len(products)
        product_pages = max(1, (product_total + 24) // 25)
        product_page = max(0, min(product_page, product_pages - 1))

        container_kwargs = {}
        primary_color = self._primary_color()
        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)

        product_dropdowns = self.gerar_dropdown_produtos(products)
        product_dropdown = product_dropdowns[min(product_page, len(product_dropdowns) - 1)]

        container_items = [
            disnake.ui.TextDisplay(
                f"# {emoji.zuros}\n-# Painel > Loja > **Produtos**"
            ),
            disnake.ui.Separator(),
            disnake.ui.TextDisplay(
                f"Produtos Totais: {product_total} | Vendas: Ligado"
            ),
            self._create_product_row(product_page, product_pages),
            disnake.ui.ActionRow(product_dropdown),
        ]

        return {
            "components": [
                disnake.ui.Container(*container_items, **container_kwargs),
                self._back_row(),
            ]
        }

    def _panel_embed(
        self,
        inter: disnake.MessageInteraction,
        product_page: int = 0,
        panel_page: int = 0,
    ) -> dict:
        products = self._document("loja_products")
        product_total = len(products)
        product_pages = max(1, (product_total + 24) // 25)
        product_page = max(0, min(product_page, product_pages - 1))
        primary_color = self._primary_color()

        embed_kwargs = {}
        if primary_color is not None:
            embed_kwargs["color"] = primary_color

        embed = disnake.Embed(
            description=(
                f"-# Painel > Loja > **Produtos**\n\n"
                f"Produtos Totais: {product_total} | Vendas: Ligado"
            ),
            **embed_kwargs,
        )

        product_dropdowns = self.gerar_dropdown_produtos(products)
        product_dropdown = product_dropdowns[min(product_page, len(product_dropdowns) - 1)]
        components = [
            self._create_product_row(product_page, product_pages),
            disnake.ui.ActionRow(product_dropdown),
            self._back_row(),
        ]

        return {"embed": embed, "components": components}

    async def _show_panel(
        self,
        inter: disnake.MessageInteraction,
        product_page: int = 0,
        panel_page: int = 0,
    ):
        mode_data = self._document("custom_mode")
        mode = mode_data.get("mode", "components")
        msg_handler = embed_message if mode == "embed" else message
        await msg_handler.wait(inter, send=False)

        panel_data = self.panel(inter, product_page, panel_page)
        if "embed" in panel_data:
            await inter.edit_original_message(content=None, **panel_data)
        else:
            await inter.edit_original_message(
                **panel_data,
                flags=disnake.MessageFlags(is_components_v2=True),
            )

    def _panel_duplicar_produto(self, inter: disnake.MessageInteraction) -> dict:
        """Painel para selecionar produto a duplicar"""
        products = db.get_document("loja_products") or {}
        dropdowns = self.gerar_dropdown_produtos(products, duplicar_mode=True)

        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")

        container_kwargs = {}
        if primary_color_hex:
            container_kwargs["accent_colour"] = disnake.Colour(int(primary_color_hex.replace("#", ""), 16))

        # Criar ActionRows para os dropdowns
        dropdown_rows = [disnake.ui.ActionRow(dropdown) for dropdown in dropdowns]
        
        # Adicionar dropdowns e botão ao container
        container_items = [
            disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Painel > Loja > **Gerenciar Produtos** > **Duplicar Produto**"),
            disnake.ui.Separator(),
            disnake.ui.TextDisplay(f"Selecione um produto abaixo para duplicá-lo."),
            disnake.ui.Separator(),
        ]
        
        # Adicionar todos os dropdowns
        container_items.extend(dropdown_rows)

        mode = db.get_document("custom_mode").get("mode")
        if mode == "embed":
            embed_kwargs = {}
            if primary_color_hex:
                embed_kwargs["color"] = int(primary_color_hex.replace("#", ""), 16)
            
            embed = disnake.Embed(
                description=f"-# Painel > Loja > **Gerenciar Produtos** > **Duplicar Produto**\n\nSelecione um produto abaixo para duplicá-lo.",
                **embed_kwargs
            )
            
            components = []
            for dropdown in dropdowns:
                components.append(disnake.ui.ActionRow(dropdown))
            
            components.append(disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Loja_Produtos")))
            
            return {"embed": embed, "components": components}

        return {"components": [
            disnake.ui.Container(*container_items, **container_kwargs),
            disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Loja_Produtos")),
        ]}

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        custom_id = inter.component.custom_id

        if custom_id == "Loja_Produtos":
            await self._show_panel(inter)

        elif custom_id.startswith("Loja_Produtos_Prev_") or custom_id.startswith("Loja_Produtos_Next_"):
            try:
                current_page = int(custom_id.rsplit("_", 1)[-1])
            except ValueError:
                current_page = 0

            direction = -1 if "_Prev_" in custom_id else 1
            await self._show_panel(
                inter,
                product_page=max(0, current_page + direction),
            )

        elif custom_id.startswith("Loja_Paineis_Prev_") or custom_id.startswith("Loja_Paineis_Next_"):
            try:
                current_page = int(custom_id.rsplit("_", 1)[-1])
            except ValueError:
                current_page = 0

            direction = -1 if "_Prev_" in custom_id else 1
            await self._show_panel(
                inter,
                panel_page=max(0, current_page + direction),
            )

        elif custom_id == "Loja_DuplicarProduto":
            mode_data = self._document("custom_mode")
            mode = mode_data.get("mode", "components")
            msg_handler = embed_message if mode == "embed" else message
            await msg_handler.wait(inter, send=False)

            panel_data = self._panel_duplicar_produto(inter)
            if "embed" in panel_data:
                await inter.edit_original_message(content=None, **panel_data)
            else:
                await inter.edit_original_message(
                    **panel_data,
                    flags=disnake.MessageFlags(is_components_v2=True),
                )
        
        # Validar mensagens salvas na database
        elif inter.component.custom_id == "Loja_Produtos_ValidarMensagens":
            await inter.response.defer(ephemeral=True)
            products = db.get_document("loja_products") or {}
            total_checked = 0
            total_removed = 0
            changed = False
            for product_id, p in products.items():
                msgs = p.get("messages") or []
                if not isinstance(msgs, list) or not msgs:
                    continue
                new_msgs = []
                for m in msgs:
                    try:
                        msg_guild_id = m.get("guild_id")
                        msg_channel_id = m.get("channel_id")
                        msg_id = m.get("message_id")
                        if not (msg_channel_id and msg_id):
                            # inválido
                            total_removed += 1
                            continue
                        # validar apenas mensagens deste servidor para evitar falsas remoções
                        if msg_guild_id and msg_guild_id != inter.guild.id:
                            new_msgs.append(m)
                            continue
                        channel = inter.guild.get_channel(int(msg_channel_id))
                        if channel is None:
                            total_removed += 1
                            continue
                        # tentar buscar a mensagem
                        try:
                            await channel.fetch_message(int(msg_id))
                            new_msgs.append(m)  # existe
                        except disnake.NotFound:
                            total_removed += 1
                        except (disnake.Forbidden, disnake.HTTPException):
                            # sem permissão ou erro transitório: manter por segurança
                            new_msgs.append(m)
                    finally:
                        total_checked += 1
                if len(new_msgs) != len(msgs):
                    products[product_id]["messages"] = new_msgs
                    changed = True
            if changed:
                db.save_document("loja_products", products)

            # construir retorno visual
            color_data = db.get_document("custom_colors") or {}
            primary_color_hex = color_data.get("primary")
            container_kwargs = {}
            if primary_color_hex:
                container_kwargs["accent_colour"] = disnake.Colour(int(primary_color_hex.replace("#", ""), 16))

            result_container = disnake.ui.Container(
                disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Loja > **Validar Mensagens**"),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    f"**Mensagens verificadas:** `{total_checked}`\n"
                    f"**Removidas da database:** `{total_removed}`\n"
                    f"**Documento:** `loja_products`"
                ),
                **container_kwargs
            )
            await inter.followup.send(components=[result_container], ephemeral=True, flags=disnake.MessageFlags(is_components_v2=True))

    @tasks.loop(hours=1)
    async def _auto_validate_messages(self):
        products = db.get_document("loja_products") or {}
        changed = False
        for product_id, p in products.items():
            msgs = p.get("messages") or []
            if not isinstance(msgs, list) or not msgs:
                continue
            new_msgs = []
            for m in msgs:
                try:
                    gid = m.get("guild_id")
                    cid = m.get("channel_id")
                    mid = m.get("message_id")
                    if not (cid and mid and gid):
                        continue
                    guild = self.bot.get_guild(int(gid)) if gid else None
                    if guild is None:
                        continue
                    channel = guild.get_channel(int(cid)) if cid else None
                    if channel is None:
                        continue
                    try:
                        await channel.fetch_message(int(mid))
                        new_msgs.append(m)
                    except disnake.NotFound:
                        pass
                    except (disnake.Forbidden, disnake.HTTPException):
                        new_msgs.append(m)
                except Exception:
                    pass
            if len(new_msgs) != len(msgs):
                products[product_id]["messages"] = new_msgs
                changed = True
        if changed:
            db.save_document("loja_products", products)

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(self, inter: disnake.MessageInteraction):
        # Handler para dropdowns paginados de produtos normais
        if inter.component.custom_id.startswith("Loja_Produtos_Select"):
            product_id = inter.values[0]
            if product_id == "disabled":
                await inter.response.defer()
                return
            
            # Importar e chamar o painel de configuração
            from .product.configurar import ConfigurarProduto
            mode = db.get_document("custom_mode").get("mode")
            panel_data = ConfigurarProduto.panel(inter, product_id)
            
            if mode == "embed":
                await embed_message.wait(inter, send=False)
                await inter.edit_original_message(content=None, **panel_data)
            else:
                await message.wait(inter, send=False)
                await inter.edit_original_message(**panel_data)
        
        # Handler para dropdown de duplicar produto
        elif inter.component.custom_id.startswith("Loja_DuplicarProduto_Select"):
            product_id = inter.values[0]
            if product_id == "disabled":
                await inter.response.defer()
                return
            
            # Abrir modal perguntando se quer duplicar estoque
            from .duplicate import DuplicateProductModal
            await inter.response.send_modal(DuplicateProductModal(product_id))

    @_auto_validate_messages.before_loop
    async def _before_auto_validate_messages(self):
        await self.bot.wait_until_ready()

    @commands.Cog.listener()
    async def on_ready(self):
        if not self._auto_validate_messages.is_running():
            self._auto_validate_messages.start()

    def cog_unload(self):
        if self._auto_validate_messages.is_running():
            self._auto_validate_messages.cancel()

def setup(bot: commands.Bot):
    bot.add_cog(GerenciarProdutos(bot))