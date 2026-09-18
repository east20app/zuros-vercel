class ZurosApiError(RuntimeError):
    def __init__(
        self, message: str, *, status: int = 500, code: str = "API_ERROR", request_id: str = ""
    ):
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id


class Unauthorized(ZurosApiError):
    pass


class NotFound(ZurosApiError):
    pass


class Conflict(ZurosApiError):
    pass


class RateLimited(ZurosApiError):
    pass


class ServiceUnavailable(ZurosApiError):
    pass


ERRORS = {
    401: Unauthorized,
    403: Unauthorized,
    404: NotFound,
    409: Conflict,
    429: RateLimited,
    502: ServiceUnavailable,
    503: ServiceUnavailable,
}
