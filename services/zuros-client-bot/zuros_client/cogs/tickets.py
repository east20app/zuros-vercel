import re
import sqlite3
import unicodedata

import discord
from discord import app_commands
from discord.ext import commands

from ..emojis import emoji
from ..theme import FOOTER, Accent
from ..tickets.store import TicketConfig, TicketRecord, TicketStore
from ..tickets.transcript import build_transcript

DEPARTMENTS = {
    "support": ("Suporte técnico", "Aplicações, configurações, erros e integrações."),
    "billing": ("Financeiro", "Pagamentos, cobranças, renovações e faturas."),
    "sales": ("Comercial", "Planos, produtos e novas contratações."),
}


def safe_channel_name(member: discord.abc.User) -> str:
    raw = unicodedata.normalize("NFKD", member.display_name).encode("ascii", "ignore")
    clean = re.sub(r"[^a-z0-9]+", "-", raw.decode().lower()).strip("-")
    return f"ticket-{clean or member.id}"[:90]


def is_staff(member: discord.Member, config: TicketConfig) -> bool:
    return member.guild_permissions.manage_channels or any(
        role.id == config.support_role_id for role in member.roles
    )


def panel_text() -> str:
    return (
        f"## {emoji.ticket} Central de atendimento ZUROS\n\n"
        "Escolha o setor da sua solicitação. Um canal privado será criado para você "
        "e para nossa equipe.\n\n"
        f"### {emoji.settings} Suporte técnico\n"
        "-# Aplicações, configurações, erros e integrações.\n\n"
        f"### {emoji.wallet} Financeiro\n"
        "-# Pagamentos, cobranças, renovações e faturas.\n\n"
        f"### {emoji.store} Comercial\n"
        "-# Planos, produtos e novas contratações.\n\n"
        + FOOTER.format(tagline="Atendimento organizado, privado e seguro")
    )


class TicketOpenModal(discord.ui.Modal):
    subject = discord.ui.TextInput(label="Assunto", min_length=3, max_length=80)
    details = discord.ui.TextInput(
        label="Explique como podemos ajudar",
        min_length=10,
        max_length=1000,
        style=discord.TextStyle.paragraph,
    )

    def __init__(self, department: str):
        super().__init__(title=f"Abrir ticket · {DEPARTMENTS[department][0]}")
        self.department = department

    async def on_submit(self, interaction: discord.Interaction) -> None:
        cog = interaction.client.get_cog("TicketsCog")
        if not isinstance(cog, TicketsCog):
            await interaction.response.send_message("Sistema indisponível.", ephemeral=True)
            return
        await cog.open_ticket(interaction, self.department, str(self.subject), str(self.details))


