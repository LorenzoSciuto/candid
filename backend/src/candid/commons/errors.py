import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def ai_provider_error(exc: Exception) -> HTTPException:
    """Log the provider failure server-side; give the client an actionable message without internals."""
    logger.warning("AI provider call failed: %s", exc, exc_info=exc)
    return HTTPException(502, "The AI provider request failed — check the provider, model and API key in Settings")
