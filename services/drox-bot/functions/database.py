import copy
import json
import os
import threading
import time
from typing import Any, Optional

from connections.mongo_db import collection as bot_collection


class database:
    # ═════════════════════════════════════════════════════════
    # CONSTANTES
    # ═════════════════════════════════════════════════════════

    TEMPLATE_FILE = "database_template.json"
    INITIALIZATION_DOCUMENT = "_meta_initialization"

    DEFAULT_CACHE_TTL = 60
    LONG_CACHE_TTL = 10
    NOT_FOUND_CACHE_TTL = 10

    # Documentos de configuração com TTL específico.
    LONG_CACHE_DOCS = {
        "custom_mode",
        "custom_colors",
        "canais",
    }

    # ═════════════════════════════════════════════════════════
    # CACHE
    # ═════════════════════════════════════════════════════════

    _cache: dict[
        str,
        tuple[Any, float],
    ] = {}

    _cache_lock = threading.Lock()

    # Mantidos também com os nomes antigos para
    # compatibilidade caso outro código acesse diretamente.
    _default_ttl = DEFAULT_CACHE_TTL
    _long_cache_docs = LONG_CACHE_DOCS
    _long_cache_ttl = LONG_CACHE_TTL

    # ═════════════════════════════════════════════════════════
    # HELPERS INTERNOS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _get_cache_ttl(
        config_type: str,
    ) -> int:
        """
        Retorna o TTL utilizado pelo documento.
        """

        if (
            config_type
            in database._long_cache_docs
        ):
            return database._long_cache_ttl

        return database._default_ttl

    @staticmethod
    def _get_cached(
        config_type: str,
        current_time: float,
    ):
        """
        Retorna uma cópia do valor em cache
        caso ainda esteja válido.

        Retorna:
            (True, valor) quando encontrado.
            (False, None) quando ausente/expirado.
        """

        with database._cache_lock:
            cached_entry = (
                database._cache.get(
                    config_type
                )
            )

            if cached_entry is None:
                return False, None

            cached_data, expiry_time = (
                cached_entry
            )

            if current_time >= expiry_time:
                return False, None

            return (
                True,
                copy.deepcopy(
                    cached_data
                ),
            )

    @staticmethod
    def _set_cache(
        config_type: str,
        data,
        ttl: int,
        current_time: Optional[float] = None,
    ) -> None:
        """
        Salva um valor no cache utilizando
        cópia profunda.
        """

        if current_time is None:
            current_time = time.time()

        cached_data = copy.deepcopy(
            data
        )

        with database._cache_lock:
            database._cache[
                config_type
            ] = (
                cached_data,
                current_time + ttl,
            )

    @staticmethod
    def _invalidate_cache(
        config_type: str,
    ) -> None:
        """
        Remove um único documento do cache.
        """

        with database._cache_lock:
            database._cache.pop(
                config_type,
                None,
            )

    # ═════════════════════════════════════════════════════════
    # ARQUIVOS JSON
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def obter(
        filename: str,
    ):
        """
        Lê um arquivo JSON.

        Mantém o comportamento atual:
        retorna {} quando o arquivo não existe
        ou contém JSON inválido.
        """

        try:
            with open(
                filename,
                "r",
                encoding="utf-8",
            ) as file:
                return json.load(
                    file
                )

        except (
            FileNotFoundError,
            json.JSONDecodeError,
        ):
            return {}

    @staticmethod
    def salvar(
        filename: str,
        data: dict,
    ):
        """
        Salva dados em um arquivo JSON.
        """

        with open(
            filename,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                data,
                file,
                indent=4,
                ensure_ascii=False,
            )

    # ═════════════════════════════════════════════════════════
    # GET DOCUMENT
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def get_document(
        config_type: str,
    ):
        """
        Obtém um documento de configuração
        específico do bot.

        Usa config_type como _id.

        Mantém o comportamento atual:
        - usa cache;
        - retorna cópia profunda;
        - remove _id;
        - documento contendo apenas "items"
          retorna diretamente a lista;
        - erro ou documento inexistente retorna {}.
        """

        current_time = time.time()

        # ═════════════════════════════════════════
        # CACHE
        # ═════════════════════════════════════════

        found, cached_data = (
            database._get_cached(
                config_type,
                current_time,
            )
        )

        if found:
            return cached_data

        # ═════════════════════════════════════════
        # MONGODB
        # ═════════════════════════════════════════

        try:
            document = (
                bot_collection.find_one(
                    {
                        "_id": config_type
                    }
                )
            )

            if document:
                doc_copy = (
                    document.copy()
                )

                doc_copy.pop(
                    "_id",
                    None,
                )

                # Documento especial de lista.
                if (
                    len(doc_copy) == 1
                    and "items" in doc_copy
                ):
                    result = (
                        doc_copy["items"]
                    )

                else:
                    result = doc_copy

                ttl = (
                    database._get_cache_ttl(
                        config_type
                    )
                )

                database._set_cache(
                    config_type,
                    result,
                    ttl,
                    current_time,
                )

                return copy.deepcopy(
                    result
                )

            # ═════════════════════════════════════
            # NÃO ENCONTRADO
            # ═════════════════════════════════════

            empty_result = {}

            database._set_cache(
                config_type,
                empty_result,
                database.NOT_FOUND_CACHE_TTL,
                current_time,
            )

            return empty_result

        except Exception:
            # Mantém o comportamento atual:
            # qualquer erro retorna dict vazio.
            return {}

    # ═════════════════════════════════════════════════════════
    # GET DOCUMENTS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def get_documents(
        query: dict = None,
    ):
        """
        Obtém múltiplos documentos.

        Retorna uma lista de dicionários
        sem o campo _id.
        """

        if query is None:
            query = {}

        documents = list(
            bot_collection.find(
                query
            )
        )

        for document in documents:
            document.pop(
                "_id",
                None,
            )

        return documents

    # ═════════════════════════════════════════════════════════
    # DELETE DOCUMENT
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def delete_document(
        config_type: str,
    ):
        """
        Deleta um documento específico.
        """

        bot_collection.delete_one(
            {
                "_id": config_type
            }
        )

        database._invalidate_cache(
            config_type
        )

    # ═════════════════════════════════════════════════════════
    # DELETE DOCUMENTS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def delete_documents(
        query: dict,
    ):
        """
        Deleta múltiplos documentos e invalida
        seus respectivos caches.
        """

        documents_to_delete = list(
            bot_collection.find(
                query,
                {
                    "_id": 1
                },
            )
        )

        deleted_ids = [
            document["_id"]
            for document
            in documents_to_delete
        ]

        bot_collection.delete_many(
            query
        )

        with database._cache_lock:
            for document_id in deleted_ids:
                database._cache.pop(
                    document_id,
                    None,
                )

    # ═════════════════════════════════════════════════════════
    # SAVE DOCUMENT
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def save_document(
        config_type: str,
        query_or_data=None,
        data=None,
    ):
        """
        Salva um documento de configuração.

        Mantém as duas assinaturas atuais:

        Nova:
            save_document(config_type, data)

        Antiga:
            save_document(config_type, {}, data)

        O segundo argumento da assinatura antiga
        continua sendo ignorado.

        Também mantém suporte a listas.
        """

        # ═════════════════════════════════════════
        # RETROCOMPATIBILIDADE
        # ═════════════════════════════════════════

        if data is None:
            data = query_or_data

        # ═════════════════════════════════════════
        # LISTA
        # ═════════════════════════════════════════

        if isinstance(
            data,
            list,
        ):
            document = {
                "_id": config_type,
                "items": data,
            }

            cache_data = data

        # ═════════════════════════════════════════
        # DICT
        # ═════════════════════════════════════════

        else:
            data_copy = data.copy()

            data_copy[
                "_id"
            ] = config_type

            document = data_copy

            cache_data = {
                key: value
                for key, value
                in data_copy.items()
                if key != "_id"
            }

            if (
                len(cache_data) == 1
                and "items" in cache_data
            ):
                cache_data = (
                    cache_data["items"]
                )

        # ═════════════════════════════════════════
        # MONGODB
        # ═════════════════════════════════════════

        bot_collection.replace_one(
            {
                "_id": config_type
            },
            document,
            upsert=True,
        )

        # ═════════════════════════════════════════
        # CACHE
        # ═════════════════════════════════════════

        current_time = time.time()

        ttl = (
            database._get_cache_ttl(
                config_type
            )
        )

        database._set_cache(
            config_type,
            cache_data,
            ttl,
            current_time,
        )

    # ═════════════════════════════════════════════════════════
    # INICIALIZAÇÃO DA DATABASE
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def initialize_database_if_needed():
        """
        Verifica se o bot já foi inicializado.

        Caso contrário, popula a coleção usando
        database_template.json.

        Cada chave do JSON vira um documento
        com _id correspondente ao nome da chave.
        """

        initialization_doc = (
            bot_collection.find_one(
                {
                    "_id": (
                        database
                        .INITIALIZATION_DOCUMENT
                    )
                }
            )
        )

        if initialization_doc:
            return

        print(
            "Primeira inicialização detectada. "
            "Populando a coleção do bot "
            "com valores padrão..."
        )

        template_file = (
            database.TEMPLATE_FILE
        )

        try:
            with open(
                template_file,
                "r",
                encoding="utf-8",
            ) as file:
                all_configs = json.load(
                    file
                )

            for (
                config_type,
                default_data,
            ) in all_configs.items():

                try:
                    if isinstance(
                        default_data,
                        list,
                    ):
                        # Mantém exatamente o formato
                        # atual de inicialização.
                        database.save_document(
                            config_type,
                            {
                                "items": default_data
                            },
                        )

                        print(
                            f" - Config '{config_type}' "
                            "inicializada com "
                            f"{len(default_data)} itens."
                        )

                    else:
                        database.save_document(
                            config_type,
                            default_data,
                        )

                        print(
                            f" - Config '{config_type}' "
                            "inicializada com sucesso."
                        )

                except Exception as error:
                    print(
                        "Erro ao inicializar a config "
                        f"'{config_type}': {error}"
                    )

            # ═════════════════════════════════════
            # MARCAR INICIALIZAÇÃO
            # ═════════════════════════════════════

            bot_collection.insert_one(
                {
                    "_id": (
                        database
                        .INITIALIZATION_DOCUMENT
                    ),
                    "initialized_at": (
                        os.path.getmtime(
                            template_file
                        )
                    ),
                }
            )

            print(
                "Inicialização da coleção "
                "do bot concluída."
            )

        except FileNotFoundError:
            print(
                f"ERRO: Arquivo '{template_file}' "
                "não encontrado!"
            )

        except json.JSONDecodeError as error:
            print(
                f"ERRO: Arquivo '{template_file}' "
                "contém JSON inválido: "
                f"{error}"
            )

    # ═════════════════════════════════════════════════════════
    # VERIFICAR DOCUMENTOS FALTANTES
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def verify_and_create_missing_documents():
        """
        Verifica se todos os documentos do
        database_template.json existem.

        Documentos ausentes são criados
        com os valores padrão.

        Executado a cada inicialização do bot.
        """

        template_file = (
            database.TEMPLATE_FILE
        )

        try:
            with open(
                template_file,
                "r",
                encoding="utf-8",
            ) as file:
                all_configs = json.load(
                    file
                )

            missing_count = 0

            for (
                config_type,
                default_data,
            ) in all_configs.items():

                existing_doc = (
                    bot_collection.find_one(
                        {
                            "_id": config_type
                        }
                    )
                )

                if existing_doc:
                    continue

                try:
                    if isinstance(
                        default_data,
                        list,
                    ):
                        database.save_document(
                            config_type,
                            {
                                "items": default_data
                            },
                        )

                        print(
                            "[MongoDB] Documento faltante "
                            f"'{config_type}' criado com "
                            f"{len(default_data)} itens."
                        )

                    else:
                        database.save_document(
                            config_type,
                            default_data,
                        )

                        print(
                            "[MongoDB] Documento faltante "
                            f"'{config_type}' criado "
                            "com sucesso."
                        )

                    missing_count += 1

                except Exception as error:
                    print(
                        "[MongoDB] Erro ao criar "
                        f"documento '{config_type}': "
                        f"{error}"
                    )

            if missing_count > 0:
                print(
                    f"[MongoDB] {missing_count} "
                    "documento(s) faltante(s) "
                    "foi(ram) criado(s)."
                )

            else:
                print(
                    "[MongoDB] Todos os documentos "
                    "do template estão presentes "
                    "na database."
                )

        except FileNotFoundError:
            print(
                "[MongoDB] ERRO: Arquivo "
                f"'{template_file}' não encontrado!"
            )

        except json.JSONDecodeError as error:
            print(
                "[MongoDB] ERRO: Arquivo "
                f"'{template_file}' contém "
                f"JSON inválido: {error}"
            )

        except Exception as error:
            print(
                "[MongoDB] ERRO ao verificar "
                f"documentos: {error}"
            )

    # ═════════════════════════════════════════════════════════
    # CLEAR CACHE
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def clear_cache(
        config_type: Optional[str] = None,
    ):
        """
        Limpa o cache.

        Args:
            config_type:
                Se informado, limpa somente
                esse documento.

                Se None, limpa todo o cache.
        """

        with database._cache_lock:
            if config_type:
                database._cache.pop(
                    config_type,
                    None,
                )

            else:
                database._cache.clear()

    # ═════════════════════════════════════════════════════════
    # CACHE STATS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def get_cache_stats() -> dict:
        """
        Retorna estatísticas do cache.
        """

        with database._cache_lock:
            current_time = time.time()

            valid_entries = sum(
                1
                for _, (
                    _,
                    expiry,
                )
                in database._cache.items()
                if current_time < expiry
            )

            total_entries = len(
                database._cache
            )

            expired_entries = (
                total_entries
                - valid_entries
            )

            return {
                "total_entries": (
                    total_entries
                ),
                "valid_entries": (
                    valid_entries
                ),
                "expired_entries": (
                    expired_entries
                ),
                "cached_documents": list(
                    database._cache.keys()
                ),
            }