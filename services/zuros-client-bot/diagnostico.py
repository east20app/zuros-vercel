import asyncio
import socket

from zuros_client.api import ZurosClientApi
from zuros_client.config import get_settings
from zuros_client.errors import ZurosApiError
from zuros_client.security import secret_fingerprint


async def diagnose() -> int:
    settings = get_settings()
    print(f"API: {settings.api_root}")
    print(f"Bot ID: {settings.zuros_client_bot_id}")
    print(
        "Assinatura da chave: "
        f"{secret_fingerprint(settings.zuros_client_bot_secret.get_secret_value())}"
    )
    host = settings.zuros_api_base_url.host or "app.zuros.site"
    try:
        addresses = sorted(
            {item[4][0] for item in socket.getaddrinfo(host, 443, family=socket.AF_INET)}
        )
        print(f"DNS IPv4: {', '.join(addresses)}")
    except OSError as error:
        print(f"DNS IPv4 falhou: {error}")

    api = ZurosClientApi(settings)
    try:
        result = await api.health()
        print(f"Conexão aprovada: {result.get('status', 'operacional')}")
        return 0
    except ZurosApiError as error:
        print(f"Conexão recusada: {error}")
        print(
            "Confira ZUROS_CLIENT_BOT_SECRET e ZUROS_CLIENT_BOT_ID no site e no bot, "
            "publique o site e reinicie os dois serviços."
        )
        return 1
    finally:
        await api.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(diagnose()))