class TicketDepartmentSelect(discord.ui.Select):
    def __init__(self):
        icons = {"support": emoji.settings, "billing": emoji.wallet, "sales": emoji.store}
        super().__init__(
            custom_id="zuros:tickets:department",
            placeholder="Selecione o setor de atendimento",
            options=[
                discord.SelectOption(
                    label=label,
                    value=value,
                    description=description,
                    emoji=icons[value],
                )
                for value, (label, description) in DEPARTMENTS.items()
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_modal(TicketOpenModal(self.values[0]))


class TicketPanelView(discord.ui.LayoutView):
    def __init__(self):
        super().__init__(timeout=None)
        container = discord.ui.Container(accent_colour=Accent.SUPPORT)
        container.add_item(discord.ui.TextDisplay(panel_text()))
        container.add_item(discord.ui.Separator(spacing=discord.SeparatorSpacing.large))
        container.add_item(discord.ui.ActionRow(TicketDepartmentSelect()))
        self.add_item(container)


class CloseTicketModal(discord.ui.Modal, title="Fechar ticket"):
    reason = discord.ui.TextInput(
        label="Motivo do fechamento",
        min_length=3,
        max_length=300,
        style=discord.TextStyle.paragraph,
    )

    async def on_submit(self, interaction: discord.Interaction) -> None:
        cog = interaction.client.get_cog("TicketsCog")
        if not isinstance(cog, TicketsCog):
            await interaction.response.send_message("Sistema indisponível.", ephemeral=True)
            return
        await cog.close_ticket(interaction, str(self.reason))


class TicketActionButton(discord.ui.Button):
    def __init__(self, action: str, label: str, icon: str, style: discord.ButtonStyle) -> None:
        super().__init__(
            label=label,
            emoji=icon,
            style=style,
            custom_id=f"zuros:tickets:{action}",
        )
        self.action = action

    async def callback(self, interaction: discord.Interaction) -> None:
        cog = interaction.client.get_cog("TicketsCog")
        if not isinstance(cog, TicketsCog):
            await interaction.response.send_message("Sistema indisponível.", ephemeral=True)
            return
        if self.action == "close":
            await interaction.response.send_modal(CloseTicketModal())
        else:
            await cog.handle_action(interaction, self.action)


class TicketControlView(discord.ui.LayoutView):
    def __init__(self):
        super().__init__(timeout=None)
        container = discord.ui.Container(accent_colour=Accent.BRAND)
        container.add_item(
            discord.ui.TextDisplay(
                f"## {emoji.ticket} Atendimento iniciado\n\n"
                "Descreva sua solicitação e aguarde a equipe. Use os controles abaixo "
                "quando necessário.\n\n" + FOOTER.format(tagline="Sua conversa permanece privada")
            )
        )
        container.add_item(discord.ui.Separator())
        container.add_item(
            discord.ui.ActionRow(
                TicketActionButton(
                    "claim", "Assumir", emoji.double_check, discord.ButtonStyle.primary
                ),
                TicketActionButton("close", "Fechar", emoji.delete, discord.ButtonStyle.danger),
                TicketActionButton(
                    "transcript", "Transcript", emoji.receipt, discord.ButtonStyle.secondary
                ),
                TicketActionButton(
                    "reopen", "Reabrir", emoji.unlock, discord.ButtonStyle.secondary
                ),
            )
        )
        self.add_item(container)


class TicketsCog(commands.Cog):
    def __init__(self, bot: commands.Bot, store: TicketStore):
        self.bot = bot
        self.store = store

    async def _context(
        self, interaction: discord.Interaction
    ) -> tuple[discord.TextChannel, TicketRecord, TicketConfig] | None:
        if not isinstance(interaction.channel, discord.TextChannel) or interaction.guild is None:
            await interaction.response.send_message(
                "Este controle só funciona dentro de um ticket.", ephemeral=True
            )
            return None
        ticket = await self.store.get_ticket(interaction.channel.id)
        config = await self.store.get_config(interaction.guild.id)
        if ticket is None or config is None:
            await interaction.response.send_message(
                "Este canal não está registrado como ticket.", ephemeral=True
            )
            return None
        return interaction.channel, ticket, config

    async def _log(
        self,
        guild: discord.Guild,
        config: TicketConfig,
        text: str,
        file: discord.File | None = None,
    ) -> None:
        channel = guild.get_channel(config.log_channel_id)
        if isinstance(channel, discord.TextChannel):
            try:
                await channel.send(text, file=file)
            except discord.HTTPException:
                pass

    async def open_ticket(
        self, interaction: discord.Interaction, department: str, subject: str, details: str
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        member = interaction.user
        if guild is None or not isinstance(member, discord.Member):
            await interaction.followup.send("Use este painel em um servidor.", ephemeral=True)
            return
        config = await self.store.get_config(guild.id)
        if config is None:
            await interaction.followup.send(
                "O sistema de tickets ainda não foi configurado.", ephemeral=True
            )
            return
        current = await self.store.get_open_ticket(guild.id, member.id)
        if current:
            existing = guild.get_channel(current.channel_id)
            suffix = f" em {existing.mention}" if existing else ""
            await interaction.followup.send(
                f"Você já possui um ticket aberto{suffix}.", ephemeral=True
            )
            return
        category = guild.get_channel(config.category_id)
        support = guild.get_role(config.support_role_id)
        me = guild.me
        if not isinstance(category, discord.CategoryChannel) or support is None or me is None:
            await interaction.followup.send(
                "A configuração está incompleta. Peça a um administrador para revisá-la.",
                ephemeral=True,
            )
            return
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            member: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                attach_files=True,
            ),
            support: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                manage_messages=True,
            ),
            me: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                manage_channels=True,
                manage_messages=True,
            ),
        }
        channel: discord.TextChannel | None = None
        try:
            channel = await guild.create_text_channel(
                safe_channel_name(member),
                category=category,
                overwrites=overwrites,
                topic=f"Ticket ZUROS · {member.id} · {DEPARTMENTS[department][0]}",
                reason=f"Ticket aberto por {member}",
            )
            await self.store.create_ticket(channel.id, guild.id, member.id, department, subject)
        except sqlite3.IntegrityError:
            if channel:
                await channel.delete(reason="Ticket duplicado")
            await interaction.followup.send("Você já possui um ticket aberto.", ephemeral=True)
            return
        except discord.Forbidden:
            await interaction.followup.send(
                "Não tenho permissão para criar o canal.", ephemeral=True
            )
            return
        await channel.send(
            content=f"{member.mention} {support.mention}",
            view=TicketControlView(),
            allowed_mentions=discord.AllowedMentions(users=True, roles=True),
        )
        await channel.send(
            f"**Setor:** {DEPARTMENTS[department][0]}\n" f"**Assunto:** {subject}\n\n{details}"
        )
        await self._log(
            guild,
            config,
            f"{emoji.ticket} Ticket criado: {channel.mention} · {member.mention} · {subject}",
        )
        await interaction.followup.send(
            f"Ticket criado com sucesso: {channel.mention}", ephemeral=True
        )

    async def handle_action(self, interaction: discord.Interaction, action: str) -> None:
        context = await self._context(interaction)
        if context is None:
            return
        channel, ticket, config = context
        member = interaction.user
        if not isinstance(member, discord.Member):
            return
        staff = is_staff(member, config)
        if action == "claim":
            if not staff:
                await interaction.response.send_message(
                    "Apenas a equipe pode assumir tickets.", ephemeral=True
                )
                return
            await self.store.claim(channel.id, member.id)
            await interaction.response.send_message(
                f"{emoji.double_check} {member.mention} assumiu este atendimento."
            )
        elif action == "transcript":
            if not staff and member.id != ticket.owner_id:
                await interaction.response.send_message(
                    "Você não pode acessar este transcript.", ephemeral=True
                )
                return
            await interaction.response.defer(ephemeral=True)
            await interaction.followup.send(file=await build_transcript(channel), ephemeral=True)
        elif action == "reopen":
            if not staff:
                await interaction.response.send_message(
                    "Apenas a equipe pode reabrir tickets.", ephemeral=True
                )
                return
            if ticket.status == "open":
                await interaction.response.send_message(
                    "Este ticket já está aberto.", ephemeral=True
                )
                return
            owner = channel.guild.get_member(ticket.owner_id)
            if owner:
                await channel.set_permissions(
                    owner,
                    view_channel=True,
                    send_messages=True,
                    read_message_history=True,
                )
            try:
                await self.store.reopen(channel.id)
            except sqlite3.IntegrityError:
                await interaction.response.send_message(
                    "O dono já possui outro ticket aberto.", ephemeral=True
                )
                return
            await channel.edit(name=channel.name.removeprefix("fechado-"))
            await interaction.response.send_message(
                f"{emoji.unlock} Ticket reaberto por {member.mention}."
            )

    async def close_ticket(self, interaction: discord.Interaction, reason: str) -> None:
        context = await self._context(interaction)
        if context is None:
            return
        channel, ticket, config = context
        member = interaction.user
        if not isinstance(member, discord.Member):
            return
        if member.id != ticket.owner_id and not is_staff(member, config):
            await interaction.response.send_message(
                "Você não pode fechar este ticket.", ephemeral=True
            )
            return
        if ticket.status != "open":
            await interaction.response.send_message("Este ticket já está fechado.", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        transcript = await build_transcript(channel)
        await self.store.close(channel.id, member.id, reason)
        owner = channel.guild.get_member(ticket.owner_id)
        if owner:
            await channel.set_permissions(owner, view_channel=True, send_messages=False)
        if not channel.name.startswith("fechado-"):
            await channel.edit(name=f"fechado-{channel.name}"[:100])
        await self._log(
            channel.guild,
            config,
            f"{emoji.delete} Ticket fechado: #{channel.name} · {member.mention} · {reason}",
            transcript,
        )
        await channel.send(
            f"{emoji.lock} Ticket fechado por {member.mention}. **Motivo:** {reason}"
        )
        await interaction.followup.send("Ticket fechado e transcript salvo.", ephemeral=True)

    @app_commands.command(name="tickets-configurar", description="Configura o sistema de tickets")
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def configure(
        self,
        interaction: discord.Interaction,
        categoria: discord.CategoryChannel,
        equipe: discord.Role,
        logs: discord.TextChannel,
        painel: discord.TextChannel,
    ) -> None:
        await self.store.save_config(
            TicketConfig(
                interaction.guild_id or 0,
                categoria.id,
                equipe.id,
                logs.id,
                painel.id,
            )
        )
        await interaction.response.send_message(
            "Configuração salva. Use /tickets-painel para publicar a central.",
            ephemeral=True,
        )

    @app_commands.command(name="tickets-painel", description="Publica o painel de tickets")
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def publish(self, interaction: discord.Interaction) -> None:
        config = await self.store.get_config(interaction.guild_id or 0)
        if config is None or interaction.guild is None:
            await interaction.response.send_message(
                "Configure o sistema com /tickets-configurar primeiro.", ephemeral=True
            )
            return
        channel = interaction.guild.get_channel(config.panel_channel_id)
        if not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message(
                "O canal configurado não existe mais.", ephemeral=True
            )
            return
        await channel.send(view=TicketPanelView())
        await interaction.response.send_message(
            f"Painel publicado em {channel.mention}.", ephemeral=True
        )

    @app_commands.command(name="ticket-adicionar", description="Adiciona um membro ao ticket")
    @app_commands.guild_only()
    async def add_member(self, interaction: discord.Interaction, membro: discord.Member) -> None:
        context = await self._context(interaction)
        if context is None:
            return
        channel, _ticket, config = context
        if not isinstance(interaction.user, discord.Member) or not is_staff(
            interaction.user, config
        ):
            await interaction.response.send_message(
                "Apenas a equipe pode adicionar membros.", ephemeral=True
            )
            return
        await channel.set_permissions(
            membro,
            view_channel=True,
            send_messages=True,
            read_message_history=True,
        )
        await interaction.response.send_message(f"{emoji.plus} {membro.mention} foi adicionado.")

    @app_commands.command(name="ticket-remover", description="Remove um membro do ticket")
    @app_commands.guild_only()
    async def remove_member(self, interaction: discord.Interaction, membro: discord.Member) -> None:
        context = await self._context(interaction)
        if context is None:
            return
        channel, ticket, config = context
        if not isinstance(interaction.user, discord.Member) or not is_staff(
            interaction.user, config
        ):
            await interaction.response.send_message(
                "Apenas a equipe pode remover membros.", ephemeral=True
            )
            return
        if membro.id == ticket.owner_id:
            await interaction.response.send_message(
                "O dono do ticket não pode ser removido.", ephemeral=True
            )
            return
        await channel.set_permissions(membro, overwrite=None)
        await interaction.response.send_message(f"{emoji.minus} {membro.mention} foi removido.")

    @app_commands.command(
        name="ticket-excluir", description="Exclui definitivamente um ticket fechado"
    )
    @app_commands.default_permissions(manage_channels=True)
    @app_commands.guild_only()
    async def delete_ticket(self, interaction: discord.Interaction, confirmar: bool) -> None:
        context = await self._context(interaction)
        if context is None:
            return
        channel, ticket, config = context
        if not isinstance(interaction.user, discord.Member) or not is_staff(
            interaction.user, config
        ):
            await interaction.response.send_message(
                "Apenas a equipe pode excluir tickets.", ephemeral=True
            )
            return
        if ticket.status == "open" or not confirmar:
            await interaction.response.send_message(
                "Feche o ticket e execute novamente confirmando a exclusão.",
                ephemeral=True,
            )
            return
        await interaction.response.send_message("Ticket excluído.", ephemeral=True)
        await self.store.delete(channel.id)
        await channel.delete(reason=f"Ticket excluído por {interaction.user}")


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(TicketsCog(bot, bot.ticket_store))  # type: ignore[attr-defined]
