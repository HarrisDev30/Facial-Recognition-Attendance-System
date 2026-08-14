from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/attendance_system"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 480
    cors_origins: list[str] = ["http://localhost:5173"]
    default_confidence_threshold: float = 0.72
    cooldown_seconds: int = 4
    insightface_model_dir: str = "./models/insightface"
    insightface_providers: list[str] = [
        "CUDAExecutionProvider",
        "TensorRTExecutionProvider",
        "CPUExecutionProvider",
    ]
    insightface_det_thresh: float = 0.3
    insightface_min_det_score: float = 0.4
    max_face_yaw: float = 45.0
    max_face_pitch: float = 30.0
    faiss_index_rebuild_interval: int = 30
    faiss_max_nlist: int = 4096
    faiss_nprobe_ratio: float = 0.1
    faiss_pq_threshold: int = 20000
    faiss_pq_m: int = 64
    faiss_pq_bits: int = 8
    redis_url: str | None = None
    max_faces_per_frame: int = 20
    min_match_margin: float = 0.05
    max_image_size_bytes: int = 5 * 1024 * 1024
    profile_photo_dir: str = "./uploads/profile_photos"
    profile_photo_max_size: int = 2 * 1024 * 1024
    event_photo_dir: str = "./uploads/event_photos"
    event_photo_max_size: int = 2 * 1024 * 1024

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
