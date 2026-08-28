import re

from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1)
    institution_slug: str | None = Field(None, max_length=50)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserProfileResponse | None" = None


class RegisterStudentRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    identifier: str | None = Field(None, max_length=50)
    department_id: str = Field(..., max_length=36)
    institution_id: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format")
        return v


class RegisterStaffRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    identifier: str | None = Field(None, max_length=50)
    department_id: str = Field(..., max_length=36)
    institution_id: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format")
        return v


class UserProfileResponse(BaseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str
    institution_id: str | None = None
    institution_name: str | None = None
    institution_code: str | None = None
    attendee_id: str | None = None
    attendee_type: str | None = None
    profile_photo_url: str | None = None
    assigned_org_ids: list[str] = []
    is_marshal: bool = False
    marshal_org_ids: list[str] = []

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    role: str = Field(..., pattern=r"^(super_admin|marshal|admin|org_admin)$")
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    institution_id: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str
    institution_id: str | None = None

    model_config = {"from_attributes": True}
