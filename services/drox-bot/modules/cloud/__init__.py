from disnake.ext import commands
from .cog import Cloud
from .zuros_integration import ZurosIntegration

def setup(bot: commands.Bot):
    bot.add_cog(Cloud(bot))
    bot.add_cog(ZurosIntegration(bot))

__all__ = ["setup"]