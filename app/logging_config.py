import logging
import json
import time
import sys
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from prometheus_fastapi_instrumentator import Instrumentator

class JSONFormatter(logging.Formatter):
    def __init__(self, service_name: str = "goftyar-service"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": self.service_name,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        # Add extra fields if passed in record.__dict__
        extra_fields = getattr(record, "extra_data", None)
        if isinstance(extra_fields, dict):
            log_obj.update(extra_fields)

        return json.dumps(log_obj, ensure_ascii=False)


def setup_logging(service_name: str, log_level: str = "INFO"):
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter(service_name=service_name))
    root_logger.addHandler(handler)

    # Disable spammy loggers if any
    logging.getLogger("uvicorn.access").disabled = True


def setup_observability(app: FastAPI, service_name: str):
    setup_logging(service_name)
    logger = logging.getLogger(service_name)

    # Add HTTP Access Request Logging Middleware
    @app.middleware("http")
    async def json_logging_middleware(request: Request, call_next):
        start_time = time.time()
        path = request.url.path

        response = await call_next(request)
        duration = round((time.time() - start_time) * 1000, 2)

        # Do not log health checks to keep logs clean, unless error
        if path not in ["/health", "/metrics"] or response.status_code >= 400:
            extra = {
                "extra_data": {
                    "method": request.method,
                    "path": path,
                    "status_code": response.status_code,
                    "duration_ms": duration,
                    "client_ip": request.client.host if request.client else "unknown",
                }
            }
            logger.info(f"{request.method} {path} - {response.status_code} ({duration}ms)", extra=extra)

        return response

    # Instrument Prometheus metrics
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        excluded_handlers=["/health", "/metrics"],
    )
    instrumentator.instrument(app).expose(app, endpoint="/metrics")
