import time

import discord


class InteractionLimiter:
    def __init__(self, window_seconds: float = 2.5):
        self.window_seconds = window_seconds
        self._last: dict[str, float] = {}

    def allow(self, user_id: int, action: str) -> bool:
        key = f"{user_id}:{action}"
        now = time.monotonic()
        previous = self._last.get(key, 0)
        if now - previous < self.window_seconds:
            return False
        self._last[key] = now
        if len(self._last) > 5_000:
            self._last = {key: value for key, value in self._last.items() if now - value < 300}
        return True


async def owner_only(interaction: discord.Interaction, owner_id: int) -> bool:
    if interaction.user.id == owner_id:
        return True
    await interaction.response.send_message("Este painel pertence a outro usuário.", ephemeral=True)
    return False
