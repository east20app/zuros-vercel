import disnake
from disnake.ext import commands
from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message
import re

# Todos os DDDs do Brasil (para validação)
ALL_DDDS = [
    "11", "12", "13", "14", "15", "16", "17", "18", "19",
    "21", "22", "24", "27", "28",
    "31", "32", "33", "34", "35", "37", "38",
    "41", "42", "43", "44", "45", "46", "47", "48", "49",
    "51", "53", "54", "55",
    "61", "62", "63", "64", "65", "66", "67", "68", "69",
    "71", "73", "74", "75", "77", "79",
    "81", "82", "83", "84", "85", "86", "87", "88", "89",
    "91", "92", "93", "94", "95", "96", "97", "98", "99"
]

class ConfigPhoneModal(disnake.ui.Modal):
    def __init__(self, cog):
        self.cog = cog
        
        components = [
            disnake.ui.TextInput(
                label="DDD",
                placeholder="Ex: 11",
                custom_id="input_ddd",
                min_length=2,
                max_length=2,
                style=disnake.TextInputStyle.short
            ),
            disnake.ui.TextInput(
                label="Número de Celular",
                placeholder="99999-9999",
                custom_id="input_number",
                min_length=8,
                max_length=15,
                style=disnake.TextInputStyle.short
            )
        ]
        super().__init__(title="Configurar Celular", components=components)

    async def callback(self, inter: disnake.ModalInteraction):
        mode = db.get_document("custom_mode").get("mode")
        if mode == "embed":
            await embed_message.wait(inter)
        else:
            await message.wait(inter)

        # Recuperar valores
        # Como são TextInputs padrão, vem direto em text_values
        ddd = inter.text_values["input_ddd"]
        number = inter.text_values["input_number"]

        # Validação do DDD
        if ddd not in ALL_DDDS:
             await inter.followup.send(
                 f"{emoji.error} DDD inválido. Por favor, insira um DDD válido do Brasil (Ex: 11, 21, 31...).", 
                 ephemeral=True
             )
             return

        clean_number = re.sub(r"\D", "", number)
        
        # Opcional: Validar tamanho do número (8 ou 9 dígitos + ddd é separado)
        if len(clean_number) < 8:
            await inter.followup.send(
                 f"{emoji.error} Número inválido. Verifique se digitou corretamente.", 
                 ephemeral=True
             )
            return

        # Salvar
        config = self.cog.get_config()
        config["ddd"] = ddd
        config["number"] = clean_number
        config["enabled"] = True
        db.save_document("notifications_config", config)

        # Atualizar painel principal
        panel = self.cog.panel(inter, config)

        if mode == "embed":
            await inter.edit_original_message(content=None, **panel)
        else:
            await inter.edit_original_message(**panel)
            
        await inter.followup.send(
            f"{emoji.correct} Número configurado com sucesso: ({ddd}) {clean_number}",
            ephemeral=True
        )


class ConfigureNotifications(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def get_config():
        config = db.get_document("notifications_config")
        if not config:
            config = {"enabled": False, "ddd": None, "number": None}
            db.save_document("notifications_config", config)
        return config

    @staticmethod
    def panel(inter: disnake.MessageInteraction, config: dict = None) -> dict:
        if config is None:
            config = ConfigureNotifications.get_config()
        enabled = config.get("enabled", False)
        
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        container_kwargs = {}
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)

        phone_info = "Nenhum número configurado"
        if config.get("ddd") and config.get("number"):
            phone_info = f"({config.get('ddd')}) {config.get('number')}"

        status_text = "Ativado" if enabled else "Desativado"
        status_emoji = emoji.on if enabled else emoji.off
        
        # Botões
        toggle_btn = disnake.ui.Button(
            label="Desativar" if enabled else "Ativar",
            style=disnake.ButtonStyle.red if enabled else disnake.ButtonStyle.green,
            emoji=emoji.power,
            custom_id="ConfigNotif_Toggle"
        )
        
        config_num_btn = disnake.ui.Button(
            label="Configurar Número",
            style=disnake.ButtonStyle.grey,
            emoji=emoji.edit,
            custom_id="ConfigNotif_ConfigNumber",
            disabled=not enabled
        )

        back_btn = disnake.ui.Button(
            label="Voltar",
            style=disnake.ButtonStyle.grey,
            emoji=emoji.back,
            custom_id="Painel_Configuracoes"
        )

        mode = db.get_document("custom_mode").get("mode")
        
        if mode == "embed":
            embed = disnake.Embed(
                title="Configuração de Notificações",
                description=(
                    f"**Status:** {status_emoji} {status_text}\n"
                    f"**Número:** `{phone_info}`\n\n"
                    "Configure aqui o número para receber notificações via WhatsApp."
                )
            )
            if primary_color_hex:
                embed.color = container_kwargs.get("accent_colour")
                
            return {
                "embed": embed,
                "components": [
                    disnake.ui.ActionRow(toggle_btn, config_num_btn),
                    disnake.ui.ActionRow(back_btn)
                ]
            }
        else:
            return {
                "components": [
                    disnake.ui.Container(
                        disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Configurações > **Notificações**"),
                        disnake.ui.Separator(),
                        disnake.ui.TextDisplay(
                            f"**Status:** {status_emoji} {status_text}\n"
                            f"**Número:** `{phone_info}`"
                        ),
                        disnake.ui.Separator(),
                        disnake.ui.ActionRow(toggle_btn, config_num_btn),
                        **container_kwargs
                    ),
                    disnake.ui.ActionRow(back_btn)
                ]
            }

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        if not inter.component.custom_id.startswith("ConfigNotif_"):
            return
        
        mode = db.get_document("custom_mode").get("mode")
        async def wait():
            if mode == "embed":
                await embed_message.wait(inter)
            else:
                await message.wait(inter)
        
        async def edit(payload):
            if mode == "embed":
                await inter.edit_original_message(content=None, **payload)
            else:
                await inter.edit_original_message(**payload)

        if inter.component.custom_id == "ConfigNotif_Toggle":
            config = self.get_config()
            new_state = not config.get("enabled", False)
            config["enabled"] = new_state
            db.save_document("notifications_config", config)
            
            await wait()
            await edit(self.panel(inter, config))

        elif inter.component.custom_id == "ConfigNotif_ConfigNumber":
            # Abre MODAL direto
            await inter.response.send_modal(ConfigPhoneModal(self))
        
        elif inter.component.custom_id == "ConfigNotif_BackToMain":
            await wait()
            await edit(self.panel(inter))

def setup(bot: commands.Bot):
    bot.add_cog(ConfigureNotifications(bot))
