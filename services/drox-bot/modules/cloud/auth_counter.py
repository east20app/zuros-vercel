from .zuros_cloud import ZurosCloudError, get_zuros_cloud

async def get_auth_count() -> int:
    try:
        return await get_zuros_cloud().auth_count()
    except ZurosCloudError as error:
        print(f"[Zuros Auth] Falha ao obter contagem: {error}")
        return 0