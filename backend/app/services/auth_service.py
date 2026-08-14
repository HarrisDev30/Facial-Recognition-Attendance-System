from datetime import UTC, datetime, timedelta

from app.config import settings
from jose import JWTError, jwt


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.jwt_expiration_minutes
    )
    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})
    return jwt.encode(
        to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None
