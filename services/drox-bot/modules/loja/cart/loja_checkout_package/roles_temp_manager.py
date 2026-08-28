"""
Sistema de gerenciamento de cargos temporários
Remove automaticamente cargos que expiraram
"""
import time
from disnake.ext import commands, tasks
from functions.database import database as db


class RolesTempManager(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        if not self.check_expired_roles.is_running():
            self.check_expired_roles.start()
    
    def cog_unload(self):
        self.check_expired_roles.cancel()
    
    @tasks.loop(minutes=1)
    async def check_expired_roles(self):
        """Verifica e remove cargos expirados a cada minuto"""
        try:
            roles_temp = db.get_document("loja_roles_temp") or {}
            current_time = int(time.time())
            modified = False
            
            for user_id_str, user_roles in list(roles_temp.items()):
                if not isinstance(user_roles, list):
                    continue
                
                roles_to_keep = []
                
                for role_data in user_roles:
                    if not isinstance(role_data, dict):
                        modified = True
                        continue

                    expires_at = role_data.get("expires_at")
                    role_id = role_data.get("role_id")
                    guild_id = role_data.get("guild_id")
                    try:
                        expires_at = int(float(expires_at))
                        role_id = int(role_id)
                        guild_id = int(guild_id)
                    except (TypeError, ValueError):
                        # Registro incompleto não pode ser processado; removê-lo
                        # evita que a tarefa falhe repetidamente.
                        modified = True
                        continue

                    if expires_at > current_time:
                        roles_to_keep.append(role_data)
                        continue

                    # Cargo expirou: remova-o, mas preserve o registro quando a
                    # API ou o cache estiverem indisponíveis para tentar depois.
                    try:
                        guild = self.bot.get_guild(guild_id)
                        if not guild:
                            roles_to_keep.append(role_data)
                            continue

                        member = guild.get_member(int(user_id_str))
                        if not member:
                            # Usuário não está mais no servidor: não há cargo a remover.
                            modified = True
                            continue

                        role = guild.get_role(role_id)
                        if not role:
                            # Cargo não existe mais; o registro pode ser descartado.
                            modified = True
                            continue

                        if role in member.roles:
                            await member.remove_roles(role, reason="Cargo temporário expirado")
                        modified = True
                    except (TypeError, ValueError):
                        modified = True
                    except Exception:
                        # Erros temporários não devem apagar o registro.
                        roles_to_keep.append(role_data)
                
                # Atualizar lista de cargos do usuário
                if roles_to_keep:
                    roles_temp[user_id_str] = roles_to_keep
                else:
                    # Se não há mais cargos, remover o usuário do documento
                    del roles_temp[user_id_str]
                    modified = True
            
            # Salvar alterações se houve modificações
            if modified:
                db.save_document("loja_roles_temp", roles_temp)
        
        except Exception as exc:
            print(f"Erro ao verificar cargos temporários: {exc}")
    
    @check_expired_roles.before_loop
    async def before_check_expired_roles(self):
        """Aguarda o bot estar pronto antes de iniciar a tarefa"""
        await self.bot.wait_until_ready()


def setup(bot: commands.Bot):
    bot.add_cog(RolesTempManager(bot))
