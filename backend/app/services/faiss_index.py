import hashlib
import math
import threading
import time
import uuid

import faiss
import numpy as np
from app.config import settings

EMBEDDING_DIM = 512
_lock = threading.Lock()


class InstitutionIndex:
    def __init__(self, institution_id: uuid.UUID):
        self.institution_id = institution_id
        self.index: faiss.Index | None = None
        self.attendee_ids: list[uuid.UUID] = []
        self.content_hash: str = ""
        self.last_accessed: float = time.time()

    @property
    def is_ready(self) -> bool:
        return self.index is not None and self.index.ntotal > 0

    @property
    def total_vectors(self) -> int:
        return self.index.ntotal if self.index is not None else 0


_indices: dict[uuid.UUID, InstitutionIndex] = {}


def _compute_content_hash(rows: list[tuple]) -> str:
    if not rows:
        return ""
    count = len(rows)
    last_id = str(rows[-1][2]) if len(rows[-1]) > 2 else str(rows[-1][1])
    return hashlib.sha256(f"{count}:{last_id}".encode()).hexdigest()


def _compute_nprobe(nlist: int, n_total: int) -> int:
    if n_total < 500:
        return nlist
    if n_total < 5000:
        return max(20, nlist // 2)
    return max(1, int(nlist * settings.faiss_nprobe_ratio))


def build_institution_index(
    institution_id: uuid.UUID,
    embeddings: list[tuple[bytes, uuid.UUID, uuid.UUID]],
    force: bool = False,
) -> bool:
    """Builds or updates the isolated FAISS vector index for a specific institution."""
    content_hash = _compute_content_hash(embeddings)

    with _lock:
        inst_idx = _indices.get(institution_id)
        if inst_idx is None:
            inst_idx = InstitutionIndex(institution_id)
            _indices[institution_id] = inst_idx

        if not force and inst_idx.content_hash == content_hash and inst_idx.index is not None:
            inst_idx.last_accessed = time.time()
            return False

    new_attendee_ids: list[uuid.UUID] = []
    vectors = []
    for emb_bytes, attendee_id, *_ in embeddings:
        vec = np.frombuffer(emb_bytes, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm == 0:
            continue
        vec = vec / norm
        vectors.append(vec)
        new_attendee_ids.append(attendee_id)

    if not vectors:
        with _lock:
            inst_idx.index = None
            inst_idx.attendee_ids = []
            inst_idx.content_hash = content_hash
            inst_idx.last_accessed = time.time()
        return True

    vec_array = np.array(vectors, dtype=np.float32)
    n_total = len(vectors)

    if n_total < 16:
        new_index = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index.add(vec_array)
        with _lock:
            inst_idx.index = new_index
            inst_idx.attendee_ids = new_attendee_ids
            inst_idx.content_hash = content_hash
            inst_idx.last_accessed = time.time()
        return True

    nlist = min(int(4 * math.sqrt(n_total)), settings.faiss_max_nlist)
    nlist = max(1, nlist)

    if n_total >= settings.faiss_pq_threshold:
        m = min(settings.faiss_pq_m, EMBEDDING_DIM)
        quantizer = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index = faiss.IndexIVFPQ(
            quantizer, EMBEDDING_DIM, nlist, m, settings.faiss_pq_bits, faiss.METRIC_INNER_PRODUCT
        )
    else:
        quantizer = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index = faiss.IndexIVFFlat(quantizer, EMBEDDING_DIM, nlist, faiss.METRIC_INNER_PRODUCT)

    new_index.train(vec_array)
    new_index.add(vec_array)
    new_index.nprobe = _compute_nprobe(nlist, n_total)

    with _lock:
        inst_idx.index = new_index
        inst_idx.attendee_ids = new_attendee_ids
        inst_idx.content_hash = content_hash
        inst_idx.last_accessed = time.time()
    return True


def is_institution_ready(institution_id: uuid.UUID) -> bool:
    with _lock:
        inst_idx = _indices.get(institution_id)
        return inst_idx is not None and inst_idx.is_ready


def search_institution(
    institution_id: uuid.UUID,
    query_embedding: bytes,
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> tuple[float | None, uuid.UUID | None]:
    """Search for matching face strictly within the given institution's vector index."""
    with _lock:
        inst_idx = _indices.get(institution_id)
        if inst_idx is None or inst_idx.index is None or inst_idx.index.ntotal == 0:
            return None, None
        inst_idx.last_accessed = time.time()
        idx_ref = inst_idx.index
        aids = inst_idx.attendee_ids

    q = np.frombuffer(query_embedding, dtype=np.float32).reshape(1, -1)
    q_norm = np.linalg.norm(q)
    if q_norm == 0:
        return None, None
    q = q / q_norm

    k = min(2, idx_ref.ntotal)
    distances, indices = idx_ref.search(q, k)
    top_idx = indices[0][0]
    if top_idx == -1:
        return None, None

    score = float(distances[0][0])
    if score < threshold:
        return score, None

    if k == 2 and indices[0][1] != -1:
        second_score = float(distances[0][1])
        if score - second_score < min_margin:
            return score, None

    return score, aids[top_idx]


def batch_search_institution(
    institution_id: uuid.UUID,
    query_embeddings: list[bytes],
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> list[tuple[float | None, uuid.UUID | None]]:
    """Batch search for matching faces strictly within the given institution's vector index."""
    with _lock:
        inst_idx = _indices.get(institution_id)
        if inst_idx is None or inst_idx.index is None or inst_idx.index.ntotal == 0:
            return [(None, None)] * len(query_embeddings)
        inst_idx.last_accessed = time.time()
        idx_ref = inst_idx.index
        aids = inst_idx.attendee_ids

    queries = []
    for emb_bytes in query_embeddings:
        q = np.frombuffer(emb_bytes, dtype=np.float32).reshape(1, -1)
        q_norm = np.linalg.norm(q)
        if q_norm == 0:
            queries.append(np.zeros((1, EMBEDDING_DIM), dtype=np.float32))
        else:
            queries.append(q / q_norm)

    all_q = np.vstack(queries)
    k = min(2, idx_ref.ntotal)
    distances, indices = idx_ref.search(all_q, k)

    results = []
    for i in range(len(query_embeddings)):
        top_idx = indices[i][0]
        if top_idx == -1:
            results.append((None, None))
            continue
        score = float(distances[i][0])
        if score < threshold:
            results.append((score, None))
            continue

        if k == 2 and indices[i][1] != -1:
            second_score = float(distances[i][1])
            if score - second_score < min_margin:
                results.append((score, None))
                continue

        results.append((score, aids[top_idx]))

    return results


async def ensure_institution_index_loaded(
    session,
    institution_id: uuid.UUID,
    force: bool = False,
) -> bool:
    """Fetches all embeddings for an institution from the database and loads them into memory."""
    from app.models.attendee import Attendee
    from app.models.embedding import Embedding
    from sqlalchemy import select

    stmt = (
        select(Embedding.embedding, Embedding.attendee_id, Embedding.id)
        .join(Attendee, Attendee.id == Embedding.attendee_id)
        .where(Attendee.institution_id == institution_id)
    )
    result = await session.execute(stmt)
    rows = list(result.all())

    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, build_institution_index, institution_id, rows, force)


def evict_idle_indices(max_idle_seconds: float = 3600) -> int:
    """Evicts in-memory vector indices that have been idle past max_idle_seconds."""
    now = time.time()
    evicted = 0
    with _lock:
        to_delete = []
        for iid, inst_idx in _indices.items():
            if now - inst_idx.last_accessed > max_idle_seconds:
                to_delete.append(iid)
        for iid in to_delete:
            del _indices[iid]
            evicted += 1
    return evicted


def get_active_indices_telemetry() -> list[dict]:
    """Returns telemetry of all active in-memory institution indices for Super-Admin dashboard."""
    telemetry = []
    with _lock:
        for iid, inst_idx in _indices.items():
            telemetry.append({
                "institution_id": str(iid),
                "total_vectors": inst_idx.total_vectors,
                "is_ready": inst_idx.is_ready,
                "last_accessed_seconds_ago": round(time.time() - inst_idx.last_accessed, 1),
            })
    return telemetry


def clear_all() -> None:
    with _lock:
        _indices.clear()


# Backwards compatibility wrappers
def is_ready() -> bool:
    with _lock:
        return any(idx.is_ready for idx in _indices.values())


def search(
    query_embedding: bytes,
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> tuple[float | None, uuid.UUID | None]:
    with _lock:
        if not _indices:
            return None, None
        first_key = next(iter(_indices))
    return search_institution(first_key, query_embedding, threshold, min_margin)


def batch_search(
    query_embeddings: list[bytes],
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> list[tuple[float | None, uuid.UUID | None]]:
    with _lock:
        if not _indices:
            return [(None, None)] * len(query_embeddings)
        first_key = next(iter(_indices))
    return batch_search_institution(first_key, query_embeddings, threshold, min_margin)


def build_index(
    embeddings: list[tuple[bytes, uuid.UUID, uuid.UUID]],
    force: bool = False,
) -> bool:
    if not embeddings:
        return False
    # If no institution specified, build on default uuid
    default_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
    return build_institution_index(default_id, embeddings, force)


async def force_rebuild(institution_id: uuid.UUID | None = None) -> None:
    """Rebuilds the FAISS vector index for a specific institution or all active institutions."""
    from app.database import get_session_ctx
    from app.models.institution import Institution
    from sqlalchemy import select

    async with get_session_ctx() as session:
        if institution_id is not None:
            await ensure_institution_index_loaded(session, institution_id, force=True)
        else:
            result = await session.execute(
                select(Institution).where(Institution.is_active.is_(True))
            )
            active_institutions = result.scalars().all()
            for inst in active_institutions:
                await ensure_institution_index_loaded(session, inst.id, force=True)

