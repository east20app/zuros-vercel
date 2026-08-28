"""View persistente do botão público de verificação."""
import disnake
from .zuros_client import ZurosError
VERIFY_CUSTOM_ID="Cloud_GetAuthLink"
class VerificationView(disnake.ui.View):
    def __init__(self,client=None,label="Verificar"):
        super().__init__(timeout=None); self.client=client
        button=disnake.ui.Button(label=label,style=disnake.ButtonStyle.green,custom_id=VERIFY_CUSTOM_ID)
        self.add_item(button)
    def _current_client(self):
        if self.client is not None: return self.client
        from .zuros_cloud import get_zuros_cloud
        return get_zuros_cloud()
    async def _verify(self,inter):
        if inter.guild is None:
            await inter.response.send_message("Use este botão dentro de um servidor.",ephemeral=True); return
        await inter.response.defer(ephemeral=True,with_message=True)
        try:
            link=await self._current_client().create_auth_link(inter.author.id,inter.guild.id)
            await inter.edit_original_response(content="Clique abaixo para concluir sua verificação:",
                components=[disnake.ui.ActionRow(disnake.ui.Button(
                    label="Ir para verificação",style=disnake.ButtonStyle.link,url=link.url))])
        except ZurosError as error:
            await inter.edit_original_response(content=f"Não foi possível gerar seu link agora: {error}",components=[])
