from pydantic import BaseModel


class DepartmentResponse(BaseModel):
    id: str
    name: str
    code: str

    model_config = {"from_attributes": True}


class DepartmentListResponse(BaseModel):
    items: list[DepartmentResponse]
    total: int
