from app.models.user import User, UserRole
from app.services.auth_service import decode_token
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User | None:
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    if payload is None:
        return None
    user_id: str | None = payload.get("sub")
    if user_id is None:
        return None

    email: str = payload.get("email", "")
    role_raw: str = payload.get("role", "")
    try:
        role = UserRole(role_raw)
    except ValueError:
        return None

    user = User(id=user_id, email=email, role=role)
    return user


async def get_current_user(
    user: User | None = Depends(get_optional_user),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(*roles: UserRole):
    async def _role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role.value} not permitted",
            )
        return user

    return _role_checker


require_admin = require_role(UserRole.admin)
require_marshal = require_role(UserRole.marshal)
require_admin_or_marshal = require_role(UserRole.admin, UserRole.marshal)
