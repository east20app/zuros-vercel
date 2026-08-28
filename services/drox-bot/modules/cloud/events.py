"""Compatibilidade para carregadores antigos; o fluxo principal esta em zuros_integration.py."""
import disnake
from disnake.ext import commands
from .zuros_cloud import ZurosCloudError, get_zuros_cloud

class CloudEvents(commands.Cog):
    @commands.Cog.listener()
    async def on_member_join(self, member: disnake.Member):
        try:
            await get_zuros_cloud().rejoin(member.id, member.guild.id)
        except ZurosCloudError:
            pass

def setup(bot: commands.Bot):
    if bot.get_cog("ZurosIntegration") is None:
        bot.add_cog(CloudEvents())