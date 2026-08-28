from disnake.ext import commands
from . import ticket

def setup(bot: commands.Bot):
    """Loads the ticket cogs."""
    ticket.setup(bot)